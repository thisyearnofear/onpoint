/**
 * Curator Storefront Route — /api/curator/:slug/storefront
 *
 * Public read endpoint for ADR 0002 storefronts.
 * Returns a Curator profile plus live listings joined to the PL kit backbone.
 *
 * @typedef {import('express').Request} ExpressRequest
 * @typedef {import('express').Response} ExpressResponse
 * @typedef {import('@onpoint/shared-types').CuratorStorefrontResponse} CuratorStorefrontResponse
 * @typedef {import('@onpoint/shared-types').Curator} Curator
 * @typedef {import('@onpoint/shared-types').Listing} Listing
 */

const express = require('express');
const { eq, desc, count, sql, and, inArray } = require('drizzle-orm');
const { curators, listings, kitSkus, orders, payments, agentLooks } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { getDb } = require('../lib/db');
const { isValidSlug } = require('../lib/slugs');
const { keyToUrl } = require('../lib/r2');
const {
  kesToCusd,
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  buildListingAgentCommerce,
  evaluateTrustedOffer,
  offerFreshnessMaxDays,
  normalizeSize,
  buildStorefrontAgentCommerce,
  storefrontWebUrl,
  webBaseUrl,
  buildRevenueHint,
} = require('../lib/agent-commerce');
const { getAttributionSuffix, getAttributionCode, getAssignedTag } = require('../lib/attribution');
const { logFunnelEvent } = require('../lib/funnel');
const { getPlatformWallet } = require('../lib/wallets');
const {
  paymentMethodForOrder,
  paymentAssetForOrder,
} = require('../lib/order-refunds');

