/**
 * Curator Storefront Route — /api/curator/:slug/storefront
 *
 * Public read endpoint for ADR 0002 storefronts.
 * Returns a Curator profile plus live listings joined to the PL kit backbone.
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, desc, count, sql } = require('drizzle-orm');
const { curators, listings, kitSkus, orders, payments } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const {
  kesToCusd,
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
} = require('../lib/agent-commerce');
const { getAttributionSuffix, getAttributionCode } = require('../lib/attribution');

const router = express.Router();

let _sql = null;
let _connectionString = null;
let _publicR2Url = null;

function getConnectionString() {
  if (!_connectionString) {
    _connectionString = process.env.NEON_DATABASE_URL;
  }
  return _connectionString;
}

function getPublicR2Url() {
  if (!_publicR2Url) {
    _publicR2Url = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  }
  return _publicR2Url;
}

function getDb() {
  if (!_sql) {
    const cs = getConnectionString();
    if (!cs) {
      throw new Error('NEON_DATABASE_URL not configured');
    }
    _sql = neon(cs);
  }
  return drizzle(_sql, { schema: { curators, listings, kitSkus, orders, payments } });
}

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

function keyToUrl(key) {
  if (!key) return null;
  // Full URLs (https://, ipfs://) pass through as-is — used for digital listings
  if (/^(https?:|ipfs:)/.test(key)) return key;
  const url = getPublicR2Url();
  if (!url) return null;
  return `${url}/${String(key).replace(/^\/+/, '')}`;
}

function firstAvailableSize(sizes) {
  if (!Array.isArray(sizes)) return null;
  return sizes.find((item) => Number(item.stock) > 0) || sizes[0] || null;
}

function buildWhatsAppUrl(curator, listing) {
  const phone = curator.channels?.whatsapp;
  if (!phone) return null;

  const size = firstAvailableSize(listing.sizes);
  const template =
    curator.commerce?.whatsappTemplate ||
    "Hi {curator}, I'd like to order the {club} {kit_type} kit in size {size} — KES {price}";

  const text = template
    .replaceAll('{curator}', curator.name)
    .replaceAll('{club}', listing.kit.club)
    .replaceAll('{kit_type}', listing.kit.kitType)
    .replaceAll('{size}', size?.size || '')
    .replaceAll('{price}', size?.price ? String(size.price) : '');

  const printingNote = size?.printingAvailable
    ? `\n\nPlain or printed? If printed, please send the name and number. Printing fee: KES ${size.printingPrice || 0}.`
    : '';

  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(`${text}${printingNote}`)}`;
}

// ── GET /api/curator/directory — public listing of all curators ──
router.get('/directory', async (req, res) => {
  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-storefront' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const rows = await db
      .select({
        slug: curators.slug,
        name: curators.name,
        type: curators.type,
        verticals: curators.verticals,
        brand: curators.brand,
        channels: curators.channels,
        commerce: curators.commerce,
        createdAt: curators.createdAt,
        liveListingCount: sql`(
          SELECT COUNT(*)::int FROM ${listings}
          WHERE ${listings.curatorSlug} = ${curators.slug}
          AND ${listings.status} = 'live'
        )`.as('live_listing_count'),
        digitalListingCount: sql`(
          SELECT COUNT(*)::int FROM ${listings}
          WHERE ${listings.curatorSlug} = ${curators.slug}
          AND ${listings.status} = 'live'
          AND ${listings.inventoryType} = 'digital'
        )`.as('digital_listing_count'),
      })
      .from(curators)
      .orderBy(desc(curators.createdAt));

    res.json({
      // Expose whether each curator accepts on-chain agent orders, but never
      // the raw commerce config (wallet stays visible only via the 402 flow).
      curators: rows.map(({ commerce, ...row }) => ({
        ...row,
        agentCommerceEnabled: Boolean(curatorPayoutAddress({ commerce })),
        // Digital curators offer try-on even without a payout address —
        // the try-on payment goes to the platform wallet or a split.
        digitalTryOnEnabled: row.digitalListingCount > 0,
      })),
      meta: {
        total: rows.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to list curator directory', { component: 'curator-storefront' }, err);
    res.status(500).json({ error: 'Failed to load directory' });
  }
});

router.get('/:slug/storefront', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-storefront' });
    return res.status(503).json({
      error: 'Database not configured',
      message: 'The server is not connected to a database.',
    });
  }

  try {
    const [curatorRow] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, slug))
      .limit(1);

    if (!curatorRow) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    const rows = await db
      .select({
        listing: listings,
        kit: kitSkus,
      })
      .from(listings)
      .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.curatorSlug, slug))
      .orderBy(desc(listings.updatedAt));

    const curator = {
      slug: curatorRow.slug,
      name: curatorRow.name,
      type: curatorRow.type,
      verticals: curatorRow.verticals || [],
      channels: curatorRow.channels || {},
      brand: curatorRow.brand || {},
      commerce: curatorRow.commerce || {},
      createdAt: curatorRow.createdAt,
    };

    const liveListings = rows
      .filter(({ listing }) => listing.status === 'live')
      .map(({ listing, kit }) => {
        const isDigital = listing.inventoryType === 'digital';
        const imageKey = listing.photoKeys?.[0] || kit?.officialImageKey || null;
        return {
          id: listing.id,
          curatorSlug: listing.curatorSlug,
          skuId: listing.skuId,
          inventoryType: listing.inventoryType || 'physical',
          title: listing.title || null,
          tags: listing.tags || [],
          sizes: listing.sizes || [],
          photoKeys: listing.photoKeys || [],
          status: listing.status,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          imageKey,
          imageUrl: keyToUrl(imageKey),
          ...(kit ? {
            kit: {
              id: kit.id,
              club: kit.club,
              season: kit.season,
              kitType: kit.kitType,
              officialImageKey: kit.officialImageKey,
              crestKey: kit.crestKey,
              officialImageUrl: keyToUrl(kit.officialImageKey),
              crestUrl: keyToUrl(kit.crestKey),
            },
          } : {}),
          ...(isDigital ? {
            digital: true,
            tryOnUrl: `/api/agent/try-on`,
          } : {}),
        };
      });

    res.json({
      curator,
      listings: liveListings.map((listing) => ({
        ...listing,
        checkoutUrl:
          curator.commerce?.checkout === 'whatsapp' || curator.channels?.whatsapp
            ? buildWhatsAppUrl(curator, listing)
            : curator.commerce?.checkoutUrl || null,
        agentCommerce: buildListingAgentCommerce(curator, listing),
      })),
      meta: {
        listingCount: liveListings.length,
        checkout: curator.commerce?.checkout || 'whatsapp',
        agentCommerce: buildStorefrontAgentCommerce(curator, slug),
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to load curator storefront', { component: 'curator-storefront', slug }, err);
    res.status(500).json({ error: 'Failed to load storefront' });
  }
});

// ── GET /api/curator/:slug/earnings — public reconciled ledger ──
//
// One query surface for everything the curator has earned, across every
// channel: agent orders (cUSD, on-chain), M-Pesa orders (KES, receipt-
// backed), and try-on fees (cUSD, on-chain). Every line item links to its
// proof — a Celoscan tx or an M-Pesa receipt code. No PII (phone numbers
// stay out of the response).
router.get('/:slug/earnings', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [curatorRow] = await db
      .select({ slug: curators.slug, name: curators.name, commerce: curators.commerce })
      .from(curators)
      .where(eq(curators.slug, slug))
      .limit(1);
    if (!curatorRow) return res.status(404).json({ error: 'Curator not found' });

    const [orderRows, tryOnRows] = await Promise.all([
      db
        .select()
        .from(orders)
        .where(eq(orders.curatorSlug, slug))
        .orderBy(desc(orders.createdAt))
        .limit(200),
      db
        .select()
        .from(payments)
        .where(eq(payments.curatorSlug, slug))
        .orderBy(desc(payments.createdAt))
        .limit(200),
    ]);

    const active = orderRows.filter((o) => o.status !== 'cancelled');
    const agentOrders = active.filter((o) => o.source === 'agent');
    const fiatOrders = active.filter((o) => o.source !== 'agent');

    const sum = (rows, field) =>
      rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);

    const txUrl = (hash) => (hash ? agentCore.getExplorerUrl('celo', hash) : null);

    res.json({
      curator: { slug: curatorRow.slug, name: curatorRow.name },
      payoutModel: curatorSplitAddress(curatorRow) ? '0xSplits (non-custodial)' : 'custodial',
      splitAddress: curatorSplitAddress(curatorRow) || undefined,
      summary: {
        totalOrders: active.length,
        agentOrders: agentOrders.length,
        fiatOrders: fiatOrders.length,
        tryOns: tryOnRows.length,
        gmvCusd: Number(sum(agentOrders, 'amountCusd').toFixed(2)),
        gmvKes: Number(sum(fiatOrders, 'amountKes').toFixed(0)),
        tryOnRevenueCusd: Number(sum(tryOnRows, 'amountCusd').toFixed(2)),
      },
      orders: active.slice(0, 50).map((o) => ({
        id: o.id,
        source: o.source,
        status: o.status,
        size: o.size,
        quantity: o.quantity,
        amountCusd: o.amountCusd || undefined,
        amountKes: o.amountKes || undefined,
        proof:
          o.source === 'agent'
            ? {
                type: 'celo',
                paymentTx: o.paymentTxHash,
                paymentUrl: txUrl(o.paymentTxHash),
                payoutTx: o.payoutTxHash || null,
                payoutUrl: txUrl(o.payoutTxHash),
              }
            : { type: 'mpesa', receipt: o.mpesaReceipt || null },
        createdAt: o.createdAt,
      })),
      tryOns: tryOnRows.slice(0, 50).map((p) => ({
        id: p.id,
        amountCusd: p.amountCusd,
        paymentTx: p.txHash,
        paymentUrl: txUrl(p.txHash),
        createdAt: p.createdAt,
      })),
      meta: { generatedAt: new Date().toISOString() },
    });
  } catch (err) {
    logger.error('Failed to load curator earnings', { component: 'curator-storefront', slug }, err);
    res.status(500).json({ error: 'Failed to load earnings' });
  }
});

// ── POST /api/curator/:slug/order — agent checkout (x402 flow) ──
//
// 1. POST {listingId, size, quantity}            → 402 + PaymentRequirements
// 2. Agent transfers cUSD to payTo on Celo
// 3. POST same body + {paymentTxHash}            → verify on-chain, pay curator
//    their share, create order, record receipt   → 201 + Celoscan links
router.post('/:slug/order', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  const { listingId, size, paymentTxHash, agentId, quoteId: clientQuoteId } = req.body || {};
  const quantity = Number(req.body?.quantity ?? 1);

  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'listingId is required' });
  }
  if (!size || typeof size !== 'string') {
    return res.status(400).json({ error: 'size is required' });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
    return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
  }
  if (paymentTxHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(String(paymentTxHash))) {
    return res.status(400).json({ error: 'paymentTxHash must be a 0x-prefixed 32-byte hash' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-storefront' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const [row] = await db
      .select({ listing: listings, curator: curators, kit: kitSkus })
      .from(listings)
      .innerJoin(curators, eq(listings.curatorSlug, curators.slug))
      .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.id, listingId))
      .limit(1);

    if (!row || row.curator.slug !== slug) {
      return res.status(404).json({ error: 'Listing not found for this curator' });
    }
    if (row.listing.status !== 'live') {
      return res.status(409).json({ error: 'Listing is not live' });
    }
    // Digital listings can't be ordered — they're try-on only.
    // Redirect agents to the try-on endpoint.
    if (row.listing.inventoryType === 'digital') {
      return res.status(409).json({
        error: 'This is a digital listing and cannot be ordered as a physical product.',
        tryOn: {
          url: '/api/agent/try-on',
          method: 'POST',
          body: { curatorSlug: slug, listingId, photoData: '<base64 data URI>' },
          hint: 'Try on this digital design first, then check similarPhysicalItems in the response for physical alternatives from human curators.',
        },
      });
    }

    const payoutAddress = curatorPayoutAddress(row.curator);
    if (!payoutAddress) {
      return res.status(409).json({
        error: 'Curator has no payout wallet configured; agent checkout unavailable',
      });
    }

    const sizeEntry = (row.listing.sizes || []).find((entry) => entry.size === size);
    if (!sizeEntry) {
      return res.status(404).json({ error: `Size not found: ${size}` });
    }
    if (Number(sizeEntry.stock) < quantity) {
      return res.status(409).json({ error: `Insufficient stock for size ${size}` });
    }

    const unitCusd = kesToCusd(sizeEntry.price);
    if (unitCusd === null) {
      return res.status(409).json({ error: 'Listing has no valid price' });
    }
    // Integer cents math — no float drift on quantity multiplication
    const totalCusd = (Math.round(unitCusd * 100) * quantity) / 100;

    const itemLabel = row.kit ? `${row.kit.club} ${row.kit.kitType} (${size}) x${quantity}` : `${row.listing.title || 'Item'} (${size}) x${quantity}`;

    // ── Payment routing ──
    // If the curator has a 0xSplits SplitV2 deployed, the buyer pays the
    // Split contract directly (non-custodial). The Split auto-distributes
    // to curator + platform when `distribute` is called by the worker.
    // Otherwise, fall back to the custodial model: buyer pays the platform
    // wallet, and the API sends a separate payout tx to the curator.
    const splitAddress = curatorSplitAddress(row.curator);
    const usingSplit = Boolean(splitAddress);
    const payTo = splitAddress || agentCore.PLATFORM_WALLET;
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      totalCusd,
      payTo,
      resourceUrl,
      `OnPoint order from ${row.curator.name}: ${itemLabel}`,
    );

    // Deterministic quote ID — same listing+size+quantity+price produces the
    // same ID, so retries after a network blip get the same quote. Includes
    // a timestamp bucket (minute-granularity) so the quote is reproducible
    // within its validity window but rotates over time.
    const QUOTE_TTL_SECONDS = parseInt(process.env.QUOTE_TTL_SECONDS || '900', 10); // 15 min
    const quoteBucket = Math.floor(Date.now() / 1000 / 60); // minute bucket
    const quoteId = `${listingId.slice(0, 8)}-${size}-${quantity}-${quoteBucket}`;
    const quoteExpiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString();

    // ── Step 1: no payment proof yet → 402 challenge with quote ──
    if (!paymentTxHash) {
      return res.status(402).json({
        ...sharedTypes.build402Body([requirements]),
        quote: {
          quoteId,
          quoteExpiresAt,
          curatorSlug: slug,
          listingId,
          size,
          quantity,
          unitCusd,
          totalCusd,
          payTo,
          token: sharedTypes.X402_ASSET,
          chainId: sharedTypes.X402_CHAIN_ID,
          attribution: {
            code: getAttributionCode(),
            dataSuffix: getAttributionSuffix(),
            instructions: 'Append the dataSuffix to your transfer transaction data to tag it as OnPoint activity on Celo.',
          },
          instructions:
            'Transfer the exact cUSD amount to payTo on Celo, then re-POST with paymentTxHash and quoteId.',
        },
      });
    }

    // ── Step 2: payment proof supplied → verify quote, claim, pay out ──

    // Validate quote expiry if the client provides a quoteId
    if (clientQuoteId && typeof clientQuoteId === 'string') {
      const expectedBucket = Math.floor(Date.now() / 1000 / 60);
      const clientBucket = parseInt(clientQuoteId.split('-').pop() || '0', 10);
      const bucketAgeMinutes = expectedBucket - clientBucket;
      if (bucketAgeMinutes > Math.floor(QUOTE_TTL_SECONDS / 60)) {
        return res.status(402).json({
          error: 'Quote has expired — request a new quote',
          code: 'QUOTE_EXPIRED',
          ...sharedTypes.build402Body([requirements]),
        });
      }
    }

    // ── Step 2: payment proof supplied → verify, claim, pay out ──
    const signerClient = agentCore.getSignerClient();
    const payoutKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;
    if (!signerClient && !payoutKey) {
      return res.status(503).json({
        error: 'Curator payout signing not configured. Set SIGNER_URL+SIGNER_API_KEY or AGENT_PRIVATE_KEY.',
        code: 'SIGNING_NOT_CONFIGURED',
      });
    }

    const minAmountWei = BigInt(requirements.maxAmountRequired);
    const verification = await agentCore.ERC20.verifyTransfer({
      chain: 'celo',
      tokenAddress: sharedTypes.X402_ASSET,
      txHash: paymentTxHash,
      to: payTo,
      minAmount: minAmountWei,
    });

    if (!verification.verified) {
      return res.status(402).json({
        error: `Payment not verified: ${verification.reason}`,
        ...sharedTypes.build402Body([requirements]),
      });
    }

    // Claim the payment tx atomically — the unique constraint on
    // payment_tx_hash makes replays and double-payout races impossible.
    const inserted = await db
      .insert(orders)
      .values({
        curatorSlug: slug,
        listingId,
        size,
        quantity,
        amountCusd: totalCusd.toFixed(2),
        buyerAddress: verification.from,
        paymentTxHash,
        source: 'agent',
        status: 'confirmed',
      })
      .onConflictDoNothing({ target: orders.paymentTxHash })
      .returning({ id: orders.id });

    if (inserted.length === 0) {
      // Idempotent retry — the payment tx was already claimed. Return the
      // existing order so the agent doesn't think the retry failed.
      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.paymentTxHash, paymentTxHash))
        .limit(1);
      if (existing) {
        return res.status(200).json({
          success: true,
          idempotent: true,
          order: {
            id: existing.id,
            curatorSlug: existing.curatorSlug,
            listingId: existing.listingId,
            size: existing.size,
            quantity: existing.quantity,
            totalCusd: existing.amountCusd,
            status: existing.status,
            payment: { txHash: existing.paymentTxHash },
            payout: existing.payoutTxHash
              ? { txHash: existing.payoutTxHash }
              : { status: 'pending' },
          },
        });
      }
      return res.status(409).json({ error: 'Payment transaction already used for an order' });
    }
    const orderId = inserted[0].id;

    // Decrement stock atomically — prevents oversell on concurrent orders.
    // Uses a single UPDATE with a WHERE guard on the JSONB stock field.
    // Done BEFORE payout so a stock race doesn't pay a curator for items
    // that can't be fulfilled.
    const stockResult = await db.execute(sql`
      WITH target AS (
        SELECT idx, (elem->>'stock')::int AS current_stock
        FROM ${listings}, jsonb_array_elements(sizes) WITH ORDINALITY AS t(elem, idx)
        WHERE ${listings.id} = ${listingId} AND elem->>'size' = ${size}
      )
      UPDATE ${listings}
      SET sizes = jsonb_set(
        sizes,
        ARRAY[(SELECT idx FROM target)],
        to_jsonb((SELECT current_stock FROM target) - ${quantity}),
        true
      ),
      updated_at = now()
      WHERE ${listings.id} = ${listingId}
        AND (SELECT current_stock FROM target) >= ${quantity}
      RETURNING id
    `);

    if (stockResult.rows.length === 0) {
      // Stock was sufficient at quote time but not at confirmation —
      // another order won the race. The buyer's cUSD is in the agent
      // wallet; mark the order as cancelled so the payout retry worker
      // can issue a refund.
      await db.update(orders).set({ status: 'cancelled' }).where(eq(orders.id, orderId));
      logger.warn('Stock race lost — order cancelled, buyer needs refund', {
        component: 'curator-storefront', slug, orderId, size, quantity,
      });
      return res.status(409).json({
        error: 'Insufficient stock — another order claimed the last units',
        code: 'STOCK_RACE',
        orderId,
        refundNote: 'Your payment was received; a refund will be issued automatically.',
      });
    }

    // ── Curator payout ──
    // When using a 0xSplits SplitV2, the buyer's payment goes directly
    // to the Split contract. No separate payout tx is needed — the
    // worker calls `distribute` on the Split to release funds to the
    // curator and platform. We record the split address as the payout
    // destination for the receipt.
    //
    // When NOT using a split (fallback custodial model), the API sends
    // a separate cUSD transfer from the agent wallet to the curator.
    let payoutTxHash = null;
    let sellerShare = null;

    if (usingSplit) {
      // Non-custodial: funds are in the Split contract, pending distribution.
      // The payout_tx_hash will be set when the worker calls distribute.
      payoutTxHash = null; // explicitly null — distribution happens async
      logger.info('Order paid to Split contract — distribution pending', {
        component: 'curator-storefront', slug, orderId, splitAddress,
      });
    } else {
      // Custodial fallback: send curator their share from the agent wallet
      const split = agentCore.calculateSplit(minAmountWei, payoutAddress, {
        sellerBps: curatorSellerBps(row.curator),
      });
      sellerShare = split.recipients.find((r) => r.label === 'seller');

      try {
        if (signerClient) {
          const signerResult = await signerClient.signTransfer({
            chain: 'celo',
            tokenAddress: sharedTypes.X402_ASSET,
            to: payoutAddress,
            amountWei: sellerShare.amount.toString(),
            action: 'purchase',
            agentId: agentId || 'external-agent',
            userId: `curator:${slug}`,
            suggestionId: `order_${orderId}`,
            description: `Curator payout for ${itemLabel}`,
          });
          if (!signerResult.success) throw new Error(signerResult.error || 'Signer rejected payout');
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
        await db.update(orders).set({ payoutTxHash }).where(eq(orders.id, orderId));
      } catch (payoutErr) {
        // Order stands (buyer paid, stock reserved); payout retried operationally.
        logger.error(
          'Curator payout failed — order confirmed, payout pending',
          { component: 'curator-storefront', slug, orderId },
          payoutErr,
        );
      }
    }

    // Verifiable receipt — anchored to the buyer's own payment transaction
    let receiptId = null;
    try {
      const receipt = await agentCore.recordReceipt({
        action: 'purchase',
        sessionId: `order_${orderId}`,
        metadata: {
          orderId,
          curatorSlug: slug,
          listingId,
          item: itemLabel,
          totalCusd,
          buyerAddress: verification.from,
          payoutTxHash,
          curatorPayout: sellerShare
            ? `${(Number(sellerShare.amount) / 1e18).toFixed(2)} cUSD`
            : usingSplit
              ? `${totalCusd.toFixed(2)} cUSD via Split (pending distribution)`
              : null,
          splitAddress: usingSplit ? splitAddress : undefined,
        },
        txHash: paymentTxHash,
        chain: 'celo',
      });
      receiptId = receipt.id;
    } catch (receiptErr) {
      logger.warn('Failed to record order receipt', { component: 'curator-storefront', orderId }, receiptErr);
    }

    logger.info('Agent order confirmed', {
      component: 'curator-storefront',
      slug,
      orderId,
      totalCusd: String(totalCusd),
      payoutTxHash,
      usingSplit,
      splitAddress: usingSplit ? splitAddress : undefined,
    });

    return res.status(201).json({
      success: true,
      order: {
        id: orderId,
        curatorSlug: slug,
        listingId,
        item: itemLabel,
        size,
        quantity,
        totalCusd,
        status: 'confirmed',
        payment: {
          txHash: paymentTxHash,
          from: verification.from,
          explorerUrl: agentCore.getExplorerUrl('celo', paymentTxHash),
        },
        payout: payoutTxHash
          ? {
              txHash: payoutTxHash,
              to: payoutAddress,
              amountCusd: (Number(sellerShare.amount) / 1e18).toFixed(2),
              explorerUrl: agentCore.getExplorerUrl('celo', payoutTxHash),
            }
          : usingSplit
            ? {
                status: 'pending_distribution',
                to: splitAddress,
                type: '0xSplits',
                note: 'Funds held non-custodially in Split contract; distribution is automatic.',
              }
            : { status: 'pending', to: payoutAddress },
        receiptId,
      },
    });
  } catch (err) {
    logger.error('Agent order failed', { component: 'curator-storefront', slug }, err);
    return res.status(500).json({ error: 'Failed to process order' });
  }
});

module.exports = router;
module.exports.__test = {
  isValidSlug,
  firstAvailableSize,
  buildWhatsAppUrl,
  keyToUrl,
  reset() {
    _sql = null;
    _connectionString = null;
    _publicR2Url = null;
  },
};
