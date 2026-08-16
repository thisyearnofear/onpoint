/**
 * Cron Payout Routes — /api/cron
 *
 * Called by the worker on a schedule. Handles:
 *   1. Payout retry: re-attempt failed curator payouts (custodial model)
 *   2. Split distribution: distribute accumulated cUSD in SplitV2 contracts
 *      for delivered orders using the non-custodial model
 *   3. Auto-release: mark shipped orders as delivered after N days
 *   4. Refund: issue refunds for cancelled orders (stock races)
 *
 * Protected by SERVICE_API_KEY.
 */

const express = require('express');
const { eq, and, isNull, lte, sql, inArray } = require('drizzle-orm');
const { orders, curators, agentReferrals } = require('@repo/db');
const agentCore = require('@repo/agent-core');
const sharedTypes = require('@onpoint/shared-types');
const logger = require('../lib/logger');
const { distributeSplit } = require('../lib/split-setup');
const { getAttributionSuffix } = require('../lib/attribution');
const { getDb } = require('../lib/db');
const {
  CUSD_PAYMENT_METHOD,
  SPLIT_PAYMENT_METHOD,
  REFUND_STATUS,
  isAutomaticCusdRefundEligible,
  decimalToAtomic,
} = require('../lib/order-refunds');

const router = express.Router();

