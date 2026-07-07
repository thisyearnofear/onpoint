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
const { curators, listings, kitSkus, orders } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const {
  kesToCusd,
  curatorPayoutAddress,
  curatorSellerBps,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
} = require('../lib/agent-commerce');

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
  return drizzle(_sql, { schema: { curators, listings, kitSkus, orders } });
}

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

function keyToUrl(key) {
  const url = getPublicR2Url();
  if (!key || !url) return null;
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
      })
      .from(curators)
      .orderBy(desc(curators.createdAt));

    res.json({
      // Expose whether each curator accepts on-chain agent orders, but never
      // the raw commerce config (wallet stays visible only via the 402 flow).
      curators: rows.map(({ commerce, ...row }) => ({
        ...row,
        agentCommerceEnabled: Boolean(curatorPayoutAddress({ commerce })),
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
      .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
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
        const imageKey = listing.photoKeys?.[0] || kit.officialImageKey || null;
        return {
          id: listing.id,
          curatorSlug: listing.curatorSlug,
          skuId: listing.skuId,
          sizes: listing.sizes || [],
          photoKeys: listing.photoKeys || [],
          status: listing.status,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          imageKey,
          imageUrl: keyToUrl(imageKey),
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

  const { listingId, size, paymentTxHash, agentId } = req.body || {};
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
      .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.id, listingId))
      .limit(1);

    if (!row || row.curator.slug !== slug) {
      return res.status(404).json({ error: 'Listing not found for this curator' });
    }
    if (row.listing.status !== 'live') {
      return res.status(409).json({ error: 'Listing is not live' });
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

    const itemLabel = `${row.kit.club} ${row.kit.kitType} (${size}) x${quantity}`;
    const payTo = agentCore.PLATFORM_WALLET;
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      totalCusd,
      payTo,
      resourceUrl,
      `OnPoint order from ${row.curator.name}: ${itemLabel}`,
    );

    // ── Step 1: no payment proof yet → 402 challenge with quote ──
    if (!paymentTxHash) {
      return res.status(402).json({
        ...sharedTypes.build402Body([requirements]),
        quote: {
          curatorSlug: slug,
          listingId,
          size,
          quantity,
          unitCusd,
          totalCusd,
          payTo,
          token: sharedTypes.X402_ASSET,
          chainId: sharedTypes.X402_CHAIN_ID,
          instructions:
            'Transfer the exact cUSD amount to payTo on Celo, then re-POST with paymentTxHash.',
        },
      });
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
      return res.status(409).json({ error: 'Payment transaction already used for an order' });
    }
    const orderId = inserted[0].id;

    // Pay the curator their share (revShare is the platform's fraction)
    const split = agentCore.calculateSplit(minAmountWei, payoutAddress, {
      sellerBps: curatorSellerBps(row.curator),
    });
    const sellerShare = split.recipients.find((r) => r.label === 'seller');

    let payoutTxHash = null;
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

    // Decrement stock
    const updatedSizes = row.listing.sizes.map((entry) =>
      entry.size === size ? { ...entry, stock: Number(entry.stock) - quantity } : entry,
    );
    await db
      .update(listings)
      .set({ sizes: updatedSizes, updatedAt: new Date() })
      .where(eq(listings.id, listingId));

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
            : null,
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