const router = express.Router();

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
    db = getDb({ curators, listings, kitSkus, orders, payments });
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
        physicalListingCount: sql`(
          SELECT COUNT(*)::int FROM ${listings}
          WHERE ${listings.curatorSlug} = ${curators.slug}
          AND ${listings.status} = 'live'
          AND (${listings.inventoryType} IS DISTINCT FROM 'digital')
        )`.as('physical_listing_count'),
        trustedPhysicalListingCount: sql`(
          SELECT COUNT(*)::int
          FROM ${listings}
          LEFT JOIN ${kitSkus} ON ${listings.skuId} = ${kitSkus.id}
          WHERE ${listings.curatorSlug} = ${curators.slug}
          AND ${listings.status} = 'live'
          AND (${listings.inventoryType} IS DISTINCT FROM 'digital')
          AND ${listings.lastVerifiedAt} >= now() - (${offerFreshnessMaxDays()} * interval '1 day')
          AND ${listings.lastVerifiedAt} <= now()
          AND (${listings.skuId} IS NOT NULL OR NULLIF(${listings.title}, '') IS NOT NULL)
          AND (
            COALESCE(cardinality(${listings.photoKeys}), 0) > 0
            OR ${kitSkus.officialImageKey} IS NOT NULL
          )
          AND EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(${listings.sizes}) = 'array' THEN ${listings.sizes}
                ELSE '[]'::jsonb
              END
            ) AS size_entry
            WHERE NULLIF(btrim(size_entry->>'size'), '') IS NOT NULL
            AND CASE
            WHEN (size_entry->>'stock') ~ '^[0-9]+$'
            THEN (size_entry->>'stock')::numeric > 0
              ELSE false
            END
            AND CASE
              WHEN (size_entry->>'price') ~ '^-?([0-9]+(\\.[0-9]+)?|\\.[0-9]+)$'
              THEN (size_entry->>'price')::numeric > 0
              ELSE false
            END
          )
          AND NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements(
              CASE
                WHEN jsonb_typeof(${listings.sizes}) = 'array' THEN ${listings.sizes}
                ELSE '[]'::jsonb
              END
            ) WITH ORDINALITY AS first_size(entry, first_idx)
            WHERE NULLIF(btrim(first_size.entry->>'size'), '') IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(
                CASE
                  WHEN jsonb_typeof(${listings.sizes}) = 'array' THEN ${listings.sizes}
                  ELSE '[]'::jsonb
                END
              ) WITH ORDINALITY AS second_size(entry, second_idx)
              WHERE second_size.second_idx > first_size.first_idx
              AND lower(btrim(second_size.entry->>'size')) = lower(btrim(first_size.entry->>'size'))
            )
          )
        )`.as('trusted_physical_listing_count'),
      })
      .from(curators)
      .orderBy(desc(curators.createdAt));

    const onlyPurchasable = String(req.query.agentPurchasable || '') === '1'
      || String(req.query.agentPurchasable || '').toLowerCase() === 'true';

    // By default, the agent-facing directory only shows curators that are
    // either purchasable (wallet + physical listings) or have digital try-on
    // capability. Human curators without wallets are hidden — they can't be
    // purchased from and their income would go to the platform wallet, which
    // defeats the self-custodial infrastructure. Use ?includeInactive=1 for
    // admin/internal views that need to see all curators.
    const includeInactive = String(req.query.includeInactive || '') === '1'
      || String(req.query.includeInactive || '').toLowerCase() === 'true';

    const mapped = rows.map(({ commerce, ...row }) => {
      const hasWallet = Boolean(curatorPayoutAddress({ commerce }));
      const physicalListingCount = Number(row.physicalListingCount) || 0;
      const trustedPhysicalListingCount = Number(row.trustedPhysicalListingCount) || 0;
      const activatedAt = commerce?.activatedAt;
      return {
        ...row,
        physicalListingCount,
        trustedPhysicalListingCount,
        activatedAt,
        // Backward-compatible: wallet configured (may still have zero offers).
        agentCommerceEnabled: hasWallet,
        // Trusted execution gate: wallet + at least one fresh, valid,
        // media-backed physical offer. Legacy physical counts remain visible
        // separately for operators but do not advertise checkout readiness.
        agentPurchasable: hasWallet && trustedPhysicalListingCount > 0,
        digitalTryOnEnabled: row.digitalListingCount > 0,
      };
    });

    // Filter: show only curators that agents can actually transact with.
    // AI curators are always visible (platform-owned by design).
    // Human curators need activatedAt (self-served) to be visible.
    const agentVisible = (c) => {
      if (c.type === 'ai') return c.agentPurchasable || c.digitalTryOnEnabled;
      return c.activatedAt && (c.agentPurchasable || c.digitalTryOnEnabled);
    };

    const curatorsOut = onlyPurchasable
      ? mapped.filter((c) => c.agentPurchasable)
      : includeInactive
        ? mapped
        : mapped.filter(agentVisible);

    // Count inactive curators (without wallets) for nudge messaging
    const inactiveCount = mapped.filter((c) => !c.agentPurchasable && !c.digitalTryOnEnabled).length;
    const activeCount = mapped.filter(agentVisible).length;

    res.json({
      curators: curatorsOut,
      meta: {
        total: curatorsOut.length,
        agentPurchasableCount: mapped.filter((c) => c.agentPurchasable).length,
        agentCommerceEnabledCount: mapped.filter((c) => c.agentCommerceEnabled).length,
        digitalTryOnCount: mapped.filter((c) => c.digitalTryOnEnabled).length,
        activeStorefronts: activeCount,
        inactiveCurators: inactiveCount,
        betaSpotsRemaining: Math.max(0, 25 - activeCount),
        generatedAt: new Date().toISOString(),
        filter: onlyPurchasable ? 'agentPurchasable' : includeInactive ? null : 'agentVisible',
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
    db = getDb({ curators, listings, kitSkus, orders, payments, agentLooks });
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
      linkedAgentAddress: curatorRow.linkedAgentAddress || null,
      createdAt: curatorRow.createdAt,
    };

    const liveListings = rows
      .filter(({ listing }) => listing.status === 'live')
      .map(({ listing, kit }) => {
        const offerListing = { ...listing, kit };
        const isDigital = listing.inventoryType === 'digital';
        const imageKey = listing.photoKeys?.[0] || kit?.officialImageKey || null;
        const trustedOffer = evaluateTrustedOffer(curator, offerListing);
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
          // Cutout URL — cached background-removed version if available.
          // Frontend should use this with fallback to imageUrl.
          cutoutUrl: keyToUrl(`listings/${listing.id}/cutout.png`),
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
          agentCommerce: buildListingAgentCommerce(curator, offerListing),
          trustedOffer,
        };
      });

    // ── Fetch live looks for this curator (10 most recent) ──
    const lookRows = await db
      .select({
        slug: agentLooks.slug,
        title: agentLooks.title,
        description: agentLooks.description,
        coverImageKey: agentLooks.coverImageKey,
        tags: agentLooks.tags,
        metadata: agentLooks.metadata,
        tryOnCount: agentLooks.tryOnCount,
        shareCount: agentLooks.shareCount,
        listingIds: agentLooks.listingIds,
        heroListingId: agentLooks.heroListingId,
      })
      .from(agentLooks)
      .where(and(eq(agentLooks.curatorSlug, slug), eq(agentLooks.status, 'live')))
      .orderBy(desc(agentLooks.createdAt))
      .limit(10);

    // Resolve hero listing images so the storefront can render look thumbnails
    const heroListingIds = [...new Set(lookRows.map((l) => l.heroListingId).filter(Boolean))];
    let heroImageMap = new Map();
    if (heroListingIds.length > 0) {
      const heroRows = await db
        .select({ listing: listings, kit: kitSkus })
        .from(listings)
        .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
        .where(inArray(listings.id, heroListingIds));
      for (const { listing, kit } of heroRows) {
        const imageKey = listing.photoKeys?.[0] || kit?.officialImageKey || null;
        heroImageMap.set(listing.id, keyToUrl(imageKey));
      }
    }

    const looks = lookRows.map((look) => ({
      slug: look.slug,
      title: look.title,
      description: look.description,
      coverImageUrl: look.coverImageKey ? keyToUrl(look.coverImageKey) : null,
      collageUrl: keyToUrl(`looks/${look.slug}/collage-latest.webp`),
      heroImageUrl: look.heroListingId ? (heroImageMap.get(look.heroListingId) || null) : null,
      tags: look.tags || [],
      metadata: look.metadata || {},
      tryOnCount: look.tryOnCount || 0,
      shareCount: look.shareCount || 0,
      itemCount: (look.listingIds || []).length,
    }));

    res.json({
      curator,
      webUrl: storefrontWebUrl(slug),
      listings: liveListings.map((listing) => ({
        ...listing,
        checkoutUrl:
          curator.commerce?.checkout === 'whatsapp' || curator.channels?.whatsapp
            ? buildWhatsAppUrl(curator, listing)
            : curator.commerce?.checkoutUrl || null,
      })),
      looks,
      meta: {
        listingCount: liveListings.length,
        lookCount: looks.length,
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
    db = getDb({ curators, listings, kitSkus, orders, payments });
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
    db = getDb({ curators, listings, kitSkus, orders, payments });
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

    const trustedOffer = evaluateTrustedOffer(row.curator, { ...row.listing, kit: row.kit });
    if (!trustedOffer.readiness) {
      return res.status(409).json({
        error: 'Listing is not ready for agent purchase',
        code: 'OFFER_NOT_READY',
        trustedOffer,
      });
    }

    const payoutAddress = curatorPayoutAddress(row.curator);
    if (!payoutAddress) {
      return res.status(409).json({
        error: 'Curator has no payout wallet configured; agent checkout unavailable',
      });
    }

    const requestedSize = normalizeSize(size);
    const sizeEntry = (row.listing.sizes || []).find(
      (entry) => normalizeSize(entry.size) === requestedSize,
    );
    if (!sizeEntry) {
      return res.status(404).json({ error: `Size not found: ${requestedSize}` });
    }
    if (Number(sizeEntry.stock) < quantity) {
      return res.status(409).json({ error: `Insufficient stock for size ${requestedSize}` });
    }

    const unitCusd = kesToCusd(sizeEntry.price);
    if (unitCusd === null) {
      return res.status(409).json({ error: 'Listing has no valid price' });
    }
    // Integer cents math — no float drift on quantity multiplication
    const totalCusd = (Math.round(unitCusd * 100) * quantity) / 100;

    const itemLabel = row.kit
      ? `${row.kit.club} ${row.kit.kitType} (${requestedSize}) x${quantity}`
      : `${row.listing.title || 'Item'} (${requestedSize}) x${quantity}`;

    // ── Referral tracking ──
    // Extract referral code from request (header or query param)
    const referralCode = req.headers['x-referral-code'] || req.query.referral;

    // ── Payment routing ──
    // If the curator has a 0xSplits SplitV2 deployed, the buyer pays the
    // Split contract directly (non-custodial). The Split auto-distributes
    // to curator + platform when `distribute` is called by the worker.
    // Otherwise, fall back to the custodial model: buyer pays the platform
    // wallet, and the API sends a separate payout tx to the curator.
    const splitAddress = curatorSplitAddress(row.curator);
    const usingSplit = Boolean(splitAddress);
    const payTo = splitAddress || getPlatformWallet();
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      totalCusd,
      payTo,
      resourceUrl,
      `OnPoint order from ${row.curator.name}: ${itemLabel}`,
    );

    const xPaymentHeader = req.headers['x-payment'];

    // Deterministic quote ID — same listing+size+quantity+price produces the
    // same ID, so retries after a network blip get the same quote. Includes
    // a timestamp bucket (minute-granularity) so the quote is reproducible
    // within its validity window but rotates over time.
    const QUOTE_TTL_SECONDS = parseInt(process.env.QUOTE_TTL_SECONDS || '900', 10); // 15 min
    const quoteBucket = Math.floor(Date.now() / 1000 / 60); // minute bucket
    const quoteId = `${listingId.slice(0, 8)}-${requestedSize}-${quantity}-${quoteBucket}`;
    const quoteExpiresAt = new Date(Date.now() + QUOTE_TTL_SECONDS * 1000).toISOString();

    // ── Step 1: no payment proof yet → 402 challenge with quote ──
    if (!paymentTxHash && !xPaymentHeader) {
      return res.status(402).json({
        ...sharedTypes.build402Body([requirements]),
        quote: {
          quoteId,
          quoteExpiresAt,
          curatorSlug: slug,
          listingId,
          size: requestedSize,
          quantity,
          unitCusd,
          totalCusd,
          payTo,
          token: sharedTypes.X402_ASSET,
          chainId: sharedTypes.X402_CHAIN_ID,
          attribution: {
            code: getAttributionCode(),
            assignedTag: getAssignedTag(),
            dataSuffix: getAttributionSuffix(),
            instructions: 'Append the dataSuffix to your transfer transaction data to tag it as OnPoint activity on Celo.',
          },
          instructions:
            'Transfer the exact cUSD amount to payTo on Celo, then re-POST with paymentTxHash and quoteId.',
        },
        revenueHint: buildRevenueHint('order', { totalCusd, curator: row.curator }),
      });
    }

    // ── Step 2: payment proof supplied → verify quote, claim, pay out ──
    // USDC facilitator checkout is intentionally disabled for orders until
    // the treasury has an explicit conversion/liquidity policy.
    if (xPaymentHeader) {
      return res.status(409).json({
        error: 'USDC facilitator checkout is temporarily unavailable for orders; use the cUSD payment path.',
        code: 'PAYMENT_RAIL_UNAVAILABLE',
      });
    }

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

    // ── Step 2c: verify cUSD payment ──
    const signerClient = agentCore.getSignerClient();
    const payoutKey = !signerClient ? process.env.AGENT_PRIVATE_KEY : null;
    if (!signerClient && !payoutKey) {
      return res.status(503).json({
        error: 'Curator payout signing not configured. Set SIGNER_URL+SIGNER_API_KEY or AGENT_PRIVATE_KEY.',
        code: 'SIGNING_NOT_CONFIGURED',
      });
    }

    let verification = null;
    {
      const minAmountWei = BigInt(requirements.maxAmountRequired);
      verification = await agentCore.ERC20.verifyTransfer({
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
    }

    // The effective tx hash and payer for this request
    const effectiveTxHash = paymentTxHash;
    const effectivePayer = verification.from;
    const paymentMethod = paymentMethodForOrder({ usingSplit, settlementTxHash: null });
    const paymentAsset = paymentAssetForOrder({
      usingSplit,
      settlementTxHash: null,
      cusdAsset: sharedTypes.X402_ASSET,
      usdcAsset: null,
    });

    // Claim the verified payment before touching inventory. Neon HTTP does not
    // provide an interactive transaction, so the order stays pending until
    // the guarded stock update succeeds; a retry cannot claim the same tx a
    // second time, and cron quarantines stale pending claims for recovery.
    const inserted = await db
      .insert(orders)
      .values({
        curatorSlug: slug,
        listingId,
        size: requestedSize,
        quantity,
        amountCusd: totalCusd.toFixed(2),
        buyerAddress: effectivePayer,
        paymentTxHash: effectiveTxHash,
        paymentMethod,
        paymentAsset,
        source: 'agent',
        status: 'pending',
        referralCode: referralCode || null,
      })
      .onConflictDoNothing({ target: orders.paymentTxHash })
      .returning({ id: orders.id });

    if (inserted.length === 0) {
      const [existing] = await db
        .select()
        .from(orders)
        .where(eq(orders.paymentTxHash, effectiveTxHash))
        .limit(1);
      if (existing) {
        return res.status(existing.status === 'pending' ? 202 : 200).json({
          success: true,
          idempotent: true,
          pending: existing.status === 'pending',
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
    // This is a single guarded UPDATE; the database re-evaluates the JSONB
    // stock value while acquiring the listing row lock.
    const stockResult = await db.execute(sql`
      UPDATE ${listings} AS inventory
      SET sizes = (
        SELECT jsonb_agg(
          CASE
            WHEN btrim(size_entry->>'size') = ${requestedSize}
            THEN jsonb_set(
              size_entry,
              '{stock}',
              to_jsonb((size_entry->>'stock')::int - ${quantity}),
              true
            )
            ELSE size_entry
          END
          ORDER BY ordinal
        )
        FROM jsonb_array_elements(
          CASE
            WHEN jsonb_typeof(inventory.sizes) = 'array' THEN inventory.sizes
            ELSE '[]'::jsonb
          END
        ) WITH ORDINALITY AS entries(size_entry, ordinal)
      ),
      updated_at = now(),
      last_verified_at = now()
      WHERE inventory.id = ${listingId}
        AND EXISTS (
          SELECT 1
          FROM jsonb_array_elements(
            CASE
              WHEN jsonb_typeof(inventory.sizes) = 'array' THEN inventory.sizes
              ELSE '[]'::jsonb
            END
          ) AS entries(size_entry)
          WHERE btrim(size_entry->>'size') = ${requestedSize}
            AND (size_entry->>'stock') ~ '^[0-9]+$'
            AND (size_entry->>'stock')::int >= ${quantity}
        )
      RETURNING inventory.id
    `);

    if (stockResult.rows.length === 0) {
      const refundStatus = paymentMethod === 'cusd' && /^0x[0-9a-fA-F]{40}$/.test(String(effectivePayer || ''))
        ? 'pending'
        : 'manual_review';
      await db.update(orders).set({
        status: 'cancelled',
        refundStatus,
        refundLastError: refundStatus === 'manual_review'
          ? `Automatic refund unavailable for payment method: ${paymentMethod}`
          : null,
        updatedAt: new Date(),
      }).where(and(eq(orders.id, orderId), eq(orders.status, 'pending')));
      logger.warn('Stock race lost — order cancelled, refund recovery queued', {
        component: 'curator-storefront', slug, orderId, size: requestedSize, quantity,
      });
      return res.status(409).json({
        error: 'Insufficient stock — another order claimed the last units',
        code: 'STOCK_RACE',
        orderId,
        refundNote: refundStatus === 'pending'
          ? 'Your cUSD payment was received; an automatic refund has been queued.'
          : 'Your payment was received; this payment rail requires operator reconciliation before refund.',
        refundStatus,
      });
    }

    const [confirmedOrder] = await db.update(orders).set({
      status: 'confirmed',
      updatedAt: new Date(),
    }).where(and(eq(orders.id, orderId), eq(orders.status, 'pending'))).returning({ id: orders.id });
    if (!confirmedOrder) {
      return res.status(202).json({
        success: true,
        pending: true,
        orderId,
        status: 'pending',
        note: 'Payment is claimed and stock was reserved; order confirmation is pending reconciliation.',
      });
    }

    // ── Referral tracking ──
    // If a referral code was provided, create an agent_referrals record
    // to track the 2.5% commission owed to the referring agent.
    if (referralCode) {
      try {
        // Look up the agent address from the referral code
        const [referralRecord] = await db.execute(sql`
          SELECT agent_address FROM agent_referrals 
          WHERE referral_code = ${referralCode} 
          LIMIT 1
        `);
        
        const agentAddress = referralRecord?.agent_address || referralCode;
        const commissionCusd = (totalCusd * 0.025).toFixed(4); // 2.5% commission
        
        await db.execute(sql`
          INSERT INTO agent_referrals (agent_address, referral_code, order_id, commission_cusd, status)
          VALUES (${agentAddress}, ${referralCode}, ${orderId}, ${commissionCusd}, 'pending')
        `);
        
        logger.info('Referral commission recorded', {
          component: 'curator-storefront',
          orderId,
          agentAddress,
          referralCode,
          commissionCusd,
        });
      } catch (referralErr) {
        // Don't fail the order if referral tracking fails
        logger.warn('Failed to record referral', { component: 'curator-storefront', orderId, referralCode }, referralErr);
      }
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
      const minAmountWei = BigInt(requirements.maxAmountRequired);
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
          buyerAddress: effectivePayer,
          payoutTxHash,
          paymentMethod,
          curatorPayout: sellerShare
            ? `${(Number(sellerShare.amount) / 1e18).toFixed(2)} cUSD`
            : usingSplit
              ? `${totalCusd.toFixed(2)} cUSD via Split (pending distribution)`
              : null,
          splitAddress: usingSplit ? splitAddress : undefined,
        },
        txHash: effectiveTxHash,
        chain: 'celo',
      });
      receiptId = receipt.id;
    } catch (receiptErr) {
      logger.warn('Failed to record order receipt', { component: 'curator-storefront', orderId }, receiptErr);
    }

    const { classifyAgentCaller, recordAgentDemand } = require('../lib/agent-demand');
    const caller = classifyAgentCaller(effectivePayer);
    recordAgentDemand('order', caller, 'succeeded');

    logger.info('Agent order confirmed', {
      component: 'curator-storefront',
      slug,
      orderId,
      totalCusd: String(totalCusd),
      payoutTxHash,
      usingSplit,
      splitAddress: usingSplit ? splitAddress : undefined,
      caller,
      buyerAddress: effectivePayer,
      paymentMethod,
    });

    // Log funnel event: purchase (the conversion event)
    logFunnelEvent(db, {
      eventType: 'purchase',
      source: 'agent',
      tier: 'paid',
      curatorSlug: slug,
      listingId,
      payerAddress: effectivePayer,
      revenueUsd: totalCusd.toFixed(4),
      metadata: {
        orderId,
        size: requestedSize,
        quantity,
        usingSplit,
        referralCode: referralCode || null,
      },
      clientIp: req.ip,
    });

    return res.status(201).json({
      success: true,
      order: {
        id: orderId,
        curatorSlug: slug,
        listingId,
        item: itemLabel,
        size: requestedSize,
        quantity,
        totalCusd,
        status: 'confirmed',
        payment: {
          txHash: effectiveTxHash,
          from: effectivePayer,
          explorerUrl: agentCore.getExplorerUrl('celo', effectiveTxHash),
          paymentMethod,
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
        receiptUrl: receiptId ? `${webBaseUrl()}/receipt/${receiptId}` : undefined,
        storefrontUrl: storefrontWebUrl(slug),
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
    // DB/R2 state now managed by shared lib modules — no local state to reset.
  },
};
