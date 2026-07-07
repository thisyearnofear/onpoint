/**
 * Agent Try-On Route — /api/agent/try-on
 *
 * The fitting room as a paid capability for external agents. An agent
 * submits its human's photo plus a curator listing and gets back a
 * try-on render and a structured fit signal — so it can answer "will
 * this suit my human?" BEFORE spending on the item.
 *
 * x402 flow (same pattern as POST /api/curator/:slug/order):
 *   1. POST {curatorSlug, listingId, photoData}        → 402 + requirements
 *   2. Agent transfers the cUSD fee to payTo on Celo
 *   3. Re-POST with {paymentTxHash}                    → verify on-chain,
 *      claim tx in the payments ledger, run the try-on  → 200 + render/fit
 *
 * Revenue routing mirrors orders: if the curator has a 0xSplits SplitV2,
 * the fee goes to the Split (curator earns their share of every try-on of
 * their catalog); otherwise it goes to the platform wallet.
 *
 * Auth: none (public, agent-facing) — payment IS the auth.
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, and, ne, sql } = require('drizzle-orm');
const { curators, listings, kitSkus, payments } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { curatorSplitAddress, tryOnPriceCusd } = require('../lib/agent-commerce');
const { getAttributionSuffix, getAttributionCode } = require('../lib/attribution');
const { engine } = require('./ai-virtual-tryon');

const router = express.Router();

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql = null;
let _db = null;

function getDb() {
  if (!_db) {
    if (!CONNECTION_STRING) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(CONNECTION_STRING);
    _db = drizzle(_sql, { schema: { curators, listings, kitSkus, payments } });
  }
  return _db;
}

/** Raw neon SQL tagged template — for queries that drizzle can't express */
function rawSql(strings, ...values) {
  if (!_sql) {
    if (!CONNECTION_STRING) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(CONNECTION_STRING);
  }
  return _sql(strings, ...values);
}

function r2KeyToUrl(key) {
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!key || !base) return null;
  return `${base}/${String(key).replace(/^\/+/, '')}`;
}

/** Person photo must be an inline data URI — agents send it directly. */
function isValidPhotoData(value) {
  return (
    typeof value === 'string' &&
    /^data:image\/(png|jpe?g|webp);base64,/.test(value) &&
    value.length < 8_000_000 // ~6MB image
  );
}

const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];

/**
 * Map the vision model's coarse chest/build reading onto the listing's
 * actually-stocked sizes. Deterministic and honest about uncertainty:
 * returns null rather than guessing when the analysis gives nothing.
 */
function recommendSize(bodyAnalysis, sizes) {
  const inStock = (Array.isArray(sizes) ? sizes : [])
    .filter((entry) => Number(entry.stock) > 0)
    .map((entry) => String(entry.size).toUpperCase());
  if (inStock.length === 0) return null;

  const chest = bodyAnalysis?.measurements?.chest;
  const bodyType = bodyAnalysis?.bodyType;
  let ideal;
  if (chest === 'small') ideal = 'S';
  else if (chest === 'large') ideal = bodyType === 'plus-size' ? 'XL' : 'L';
  else if (chest === 'medium') ideal = 'M';
  else if (bodyType === 'slim') ideal = 'S';
  else if (bodyType === 'plus-size') ideal = 'XL';
  else return null;

  if (inStock.includes(ideal)) return ideal;
  // Nearest stocked size by distance in the size ladder
  const idealIdx = SIZE_ORDER.indexOf(ideal);
  const ranked = inStock
    .filter((s) => SIZE_ORDER.includes(s))
    .sort(
      (a, b) =>
        Math.abs(SIZE_ORDER.indexOf(a) - idealIdx) -
        Math.abs(SIZE_ORDER.indexOf(b) - idealIdx),
    );
  return ranked[0] || null;
}