// ── POST /api/cron/payout-retry ──
// Retry failed curator payouts (custodial model) and distribute
// pending SplitV2 balances (non-custodial model).
router.post('/payout-retry', async (req, res) => {
  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const db = getDb({ orders, curators });

    // ── 0. Refund cancelled stock-race orders ──
    // Only platform-custodied cUSD is handled automatically. Split and
    // facilitator payments remain manual_review until their rail-specific
    // refund paths are implemented. Legacy cancelled rows are quarantined so
    // they remain visible instead of silently disappearing from the queue.
    await db.update(orders).set({
      refundStatus: REFUND_STATUS.MANUAL_REVIEW,
      refundLastError: 'Legacy cancelled order requires payment-rail reconciliation',
      updatedAt: new Date(),
    }).where(and(
      eq(orders.status, 'cancelled'),
      sql`${orders.refundStatus} IS NULL`,
    ));

    // Verified payments can leave a pending claim if the API process dies
    // between the insert and stock update. Quarantine after a short window;
    // never auto-confirm or auto-refund an ambiguous reservation because the
    // stock update may have committed immediately before the crash.
    await db.update(orders).set({
      refundStatus: REFUND_STATUS.MANUAL_REVIEW,
      refundLastError: 'Pending payment claim timed out; verify stock reservation before resolving',
      updatedAt: new Date(),
    }).where(and(
      eq(orders.status, 'pending'),
      sql`${orders.source} = 'agent'`,
      sql`${orders.createdAt} < now() - interval '15 minutes'`,
    ));

    await db.update(orders).set({
      refundStatus: REFUND_STATUS.MANUAL_REVIEW,
      refundLastError: 'Refund transfer may have committed; verify on-chain before retrying',
      updatedAt: new Date(),
    }).where(and(
      eq(orders.status, 'cancelled'),
      eq(orders.refundStatus, REFUND_STATUS.PROCESSING),
      sql`${orders.updatedAt} < now() - interval '15 minutes'`,
    ));

    const refundCandidates = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.status, 'cancelled'),
          sql`${orders.refundStatus} IN ('pending', 'failed')`,
          eq(orders.paymentMethod, CUSD_PAYMENT_METHOD),
        ),
      )
      .limit(20);

    for (const candidate of refundCandidates) {
      processed++;
      if (!isAutomaticCusdRefundEligible(candidate, { cusdAsset: sharedTypes.X402_ASSET })) {
        continue;
      }

      const [claimed] = await db
        .update(orders)
        .set({
          refundStatus: REFUND_STATUS.PROCESSING,
          refundAttempts: sql`${orders.refundAttempts} + 1`,
          refundLastError: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orders.id, candidate.id),
            eq(orders.status, 'cancelled'),
            sql`${orders.refundStatus} IN ('pending', 'failed')`,
            eq(orders.paymentMethod, CUSD_PAYMENT_METHOD),
            sql`${orders.refundTxHash} IS NULL`,
          ),
        )
        .returning();

      // Another worker may have claimed this refund between SELECT and UPDATE.
      if (!claimed) continue;

      try {
        const signerClient = agentCore.getSignerClient();
        const payoutKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;
        if (!signerClient && !payoutKey) throw new Error('No signing method for refund');

        const amountWei = decimalToAtomic(claimed.amountCusd, 18);
        let refundTxHash;
        if (signerClient) {
          const result = await signerClient.signTransfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: claimed.buyerAddress,
            amountWei: amountWei.toString(),
            action: 'order_refund',
            agentId: 'system',
            userId: `buyer:${claimed.buyerAddress}`,
            suggestionId: `refund_${claimed.id}`,
            description: `Automatic cUSD refund for cancelled order ${claimed.id}`,
          });
          if (!result.success) throw new Error(result.error || 'Signer rejected refund');
          refundTxHash = result.txHash;
        } else {
          const result = await agentCore.ERC20.transfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: claimed.buyerAddress,
            amount: amountWei,
            privateKey: payoutKey,
            dataSuffix: getAttributionSuffix(),
          });
          refundTxHash = result.hash;
        }

        await db.update(orders).set({
          refundStatus: REFUND_STATUS.PAID,
          refundTxHash,
          refundLastError: null,
          updatedAt: new Date(),
        }).where(eq(orders.id, claimed.id));
        succeeded++;
        logger.info('Cancelled order refund succeeded', {
          component: 'cron-payout', orderId: claimed.id, refundTxHash,
        });
      } catch (refundErr) {
        failed++;
        await db.update(orders).set({
          refundStatus: REFUND_STATUS.FAILED,
          refundLastError: String(refundErr?.message || 'Refund failed').slice(0, 500),
          updatedAt: new Date(),
        }).where(eq(orders.id, claimed.id));
        logger.error('Cancelled order refund failed', {
          component: 'cron-payout', orderId: claimed.id,
        }, refundErr);
      }
    }

    // ── 1. Custodial payouts: orders with paymentTxHash but no payoutTxHash,
    //    status confirmed/shipped/delivered, and curator has no split ──
    const pendingCustodial = await db
      .select({ order: orders, curator: curators })
      .from(orders)
      .innerJoin(curators, eq(orders.curatorSlug, curators.slug))
      .where(
        and(
          isNull(orders.payoutTxHash),
          sql`${orders.paymentTxHash} IS NOT NULL`,
          sql`${orders.status} IN ('confirmed', 'shipped', 'delivered')`,
          sql`${orders.paymentMethod} = ${CUSD_PAYMENT_METHOD}`,
          sql`${orders.paymentAsset} = ${sharedTypes.X402_ASSET}`,
        ),
      )
      .limit(20);

    for (const { order, curator } of pendingCustodial) {
      processed++;
      const splitAddress = curator.commerce?.splitAddress;
      if (splitAddress) continue; // handled by split distribution below

      const payoutAddress = curator.commerce?.walletAddress;
      if (!payoutAddress) {
        logger.warn('Cannot retry payout — curator has no walletAddress', {
          component: 'cron-payout', orderId: order.id, slug: order.curatorSlug,
        });
        failed++;
        continue;
      }

      try {
        const signerClient = agentCore.getSignerClient();
        const payoutKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;
        if (!signerClient && !payoutKey) {
          logger.error('No signing method for payout retry', { component: 'cron-payout' });
          failed++;
          break;
        }

        const amountWei = BigInt(Math.round(Number(order.amountCusd) * 1e18));
        const split = agentCore.calculateSplit(amountWei, payoutAddress, {
          sellerBps: undefined, // use default from curator revShare
        });
        const sellerShare = split.recipients.find((r) => r.label === 'seller');

        let payoutTxHash;
        if (signerClient) {
          const signerResult = await signerClient.signTransfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: payoutAddress,
            amountWei: sellerShare.amount.toString(),
            action: 'payout_retry',
            agentId: 'system',
            userId: `curator:${order.curatorSlug}`,
            suggestionId: `order_${order.id}`,
            description: `Curator payout retry for order ${order.id}`,
          });
          if (!signerResult.success) throw new Error(signerResult.error || 'Signer rejected');
          payoutTxHash = signerResult.txHash;
        } else {
          const transferResult = await agentCore.ERC20.transfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: payoutAddress,
            amount: sellerShare.amount,
            privateKey: payoutKey,
            dataSuffix: getAttributionSuffix(),
          });
          payoutTxHash = transferResult.hash;
        }

        await db.update(orders).set({ payoutTxHash, updatedAt: new Date() }).where(eq(orders.id, order.id));
        succeeded++;
        logger.info('Payout retry succeeded', { component: 'cron-payout', orderId: order.id, payoutTxHash });
      } catch (err) {
        failed++;
        logger.error('Payout retry failed', { component: 'cron-payout', orderId: order.id }, err);
      }
    }

    // ── 2. Split distribution: distribute cUSD in SplitV2 contracts ──
    //    Find curators with a split address that have confirmed/delivered
    //    orders with no payoutTxHash, then distribute their split.
    const pendingSplitOrders = await db
      .select({ order: orders, curator: curators })
      .from(orders)
      .innerJoin(curators, eq(orders.curatorSlug, curators.slug))
      .where(
        and(
          isNull(orders.payoutTxHash),
          sql`${orders.paymentTxHash} IS NOT NULL`,
          sql`${orders.status} IN ('confirmed', 'shipped', 'delivered')`,
          sql`${orders.paymentMethod} = ${SPLIT_PAYMENT_METHOD}`,
          sql`${orders.paymentAsset} = ${sharedTypes.X402_ASSET}`,
          sql`${curators.commerce}->>'splitAddress' IS NOT NULL`,
        ),
      )
      .limit(20);

    // Group by split address to batch-distribute
    const splitMap = new Map();
    for (const { order, curator } of pendingSplitOrders) {
      const splitAddress = curator.commerce.splitAddress;
      if (!splitMap.has(splitAddress)) {
        splitMap.set(splitAddress, { orders: [], curator });
      }
      splitMap.get(splitAddress).orders.push(order);
    }

    for (const [splitAddress, { orders: orderList }] of splitMap) {
      processed++;
      try {
        const result = await distributeSplit(splitAddress, sharedTypes.X402_ASSET);
        if (result) {
          // Mark all orders for this split as paid
          for (const order of orderList) {
            await db.update(orders).set({
              payoutTxHash: result.txHash,
              updatedAt: new Date(),
            }).where(eq(orders.id, order.id));
            succeeded++;
          }
          logger.info('Split distributed', {
            component: 'cron-payout', splitAddress, txHash: result.txHash, orderCount: orderList.length,
          });
        } else {
          // No balance to distribute — skip silently
          logger.debug('Split has no balance to distribute', { component: 'cron-payout', splitAddress });
        }
      } catch (err) {
        failed++;
        logger.error('Split distribution failed', { component: 'cron-payout', splitAddress }, err);
      }
    }

    // ── 3. Auto-release: shipped orders older than AUTO_RELEASE_DAYS → delivered ──
    const autoReleaseDays = parseInt(process.env.AUTO_RELEASE_DAYS || '7', 10);
    const cutoff = new Date(Date.now() - autoReleaseDays * 24 * 60 * 60 * 1000);
    const autoReleased = await db
      .update(orders)
      .set({
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.status, 'shipped'),
          lte(orders.shippedAt, cutoff),
        ),
      )
      .returning({ id: orders.id });

    if (autoReleased.length > 0) {
      logger.info('Auto-released shipped orders to delivered', {
        component: 'cron-payout', count: autoReleased.length, autoReleaseDays,
      });
    }

    const elapsedMs = Date.now() - startTime;
    logger.info('Payout retry cron complete', {
      component: 'cron-payout', processed, succeeded, failed, elapsedMs,
    });

    res.json({
      success: true,
      processed,
      succeeded,
      failed,
      autoReleased: autoReleased.length,
      elapsedMs,
    });
  } catch (err) {
    logger.error('Payout retry cron failed', { component: 'cron-payout' }, err);
    res.status(500).json({
      success: false,
      error: err.message?.slice(0, 200) || 'Unknown error',
      processed,
      succeeded,
      failed,
    });
  }
});

