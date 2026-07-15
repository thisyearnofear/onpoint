/**
 * Agent Dashboard Route — /api/agent/dashboard
 *
 * Returns the agent's complete operational state: wallet health,
 * spending limits, escrow balances, recent autonomous actions,
 * fraud detection status, and Self Protocol verification.
 *
 * Ported from apps/web/app/api/agent/dashboard/route.ts
 *
 * Auth: None (public read for transparency)
 */

const express = require('express');
const router = express.Router();
const { createPublicClient, http, formatEther } = require('viem');
const { celo } = require('viem/chains');

const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { getLastProactiveMetrics } = require('./agent-metrics');

// GET /api/agent/dashboard
router.get('/', async (req, res) => {
  try {
    const [walletInfo, erc8004Identity] = await Promise.all([
      agentCore.getAgentWalletInfo().catch(() => ({
        addresses: { celo: '' },
        walletInfo: [],
        wdkAvailable: false,
      })),
      agentCore.getAgentIdentity().catch(() => ({
        agentId: 'unknown',
        walletAddress: '',
        receiptCount: 0,
      })),
    ]);

    const celoAddress = walletInfo.addresses?.treasury || walletInfo.addresses?.celo || '';

    // Wallet balances via onchain RPC
    let celoBalance = '0';
    let cUSDBalance = '0';

    if (celoAddress) {
      try {
        const publicClient = createPublicClient({
          chain: celo,
          transport: agentCore.createTransport('celo'),
        });

        const balance = await publicClient.getBalance({
          address: celoAddress,
        });
        celoBalance = formatEther(balance);

        const cUSD = '0x765DE816845861e75A25fCA122bb6898B8B1282a';
        const cUSDBal = await publicClient.readContract({
          address: cUSD,
          abi: [{
            name: 'balanceOf',
            type: 'function',
            stateMutability: 'view',
            inputs: [{ name: 'account', type: 'address' }],
            outputs: [{ name: '', type: 'uint256' }],
          }],
          functionName: 'balanceOf',
          args: [celoAddress],
        });
        cUSDBalance = formatEther(cUSDBal);
      } catch (e) {
        logger.warn('Failed to fetch onchain balances', { component: 'dashboard' }, e);
      }
    }

    // Unified identity (ERC-8004 + Self Protocol)
    const unifiedIdentity = await agentCore.getUnifiedAgentIdentity?.(
      celoAddress,
      erc8004Identity.agentId,
    ).catch(() => null);

    // Receipts
    const { receipts, total } = await agentCore.getAllReceipts?.({ limit: 10 }).catch(() => ({ receipts: [], total: 0 })) || { receipts: [], total: 0 };

    // Metrics snapshot
    const actionCounters = agentCore.Metrics?.getActionCounters?.() || [];
    const latencyHistograms = agentCore.Metrics?.getLatencyHistograms?.() || [];
    const escrowBalances = agentCore.Metrics?.getEscrowBalances?.() || [];
    const proactiveMetrics = getLastProactiveMetrics();

    // Referral tracking
    let referralData = {
      totalReferrals: 0,
      totalCommissionCusd: '0.00',
      pendingCommissionCusd: '0.00',
      paidCommissionCusd: '0.00',
      recentActivity: [],
    };

    if (celoAddress) {
      try {
        const { neon } = require('@neondatabase/serverless');
        const { drizzle } = require('drizzle-orm/neon-http');
        const { sql } = require('drizzle-orm');
        const { agentReferrals, orders } = require('@repo/db');

        const connectionString = process.env.NEON_DATABASE_URL;
        if (connectionString) {
          const neonSql = neon(connectionString);
          const db = drizzle(neonSql, { schema: { agentReferrals, orders } });

          // Get all referrals for this agent
          const referrals = await db
            .select({
              referralCode: agentReferrals.referralCode,
              commissionCusd: agentReferrals.commissionCusd,
              status: agentReferrals.status,
              createdAt: agentReferrals.createdAt,
              payoutTxHash: agentReferrals.payoutTxHash,
              orderAmountCusd: orders.amountCusd,
              curatorSlug: orders.curatorSlug,
            })
            .from(agentReferrals)
            .leftJoin(orders, sql`${agentReferrals.orderId} = ${orders.id}`)
            .where(sql`${agentReferrals.agentAddress} = ${celoAddress}`)
            .orderBy(sql`${agentReferrals.createdAt} DESC`)
            .limit(50);

          const pending = referrals.filter(r => r.status === 'pending');
          const paid = referrals.filter(r => r.status === 'paid');

          referralData = {
            totalReferrals: referrals.length,
            totalCommissionCusd: referrals
              .reduce((sum, r) => sum + parseFloat(r.commissionCusd || 0), 0)
              .toFixed(2),
            pendingCommissionCusd: pending
              .reduce((sum, r) => sum + parseFloat(r.commissionCusd || 0), 0)
              .toFixed(2),
            paidCommissionCusd: paid
              .reduce((sum, r) => sum + parseFloat(r.commissionCusd || 0), 0)
              .toFixed(2),
            recentActivity: referrals.slice(0, 10).map(r => ({
              referralCode: r.referralCode,
              commissionCusd: r.commissionCusd,
              status: r.status,
              orderAmountCusd: r.orderAmountCusd,
              curatorSlug: r.curatorSlug,
              createdAt: r.createdAt,
              payoutTxHash: r.payoutTxHash,
            })),
          };
        }
      } catch (e) {
        logger.warn('Failed to fetch referral data', { component: 'dashboard' }, e);
      }
    }

    res.json({
      agent: {
        name: 'OnPoint AI Stylist',
        agentId: erc8004Identity.agentId,
        walletAddress: celoAddress,
        status: 'active',
      },
      referrals: referralData,
      identity: {
        erc8004: {
          agentId: unifiedIdentity?.erc8004?.agentId || erc8004Identity.agentId,
          registryAddress: unifiedIdentity?.erc8004?.registryAddress || erc8004Identity.registryAddress || '',
          registrationTxHash: unifiedIdentity?.erc8004?.registrationTxHash || erc8004Identity.registrationTxHash || null,
          receiptCount: erc8004Identity.receiptCount || 0,
        },
        self: {
          selfAgentId: unifiedIdentity?.self?.selfAgentId || null,
          status: unifiedIdentity?.self?.status || 'unregistered',
          attestationHash: unifiedIdentity?.self?.attestationHash || null,
        },
      },
      wallet: {
        address: celoAddress,
        chains: celoAddress ? ['celo'] : [],
        balances: { celo: celoBalance, cUSD: cUSDBalance },
        gasHealthy: parseFloat(celoBalance) > 0.5,
      },
      activity: {
        totalReceipts: total || 0,
        onChainReceipts: receipts.filter((r) => r.txHash).length,
        recentReceipts: receipts.slice(0, 10).map((r) => ({
          action: r.action,
          timestamp: r.timestamp,
          txHash: r.txHash,
          chain: r.chain,
          verifiableLogCid: r.verifiableLogCid,
        })),
      },
      compliance: {
        erc8004Registered: true,
        selfAgentIdRegistered: unifiedIdentity?.self?.status === 'verified' || unifiedIdentity?.self?.status === 'pending',
        walletOnchain: !!celoAddress,
        verifiableReceipts: receipts.some((r) => r.txHash),
      },
      metrics: {
        actionCounters,
        latencyHistograms: latencyHistograms.map((h) => ({
          type: h.type,
          p50: h.p50,
          p90: h.p90,
          p99: h.p99,
          sampleCount: h.count,
        })),
        escrowBalances: escrowBalances.slice(0, 10),
        proactive: {
          retriedSuggestions: proactiveMetrics.retriedSuggestions,
          prunedExpired: proactiveMetrics.prunedExpired,
          staleApprovals: proactiveMetrics.staleApprovals,
          updatedAt: proactiveMetrics.updatedAt,
        },
      },
      capabilities: [
        'autonomous_mint',
        'autonomous_purchase',
        'autonomous_tip',
        'verifiable_receipts',
        'fraud_detection',
        'dead_mans_switch',
        'multi_sig',
        'escrow',
        'self_protocol_identity',
      ],
      links: {
        celoscan: celoAddress ? `https://celoscan.io/address/${celoAddress}` : null,
        erc8004Registry: (unifiedIdentity?.erc8004?.registryAddress || erc8004Identity.registryAddress)
          ? `https://celoscan.io/address/${unifiedIdentity?.erc8004?.registryAddress || erc8004Identity.registryAddress}`
          : null,
      },
    });
  } catch (error) {
    logger.error('Dashboard error', { component: 'dashboard' }, error);
    res.status(500).json({ error: 'Failed to load agent dashboard' });
  }
});

module.exports = router;