// ── POST /api/agent/try-on ───────────────────────────────────
router.post('/', async (req, res) => {
  const { curatorSlug, listingId, photoData, personDescription, paymentTxHash } =
    req.body || {};
  const slug = String(curatorSlug || '').toLowerCase();

  if (!/^[a-z0-9-]{2,48}$/.test(slug)) {
    return res.status(400).json({ error: 'curatorSlug is required (valid slug)' });
  }
  if (!listingId || typeof listingId !== 'string') {
    return res.status(400).json({ error: 'listingId is required' });
  }
  if (!isValidPhotoData(photoData)) {
    return res.status(400).json({
      error: 'photoData must be a base64 data URI (image/png, image/jpeg, or image/webp, under ~6MB)',
    });
  }
  if (paymentTxHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(String(paymentTxHash))) {
    return res.status(400).json({ error: 'paymentTxHash must be a 0x-prefixed 32-byte hash' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'agent-tryon' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    // leftJoin kitSkus — digital listings have no SKU
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

    const isDigital = row.listing.inventoryType === 'digital';
    const garmentUrl = r2KeyToUrl(
      row.listing.photoKeys?.[0] || row.kit?.officialImageKey,
    );
    if (!garmentUrl) {
      return res.status(409).json({ error: 'Listing has no garment image to try on' });
    }

    const itemLabel = isDigital
      ? row.listing.title || 'Digital garment'
      : `${row.kit.club} ${row.kit.kitType} kit (${row.kit.season})`;
    const priceCusd = tryOnPriceCusd();
    const splitAddress = curatorSplitAddress(row.curator);
    const payTo = splitAddress || agentCore.PLATFORM_WALLET;
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      priceCusd,
      payTo,
      resourceUrl,
      `OnPoint try-on: ${itemLabel} from ${row.curator.name}`,
    );

    // ── Step 1: no payment proof → 402 challenge ──
    if (!paymentTxHash) {
      return res.status(402).json({
        ...sharedTypes.build402Body([requirements]),
        quote: {
          purpose: 'try_on',
          curatorSlug: slug,
          listingId,
          item: itemLabel,
          priceCusd,
          payTo,
          payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
          token: sharedTypes.X402_ASSET,
          chainId: sharedTypes.X402_CHAIN_ID,
          attribution: {
            code: getAttributionCode(),
            dataSuffix: getAttributionSuffix(),
            instructions: 'Append the dataSuffix to your transfer transaction data to tag it as OnPoint activity on Celo.',
          },
          instructions:
            'Transfer the cUSD fee to payTo on Celo, then re-POST the same body with paymentTxHash.',
        },
      });
    }

    // ── Step 2: verify payment, run try-on, then claim ──
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

    // Pre-check: has this payment tx already been claimed?
    const existing = await db
      .select({ id: payments.id })
      .from(payments)
      .where(eq(payments.txHash, paymentTxHash))
      .limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Payment transaction already used' });
    }

    // Render + fit analysis run concurrently — independent pipelines.
    // We run these BEFORE claiming the payment so that a render failure
    // doesn't burn the agent's payment. The tx is verified but not yet
    // ledgered — if the render fails, the agent can reuse the tx hash
    // for a retry.
    const fitPrompt = `You are an expert fashion stylist. Analyze this person's photo for how a ${itemLabel} would fit and suit them.

Return ONLY valid JSON:
{
  "bodyType": "athletic|slim|average|curvy|plus-size",
  "measurements": { "shoulders": "small|medium|large", "chest": "small|medium|large", "waist": "small|medium|large", "hips": "small|medium|large" },
  "fitRecommendations": ["2-3 specific fit notes for this garment on this person"],
  "styleRecommendations": ["2-3 notes on whether/how this item suits them"],
  "score": 1-10,
  "confidence": 0-1
}`;

    const [render, fitResult] = await Promise.allSettled([
      engine.buildGeneratedOutfitImageResponse({
        data: {
          photoData,
          personDescription: personDescription || '',
          items: [{ name: itemLabel, imageUrl: garmentUrl, description: itemLabel }],
        },
        provider: 'auto',
      }),
      engine
        .generateVisionAnalysis({ prompt: fitPrompt, imageBase64: photoData })
        .then(({ text }) => engine.parseBodyAnalysisResponse(text)),
    ]);

    if (render.status === 'rejected') {
      // Render failed — don't claim the payment. The agent can retry
      // with the same tx hash.
      logger.error(
        'Try-on render failed — payment NOT claimed (agent can retry)',
        { component: 'agent-tryon', listingId, paymentTxHash },
        render.reason,
      );
      return res.status(502).json({
        error: 'Try-on render failed — your payment was not claimed. You can retry with the same paymentTxHash.',
        retryable: true,
      });
    }

    // Render succeeded — now atomically claim the payment.
    const claimed = await db
      .insert(payments)
      .values({
        purpose: 'try_on',
        curatorSlug: slug,
        payerAddress: verification.from,
        amountCusd: priceCusd.toFixed(2),
        txHash: paymentTxHash,
        resource: '/api/agent/try-on',
        metadata: { listingId, item: itemLabel, payTo, splitAddress: splitAddress || null },
      })
      .onConflictDoNothing({ target: payments.txHash })
      .returning({ id: payments.id });

    if (claimed.length === 0) {
      // Race: another request claimed this tx between our pre-check and
      // the render. The render is done but the payment is already used.
      // Return the render anyway — the agent got value.
      logger.warn('Try-on payment claimed by concurrent request during render', {
        component: 'agent-tryon', paymentTxHash, listingId,
      });
      return res.status(409).json({
        error: 'Payment transaction already used by a concurrent request',
        render: { image: render.value.generatedImage, provider: render.value.provider },
      });
    }
    const paymentId = claimed[0].id;

    const fit = fitResult.status === 'fulfilled' ? fitResult.value : null;
    const fitSignal = fit
      ? {
          bodyType: fit.bodyType || null,
          measurements: fit.measurements || null,
          fitRecommendations: fit.fitRecommendations || [],
          styleRecommendations: fit.styleRecommendations || [],
          score: fit.score ?? null,
          confidence: fit.confidence ?? null,
          recommendedSize: recommendSize(fit, row.listing.sizes),
        }
      : null;

    // Verifiable receipt anchored to the payer's own transaction
    let receiptId = null;
    try {
      const receipt = await agentCore.recordReceipt({
        action: 'analyze_outfit',
        sessionId: `tryon_${paymentId}`,
        metadata: {
          purpose: 'try_on',
          curatorSlug: slug,
          listingId,
          item: itemLabel,
          priceCusd,
          payerAddress: verification.from,
          renderProvider: render.value.provider,
        },
        txHash: paymentTxHash,
        chain: 'celo',
      });
      receiptId = receipt.id;
    } catch (receiptErr) {
      logger.warn('Failed to record try-on receipt', { component: 'agent-tryon', paymentId }, receiptErr);
    }

    logger.info('Agent try-on served', {
      component: 'agent-tryon',
      paymentId,
      slug,
      listingId,
      provider: render.value.provider,
      isDigital,
    });

    // For digital listings, find similar physical items from human curators
    // to bridge the digital→physical funnel. Match by tag overlap.
    let similarPhysicalItems = [];
    if (isDigital && row.listing.tags?.length > 0) {
      try {
        const tags = row.listing.tags;
        // Query physical listings from human curators that share tags.
        const matches = await rawSql`
          SELECT l.id, l.curator_slug, l.title, l.photo_keys, l.sizes,
                 c.name AS curator_name
          FROM listings l
          INNER JOIN curators c ON l.curator_slug = c.slug
          WHERE l.inventory_type = 'physical'
            AND l.status = 'live'
            AND c.type = 'human'
            AND l.curator_slug != ${slug}
            AND l.tags && ${tags}
          LIMIT 5
        `;

        similarPhysicalItems = matches.map((m) => ({
          listingId: m.id,
          curatorSlug: m.curator_slug,
          curatorName: m.curator_name,
          title: m.title || `${m.curator_name} listing`,
          imageUrl: r2KeyToUrl(m.photo_keys?.[0]),
          orderUrl: `/api/curator/${m.curator_slug}/order`,
          storefrontUrl: `/api/curator/${m.curator_slug}/storefront`,
        }));
      } catch (matchErr) {
        logger.warn('Failed to find similar physical items', { component: 'agent-tryon', listingId }, matchErr);
      }
    }

    const nextHint = isDigital
      ? similarPhysicalItems.length > 0
        ? `This is a digital design by ${row.curator.name}. Want the real thing? Check similarPhysicalItems for physical listings from human curators, then POST the order endpoint.`
        : `This is a digital design by ${row.curator.name}. Browse the directory for human curators with similar items.`
      : 'Happy with the fit? POST the order endpoint with {listingId, size, quantity} to buy.';

    return res.status(200).json({
      success: true,
      tryOn: {
        item: itemLabel,
        curatorSlug: slug,
        listingId,
        inventoryType: row.listing.inventoryType,
        render: {
          image: render.value.generatedImage,
          provider: render.value.provider,
          imageConditioned: render.value.imageConditioned,
        },
        fitSignal,
        stylingTips: render.value.stylingTips || [],
      },
      payment: {
        id: paymentId,
        txHash: paymentTxHash,
        amountCusd: priceCusd.toFixed(2),
        explorerUrl: agentCore.getExplorerUrl('celo', paymentTxHash),
        payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
      },
      receiptId,
      ...(isDigital ? { similarPhysicalItems } : {}),
      next: isDigital
        ? {
            hint: nextHint,
            directory: '/api/curator/directory',
          }
        : {
            order: `/api/curator/${slug}/order`,
            hint: nextHint,
          },
    });
  } catch (err) {
    logger.error('Agent try-on failed', { component: 'agent-tryon', slug }, err);
    return res.status(500).json({ error: 'Failed to process try-on' });
  }
});

module.exports = router;
module.exports.__test = { isValidPhotoData, recommendSize };