// ── POST /api/cron/referral-payout ──
// Settle pending referral commissions (2.5% of order value) to agent wallets.
// Finds agent_referrals with status='pending', sends cUSD to the agent's
// wallet, and marks them as 'paid'.
router.post('/referral-payout', async (req, res) => {
  const startTime = Date.now();
  let processed = 0;
  let succeeded = 0;
  let failed = 0;

  try {
    const db = getDb({ orders, curators });

    // Find pending referrals with a confirmed/delivered order
    const pending = await db.execute(sql`
      SELECT ar.*, o.status as order_status, o.amount_cusd
      FROM agent_referrals ar
      INNER JOIN orders o ON ar.order_id = o.id
      WHERE ar.status = 'pending'
        AND o.status IN ('confirmed', 'shipped', 'delivered')
      ORDER BY ar.created_at ASC
      LIMIT 50
    `);

    if (pending.length === 0) {
      return res.json({
        success: true,
        processed: 0,
        succeeded: 0,
        failed: 0,
        elapsedMs: Date.now() - startTime,
      });
    }

    for (const referral of pending) {
      processed++;
      try {
        const commissionWei = BigInt(Math.round(Number(referral.commissionCusd) * 1e18));
        if (commissionWei === 0n) {
          // Zero commission — mark as paid without a tx
          await db.update(agentReferrals)
            .set({ status: 'paid', updatedAt: new Date() })
            .where(eq(agentReferrals.id, referral.id));
          succeeded++;
          continue;
        }

        const signerClient = agentCore.getSignerClient();
        const payoutKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;
        if (!signerClient && !payoutKey) {
          logger.error('No signing method for referral payout', { component: 'cron-payout' });
          failed++;
          break;
        }

        let txHash;
        if (signerClient) {
          const signerResult = await signerClient.signTransfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: referral.agentAddress,
            amountWei: commissionWei.toString(),
            action: 'referral_payout',
            agentId: 'system',
            userId: `agent:${referral.agentAddress}`,
            suggestionId: `referral_${referral.id}`,
            description: `Referral commission payout for referral ${referral.id}`,
          });
          if (!signerResult.success) throw new Error(signerResult.error || 'Signer rejected');
          txHash = signerResult.txHash;
        } else {
          const transferResult = await agentCore.ERC20.transfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: referral.agentAddress,
            amount: commissionWei,
            privateKey: payoutKey,
            dataSuffix: getAttributionSuffix(),
          });
          txHash = transferResult.hash;
        }

        await db.update(agentReferrals)
          .set({ status: 'paid', payoutTxHash: txHash, updatedAt: new Date() })
          .where(eq(agentReferrals.id, referral.id));

        succeeded++;
        logger.info('Referral payout succeeded', {
          component: 'cron-payout',
          referralId: referral.id,
          agentAddress: referral.agentAddress,
          commissionCusd: referral.commissionCusd,
          txHash,
        });
      } catch (err) {
        failed++;
        logger.error('Referral payout failed', {
          component: 'cron-payout',
          referralId: referral.id,
        }, err);
      }
    }

    const elapsedMs = Date.now() - startTime;
    logger.info('Referral payout cron complete', {
      component: 'cron-payout', processed, succeeded, failed, elapsedMs,
    });

    res.json({ success: true, processed, succeeded, failed, elapsedMs });
  } catch (err) {
    logger.error('Referral payout cron failed', { component: 'cron-payout' }, err);
    res.status(500).json({
      success: false,
      error: err.message?.slice(0, 200) || 'Unknown error',
      processed, succeeded, failed,
    });
  }
});

module.exports = router;
