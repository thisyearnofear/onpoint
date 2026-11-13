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
const crypto = require('crypto');
const { eq, and, ne, sql, inArray } = require('drizzle-orm');
const { curators, listings, kitSkus, payments } = require('@repo/db');
const sharedTypes = require('@onpoint/shared-types');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');
const { curatorSplitAddress, curatorSellerBps, tryOnPriceCusd, storefrontWebUrl, polaroidWebUrl, webBaseUrl, buildRevenueHint } = require('../lib/agent-commerce');
const nearPayments = require('../lib/near-payments');
const nearIntents = require('../lib/near-intents');
const intentMailbox = require('../lib/intent-mailbox');
const paypalPayments = require('../lib/paypal-payments');
const { getAttributionSuffix, getAttributionCode, getAssignedTag } = require('../lib/attribution');
const { engine } = require('./ai-virtual-tryon');
const { upload: r2Upload, publicUrl: r2PublicUrl, keyFor: r2KeyFor, mirrorTryOnArtifact: ossMirror, isOssConfigured: ossConfigured } = require('@repo/storage');
const { logFunnelEvent } = require('../lib/funnel');
const { sanitizeShareId } = require('../lib/share-attribution');
const { getDb, getSql } = require('../lib/db');
const { acquireTryOnClaim, createDrizzleClaimStore } = require('../lib/tryon-payment-claims');
const { keyToUrl, listingImageUrl } = require('../lib/r2');
const { getPlatformWallet } = require('../lib/wallets');

const router = express.Router();

// ── Render cache: avoid duplicate paid render calls (YouCam/Replicate) ──
// for the same (photo + listing). TTL: 1 hour. Value: the render image,
// cached only as a persistent artifact (R2 URL or inline data URI) so a
// cached entry never points at an expiring provider URL.
//
// Redis-backed (lib/cache.js) so the cache survives restarts and is shared
// across instances — critical on serverless / multi-instance deploys where
// a per-process Map would silently re-run paid ($0.03–$0.05) render calls
// for the same photo. When Redis is unavailable the cache misses and the
// try-on still runs (correctness is preserved; only the cost saving is lost).
const { cacheGet, cacheSet } = require('../lib/cache');
const RENDER_CACHE_TTL_MS = 60 * 60 * 1000;
const RENDER_CACHE_PREFIX = 'tryon:render:';
// Bumped to v2: keys now hash the FULL photo payload (the old 1000-char
// prefix could collide across photos with similar base64 headers) and are
// namespaced by the active provider chain, so a render produced before
// YouCam was enabled is never served once YouCam becomes first choice.
const RENDER_CACHE_VERSION = 'v2';

function providerChainFingerprint() {
  return [
    engine.youcamVto?.isConfigured?.() ? 'youcam' : '',
    process.env.REPLICATE_API_TOKEN ? 'replicate' : '',
    'venice',
  ].filter(Boolean).join('+');
}

function getRenderCacheKey(photoData, listingId) {
  const hash = crypto.createHash('sha256');
  hash.update(photoData);
  hash.update('\u0000');
  hash.update(listingId);
  hash.update('\u0000');
  hash.update(`${RENDER_CACHE_VERSION}:${providerChainFingerprint()}`);
  return RENDER_CACHE_PREFIX + hash.digest('hex').slice(0, 32);
}

async function getRenderCache(key) {
  return cacheGet(key);
}

async function setRenderCache(key, value) {
  await cacheSet(key, value, RENDER_CACHE_TTL_MS);
}

/** Raw neon SQL tagged template — for queries that drizzle can't express */
function rawSql(strings, ...values) {
  return getSql()(strings, ...values);
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

/**
 * Normalize any render image form (data URI, http(s) URL, raw base64) into
 * a data URI. Throws if the input is unusable or a URL fetch fails.
 */
async function ensureDataUri(image) {
  if (typeof image !== 'string' || image.length === 0) {
    throw new Error('Render image is empty');
  }
  if (image.startsWith('data:')) return image;
  if (image.startsWith('http://') || image.startsWith('https://')) {
    const response = await fetch(image);
    if (!response.ok) throw new Error(`Failed to fetch render image: ${response.status}`);
    const contentType = (response.headers.get('content-type') || 'image/jpeg').split(';')[0];
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString('base64')}`;
  }
  // Raw base64 payload
  return `data:image/jpeg;base64,${image}`;
}

// ── Garment category inference for YouCam cloth-v4 ──
// Keyword → category pairs checked in priority order (full garments before
// separates, so "shirt dress" classifies as full_body). 'auto' lets YouCam
// classify the garment itself when no hint matches.
const GARMENT_CATEGORY_KEYWORDS = [
  ['full_body', ['dress', 'gown', 'jumpsuit', 'romper', 'overalls', 'saree', 'kaftan', 'boubou', 'agbada', 'abaya', 'suit', 'tuxedo']],
  ['shoes', ['shoe', 'sneaker', 'trainer', 'boot', 'sandal', 'heel', 'loafer']],
  ['lower_body', ['trouser', 'pant', 'jeans', 'shorts', 'skirt', 'legging', 'jogger']],
  ['outer', ['jacket', 'coat', 'blazer', 'parka', 'windbreaker', 'trenchcoat']],
  ['upper_body', ['shirt', 'tee', 'top', 'blouse', 'hoodie', 'sweater', 'jersey', 'tshirt', 'polo', 'tank', 'cardigan', 'vest']],
];

function inferGarmentCategory(listing, kit) {
  // Sports kits (home/away/third/goalkeeper) are tops.
  if (kit?.kitType) return 'upper_body';
  const haystack = [listing?.title, ...(Array.isArray(listing?.tags) ? listing.tags : [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const tokens = new Set(haystack.split(/[^a-z]+/).filter(Boolean));
  for (const [category, words] of GARMENT_CATEGORY_KEYWORDS) {
    if (words.some((word) => tokens.has(word) || tokens.has(`${word}s`) || tokens.has(`${word}es`))) {
      return category;
    }
  }
  return 'auto';
}

/** Pick the gateway cost block off a vision-analysis result, when a metered gateway served it. */
function aiCostFrom(vision) {
  const provider = /^(otari|sandbase)-vision$/.exec(vision?.usedProvider || '')?.[1];
  return provider && vision.costUsd != null
    ? {
        provider,
        model: vision.model || null,
        costUsd: vision.costUsd,
        meteredBy: vision.meteredBy || 'onpoint-workspace',
      }
    : null;
}

// ── POST /api/agent/try-on ───────────────────────────────────
router.post('/', async (req, res) => {
  const { curatorSlug, listingId, photoData, personDescription, paymentTxHash, nearAccountId, nearTxHash, intentsTxHash, signedIntent, paypalOrderId, lookSlug, shareId: rawShareId } =
    req.body || {};
  const shareId = sanitizeShareId(rawShareId);
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
  const nearPayer = typeof nearAccountId === 'string' ? nearAccountId.toLowerCase() : null;
  if (nearTxHash !== undefined && !nearPayments.isNearTxHash(nearTxHash)) {
    return res.status(400).json({ error: 'nearTxHash must be a base58 NEAR transaction hash' });
  }
  if (nearAccountId !== undefined && !nearPayments.isNearAccountId(nearPayer || '')) {
    return res.status(400).json({ error: 'nearAccountId must be a valid NEAR account' });
  }
  if (intentsTxHash !== undefined && !nearPayments.isNearTxHash(intentsTxHash)) {
    return res.status(400).json({ error: 'intentsTxHash must be a base58 NEAR transaction hash' });
  }
  if (nearTxHash && paymentTxHash) {
    return res.status(400).json({ error: 'Provide either paymentTxHash (Celo cUSD) or nearTxHash (NEAR), not both' });
  }
  if (intentsTxHash && (paymentTxHash || nearTxHash)) {
    return res.status(400).json({ error: 'Provide exactly one NEAR payment proof (nearTxHash or intentsTxHash)' });
  }
  if (signedIntent !== undefined && (typeof signedIntent !== 'object' || signedIntent === null || Array.isArray(signedIntent))) {
    return res.status(400).json({ error: 'signedIntent must be a NEP-413 signed payload object' });
  }
  if (signedIntent && (paymentTxHash || nearTxHash || intentsTxHash)) {
    return res.status(400).json({ error: 'Provide exactly one NEAR payment proof (nearTxHash, intentsTxHash, or signedIntent)' });
  }
  if (paypalOrderId !== undefined && !paypalPayments.isPaypalOrderId(paypalOrderId)) {
    return res.status(400).json({ error: 'paypalOrderId must be a PayPal order id' });
  }
  if (paypalOrderId && (paymentTxHash || nearTxHash || intentsTxHash || signedIntent)) {
    return res.status(400).json({ error: 'Provide exactly one payment proof' });
  }

  // Agents may bring their own Otari key (x-otari-key) — the fit-analysis
  // model call is then metered and budget-capped in their Otari workspace,
  // reconcilable via GET /api/agent/ai-usage.
  const agentOtariKey = req.headers['x-otari-key'];
  if (agentOtariKey && !String(agentOtariKey).startsWith('otk_')) {
    return res.status(400).json({
      error: 'x-otari-key must be an Otari workspace key (otk_…).',
      code: 'OTARI_KEY_MALFORMED',
    });
  }

  let db;
  try {
    db = getDb({ curators, listings, kitSkus, payments });
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
    const garmentUrl = keyToUrl(
      row.listing.attributes?.cutoutKey
      || row.listing.photoKeys?.[0]
      || row.kit?.officialImageKey,
    );
    if (!garmentUrl) {
      return res.status(409).json({ error: 'Listing has no garment image to try on' });
    }

    const itemLabel = isDigital
      ? row.listing.title || 'Digital garment'
      : `${row.kit.club} ${row.kit.kitType} kit (${row.kit.season})`;
    // A signed quoteToken (scope "tryon") from /api/curator/{slug}/negotiate
    // overrides the posted fee — the stylist's signature binds the agreed price.
    let priceCusd = tryOnPriceCusd(row.curator, row.listing.inventoryType);
    const { quoteToken } = req.body || {};
    if (quoteToken !== undefined && quoteToken !== null) {
      const check = require('../lib/agent-negotiation').verifyQuoteToken(quoteToken);
      const p = check.payload || {};
      if (!check.ok) {
        return res.status(409).json({ error: check.error, code: 'QUOTE_TOKEN_INVALID' });
      }
      if (p.scope !== 'tryon' || p.curatorSlug !== slug || p.listingId !== listingId) {
        return res.status(409).json({
          error: 'quoteToken does not match this try-on (scope/curator/listing)',
          code: 'QUOTE_TOKEN_MISMATCH',
        });
      }
      priceCusd = p.agreedCusd;
    }
    const splitAddress = curatorSplitAddress(row.curator);
    const payTo = splitAddress || getPlatformWallet();
    const resourceUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const requirements = sharedTypes.buildPaymentRequirements(
      priceCusd,
      payTo,
      resourceUrl,
      `OnPoint try-on: ${itemLabel} from ${row.curator.name}`,
    );

    // ── OKX facade bypass: internal relay from /okx/try-on ──
    // The OKX x402 payment was already verified on XLayer by the OKX
    // facilitator. Skip the Celo 402 + cUSD verification; ledger with a
    // synthetic tx and paymentMethod 'okx_facade'. The real XLayer
    // settlement is tracked by the OKX facilitator independently.
    const okxBypass =
      req.headers['x-okx-paid'] === '1' &&
      !!process.env.SERVICE_API_KEY &&
      req.headers['x-service-key'] === process.env.SERVICE_API_KEY;

    // ── NEAR rail (second payment rail alongside Celo cUSD) ──
    // Receiver resolves per-curator (commerce.nearAccountId) then the
    // platform NEAR_PAYOUT_ACCOUNT fallback. The quote converts the USD fee
    // via NEAR_USD_PRICE; rail is absent from the challenge when unpriced.
    const nearPayTo = nearPayments.nearPayoutAccount(row.curator);
    const nearQuote = nearPayTo ? nearPayments.nearQuoteForUsd(priceCusd) : null;
    const intentsQuote = nearPayTo ? nearIntents.intentsQuoteForUsd(priceCusd, nearPayTo) : null;

    // ── PayPal rail (approval-relay; capture is the replay-guarded proof) ──
    // Only create the order when a challenge is actually needed — the
    // reference binds the approved PayPal order to this listing.
    let paypalQuote = null;
    if (!okxBypass && !paymentTxHash && !nearTxHash && !intentsTxHash && !signedIntent && !paypalOrderId && !req.headers['x-payment']) {
      paypalQuote = await paypalPayments.paypalQuoteForUsd({
        amountUsd: priceCusd,
        referenceId: `tryon:${slug}:${listingId}:${crypto.randomUUID()}`,
        description: `OnPoint try-on: ${itemLabel}`,
      });
    }

    let settlementTxHash = null;
    let payerAddress = null;
    let verification = null;
    let paypalResult = null;
    let paypalPayout = null;
    let paymentMethod = 'cusd';

    if (okxBypass) {
      settlementTxHash =
        req.headers['x-okx-internal-tx'] || `okx_${crypto.randomUUID()}`;
      payerAddress =
        req.headers['x-okx-payer'] ||
        '0x0000000000000000000000000000000000000000';
      paymentMethod = 'okx_facade';
    } else {
    // ── Check for x402 facilitator payment (X-PAYMENT header) ──
    const xPaymentHeader = req.headers['x-payment'];

    // ── Step 1: no payment proof → 402 challenge ──
    if (!paymentTxHash && !xPaymentHeader && !nearTxHash && !intentsTxHash && !signedIntent && !paypalOrderId) {
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
          paymentRails: ['celo_cusd', ...(nearQuote ? ['near'] : []), ...(intentsQuote ? ['near_intents'] : []), ...(paypalQuote ? ['paypal'] : [])],
          ...(intentsQuote ? { intents: intentsQuote } : {}),
          ...(paypalQuote
            ? {
                paypal: {
                  env: paypalQuote.env,
                  orderId: paypalQuote.orderId,
                  approveUrl: paypalQuote.approveUrl,
                  amountUsd: paypalQuote.amountUsd,
                  currency: 'USD',
                  instructions: 'Send approveUrl to the human payer to approve, then re-POST with { paypalOrderId }.',
                },
              }
            : {}),
          ...(nearQuote
            ? {
                near: {
                  network: nearQuote.network,
                  accountId: nearPayTo,
                  ...(nearQuote.amountYocto
                    ? {
                        amountNear: nearQuote.amountNear,
                        amountYocto: nearQuote.amountYocto,
                        usdRate: nearQuote.usdRate,
                      }
                    : {}),
                  ...(nearQuote.token ? { token: nearQuote.token } : {}),
                  instructions: [
                    nearQuote.amountYocto
                      ? `send ${nearQuote.amountYocto} yoctoNEAR (~${nearQuote.amountNear} NEAR) to ${nearPayTo} on NEAR ${nearQuote.network}`
                      : null,
                    nearQuote.token
                      ? `call ${nearQuote.token.method} on ${nearQuote.token.contractId} with {"receiver_id":"${nearPayTo}","amount":"${nearQuote.token.amount}"}${nearQuote.token.attachYocto !== '0' ? ' (attach 1 yoctoNEAR)' : ''}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' or ') +
                  ', then re-POST with { nearAccountId, nearTxHash }.',
                },
              }
            : {}),
          attribution: {
            code: getAttributionCode(),
            assignedTag: getAssignedTag(),
            dataSuffix: getAttributionSuffix(),
            instructions: 'Append the dataSuffix to your transfer transaction data to tag it as OnPoint activity on Celo.',
          },
          aiMetering: {
            header: 'x-otari-key',
            instructions:
              'Send your own Otari (otk_…) workspace key to meter this call\'s fit-analysis model spend to your workspace — your budget caps apply. Read it back via GET /api/agent/ai-usage.',
          },
          instructions:
            'Transfer the exact cUSD amount to payTo on Celo, then re-POST with paymentTxHash — or pay in NEAR via the quote.near rail.',
        },
        revenueHint: buildRevenueHint('try_on', { totalCusd: priceCusd, curator: row.curator }),
      });
    }

    // ── Step 2a: facilitator payment (X-PAYMENT header) ──
    // USDC facilitator settlement is disabled until the payout treasury has
    // an explicit conversion/liquidity policy for try-on fees.
    if (xPaymentHeader) {
      return res.status(409).json({
        error: 'USDC facilitator try-on is temporarily unavailable; use the cUSD payment path.',
        code: 'PAYMENT_RAIL_UNAVAILABLE',
      });
    }
    {
      // ── Step 2b: verify the payment on the submitted rail ──
    if (paypalOrderId) {
      paymentMethod = 'paypal';
      if (!paypalPayments.paypalRailEnabled()) {
        return res.status(409).json({
          error: 'PayPal payment rail is not configured for this resource.',
          code: 'PAYMENT_RAIL_UNAVAILABLE',
        });
      }
      paypalResult = await paypalPayments.verifyAndCapturePaypalOrder({
        orderId: String(paypalOrderId),
        expectedReferencePrefix: `tryon:${slug}:${listingId}:`,
        minAmountUsd: priceCusd,
      });
      if (!paypalResult.ok) {
        return res.status(402).json({
          error: `PayPal payment not verified: ${paypalResult.reason}`,
          ...sharedTypes.build402Body([requirements]),
        });
      }
      // Close the money loop on PayPal rails: pay the seller share out over
      // Payouts. sender_batch_id is derived from the order id, so a replayed
      // verify can never double-pay. Failure is non-fatal — the sale stands
      // and the payout is reconciled operationally.
      const payoutEmail = paypalPayments.paypalSellerPayoutEmail();
      if (payoutEmail) {
        const sellerBps = curatorSellerBps(row.curator) ?? 9500;
        const sellerShareUsd = Math.floor(paypalResult.amountUsd * (sellerBps / 10000) * 100) / 100;
        paypalPayout = await paypalPayments.sendPaypalPayout({
          receiverEmail: payoutEmail,
          amountUsd: sellerShareUsd,
          senderBatchId: `payout-tryon-${paypalResult.orderId}`,
          note: `OnPoint try-on: ${itemLabel}`,
        });
        if (!paypalPayout.ok) {
          logger.warn('PayPal seller payout failed — sale confirmed, payout pending', {
            component: 'agent-tryon', orderId: paypalResult.orderId, reason: paypalPayout.reason,
          });
        }
      }
      verification = { from: paypalResult.payerId || paypalResult.payerEmail, paypal: paypalResult };
    } else if (signedIntent) {
      // Mailbox path: the buyer publishes its signed commitment; the
      // stylist's own agent process picks it up and executes it — a signed
      // intent can only pay its receiver_id, whoever submits it.
      if (!nearPayTo || !intentsQuote) {
        return res.status(409).json({
          error: 'NEAR Intents payment rail is not configured for this resource.',
          code: 'PAYMENT_RAIL_UNAVAILABLE',
        });
      }
      const submitted = intentMailbox.submit({
        signed: signedIntent,
        buyerAccountId: nearPayer,
        payee: nearPayTo,
        minAmountBase: intentsQuote.amount,
        redeem: {
          endpoint: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
          body: { ...req.body, signedIntent: undefined },
        },
      });
      if (!submitted.ok) {
        return res.status(402).json({
          error: `Signed intent rejected: ${submitted.reason}`,
          detail: submitted.detail,
          code: 'SIGNED_INTENT_INVALID',
        });
      }
      return res.status(202).json({
        status: 'pending_execution',
        pendingId: submitted.pendingId,
        payee: nearPayTo,
        message: 'Signed intent published — the payee executes it via execute_intents, then this try-on completes.',
        poll: `/api/pending-intents/${submitted.pendingId}`,
      });
    } else if (intentsTxHash) {
      paymentMethod = 'near_intents';
      if (!nearPayTo || !intentsQuote) {
        return res.status(409).json({
          error: 'NEAR Intents payment rail is not configured for this resource.',
          code: 'PAYMENT_RAIL_UNAVAILABLE',
        });
      }
      const intentsResult = await nearIntents.verifyIntentsSettlement({
        txHash: String(intentsTxHash),
        buyerAccountId: nearPayer,
        expectedPayeeId: nearPayTo,
        minAmountBase: intentsQuote.amount,
      });
      if (!intentsResult.ok) {
        return res.status(402).json({
          error: `NEAR intents settlement not verified: ${intentsResult.reason}`,
          detail: intentsResult.expected ?? intentsResult.failure ?? intentsResult.detail,
          ...sharedTypes.build402Body([requirements]),
        });
      }
      verification = { from: intentsResult.signer, near: intentsResult };
    } else if (nearTxHash) {
      paymentMethod = 'near';
      if (!nearPayTo || !nearQuote) {
        return res.status(409).json({
          error: 'NEAR payment rail is not configured for this resource.',
          code: 'PAYMENT_RAIL_UNAVAILABLE',
        });
      }
      const nearResult = await nearPayments.verifyNearPayment({
        txHash: String(nearTxHash),
        signerAccountId: nearPayer,
        expectedReceiverId: nearPayTo,
        minDepositYocto: nearQuote.amountYocto,
        token: nearQuote.token,
      });
      if (!nearResult.ok) {
        return res.status(402).json({
          error: `NEAR payment not verified: ${nearResult.reason}`,
          ...sharedTypes.build402Body([requirements]),
        });
      }
      verification = { from: nearResult.signer || nearPayer, near: nearResult };
    } else {
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
    } // end cUSD verification path
    }
    } // end else (not okxBypass)

    // The effective tx hash and payer for this request
    const effectiveTxHash = settlementTxHash || paypalResult?.captureId || nearTxHash || intentsTxHash || paymentTxHash;
    const effectivePayer = settlementTxHash ? payerAddress : ((nearTxHash || intentsTxHash) ? (verification?.near?.signer || nearPayer) : (verification?.from || null));
    const explorerUrl = (paymentMethod === 'near' || paymentMethod === 'near_intents')
      ? nearPayments.nearExplorerTxUrl(effectiveTxHash)
      : paymentMethod === 'paypal'
        ? null
        : agentCore.getExplorerUrl('celo', effectiveTxHash);

    // ── Claim-first: lock the payment BEFORE rendering ──
    // One proof id unlocks exactly one render. The unique tx_hash constraint
    // + ON CONFLICT make the claim atomic; a lost race returns 409 with NO
    // render bytes. A completed claim replays its stored artifact instead of
    // re-rendering; a failed/stale claim can be retaken so a render error
    // never burns the payment.
    const claimStore = createDrizzleClaimStore(db, payments);
    const claimValues = {
      purpose: 'try_on',
      curatorSlug: slug,
      payerAddress: effectivePayer,
      amountCusd: priceCusd.toFixed(2),
      resource: '/api/agent/try-on',
      metadata: {
        listingId,
        item: itemLabel,
        payTo,
        splitAddress: splitAddress || null,
        paymentMethod,
        ...((paymentMethod === 'near' || paymentMethod === 'near_intents')
          ? {
              near: {
                accountId: nearPayer,
                payTo: nearPayTo,
                network: nearQuote?.network || nearPayments.nearNetwork(),
                ...(verification?.near?.verifier ? { verifier: verification.near.verifier, executor: verification.near.executor } : {}),
                ...(() => {
                  const s = nearPayments.nearSettlementSummary(verification?.near, nearQuote, intentsQuote);
                  return (s.mode === 'token' || s.mode === 'intents')
                    ? { tokenContract: s.tokenContract, tokenSymbol: s.asset, amountToken: s.amountToken }
                    : { amountYocto: s.amountYocto };
                })(),
              },
            }
          : {}),
        ...(paymentMethod === 'paypal' && paypalResult
          ? { paypal: { orderId: paypalResult.orderId, captureId: paypalResult.captureId, amountUsd: paypalResult.amountUsd, env: paypalPayments.paypalEnv() } }
          : {}),
      },
    };
    const claim = await acquireTryOnClaim(claimStore, { proofId: effectiveTxHash, values: claimValues });

    if (claim.outcome === 'replay') {
      // Same proof, already rendered — serve the stored artifact, no new paid
      // provider call. Lets an agent recover a render after a dropped response
      // without paying twice.
      const imageUrl = r2PublicUrl(claim.row.renderKey);
      let replayMeta = null;
      try {
        const metaRes = await fetch(r2PublicUrl(r2KeyFor.agentPolaroidMeta(String(claim.paymentId))));
        if (metaRes.ok) replayMeta = await metaRes.json();
      } catch { /* best-effort: replay still serves the image without metadata */ }
      logger.info('Try-on replay served from stored artifact', {
        component: 'agent-tryon', paymentId: claim.paymentId, txHash: effectiveTxHash,
      });
      return res.status(200).json({
        success: true,
        replay: true,
        tryOn: {
          item: itemLabel,
          curatorSlug: slug,
          listingId,
          inventoryType: row.listing.inventoryType,
          render: { image: imageUrl, provider: 'replay', imageConditioned: true },
          fitSignal: replayMeta?.fitSignal || null,
          stylingTips: replayMeta?.stylingTips || [],
        },
        polaroid: { imageUrl, webUrl: polaroidWebUrl(String(claim.paymentId)) },
        payment: {
          id: claim.paymentId,
          txHash: effectiveTxHash,
          amountCusd: priceCusd.toFixed(2),
          explorerUrl,
          payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
          paymentMethod,
        },
      });
    }

    if (claim.outcome === 'conflict') {
      const inProgress = claim.status === 'processing';
      return res.status(409).json({
        error: inProgress
          ? 'Payment is being processed by another request. Retry shortly.'
          : 'Payment transaction already used',
        code: 'PAYMENT_ALREADY_CLAIMED',
        status: claim.status,
      });
    }

    const paymentId = claim.paymentId;

    // Render + fit analysis run concurrently — independent pipelines.
    // The payment is already claimed (processing); if the render fails we
    // release the claim so the agent can retry with the same tx hash.
    const fitJsonSchema = `{
  "bodyType": "athletic|slim|average|curvy|plus-size",
  "measurements": { "shoulders": "small|medium|large", "chest": "small|medium|large", "waist": "small|medium|large", "hips": "small|medium|large" },
  "fitRecommendations": ["2-3 specific fit notes for this garment on this person"],
  "styleRecommendations": ["2-3 notes on whether/how this item suits them"],
  "score": 1-10,
  "confidence": 0-1
}`;
    const fitPrompt = `You are an expert fashion stylist. Analyze this person's photo for how a ${itemLabel} would fit and suit them.\n\nReturn ONLY valid JSON:\n${fitJsonSchema}`;
    const fitPromptRender = `You are an expert fashion stylist. This is a virtual try-on render of a person wearing a ${itemLabel}. Judge how the garment actually fits and suits them AS SHOWN in the render.\n\nReturn ONLY valid JSON:\n${fitJsonSchema}`;

    // Check render cache — if the same person+listing was rendered recently
    // with the same provider chain, reuse the cached (persistent) render and
    // skip the paid provider call entirely.
    const renderCacheKey = getRenderCacheKey(photoData, listingId);
    const cachedRender = await getRenderCache(renderCacheKey);

    const renderPromise = cachedRender
      ? Promise.resolve({ generatedImage: cachedRender, provider: 'cache', stylingTips: [], imageConditioned: true, fallbackReason: null })
      : engine.buildGeneratedOutfitImageResponse({
          data: {
            photoData,
            personDescription: personDescription || '',
            garmentCategory: inferGarmentCategory(row.listing, row.kit),
            items: [{ name: itemLabel, imageUrl: garmentUrl, description: itemLabel }],
          },
          provider: 'auto',
          tier: 'paid',
        });

    // Fit analysis rides on the render when it is garment-conditioned:
    // judging the actual garment on the actual person (YouCam/Replicate
    // output) beats guessing from the bare photo. Falls back to the photo
    // when the render is missing, not garment-conditioned, or unusable.
    const fitPromise = renderPromise
      .then(async (result) => {
        if (!result?.imageConditioned || !result?.generatedImage) {
          throw new Error('render not garment-conditioned');
        }
        const renderImage = await ensureDataUri(result.generatedImage);
        const vision = await engine.generateVisionAnalysis({
          prompt: fitPromptRender,
          imageBase64: renderImage,
          apiKey: agentOtariKey || undefined,
        });
        return { fit: engine.parseBodyAnalysisResponse(vision.text), aiCost: aiCostFrom(vision) };
      })
      .catch(async () => {
        const vision = await engine.generateVisionAnalysis({
          prompt: fitPrompt,
          imageBase64: photoData,
          apiKey: agentOtariKey || undefined,
        });
        return { fit: engine.parseBodyAnalysisResponse(vision.text), aiCost: aiCostFrom(vision) };
      });

    const [render, fitResult] = await Promise.allSettled([renderPromise, fitPromise]);

    if (render.status === 'rejected') {
      // Release the claim so the agent can retry with the same proof. If the
      // release write itself fails, the claim stays 'processing' and becomes
      // reclaimable after the stale window rather than burning the payment.
      try {
        await claimStore.markFailed(paymentId);
      } catch (releaseErr) {
        logger.warn('Failed to release try-on claim after render error', {
          component: 'agent-tryon', paymentId,
        }, releaseErr);
      }
      logger.error(
        'Try-on render failed — claim released (agent can retry)',
        { component: 'agent-tryon', listingId, txHash: effectiveTxHash },
        render.reason,
      );
      return res.status(502).json({
        error: 'Try-on render failed — your payment claim was released. You can retry with the same transaction hash.',
        retryable: true,
      });
    }

    const fit = fitResult.status === 'fulfilled' ? fitResult.value.fit : null;
    const aiCost = fitResult.status === 'fulfilled' ? fitResult.value.aiCost : null;
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
          payerAddress: effectivePayer,
          renderProvider: render.value.provider,
          paymentMethod,
          ...(paymentMethod === 'paypal' && paypalResult
            ? {
                paypal: {
                  orderId: paypalResult.orderId,
                  captureId: paypalResult.captureId,
                  amountUsd: paypalResult.amountUsd,
                  env: paypalPayments.paypalEnv(),
                  ...(paypalPayout?.ok ? { payoutBatchId: paypalPayout.payoutBatchId } : {}),
                },
                curatorPayout: paypalPayout?.ok
                  ? `${paypalPayout.amountUsd.toFixed(2)} USD via PayPal Payouts (batch ${paypalPayout.payoutBatchId})`
                  : `${paypalResult.amountUsd} USD (platform, pending reconciliation)`,
              }
            : {}),
        },
        txHash: effectiveTxHash,
        chain: paymentMethod === 'near' ? 'near' : paymentMethod === 'paypal' ? 'paypal' : 'celo',
      });
      receiptId = receipt.id;
    } catch (receiptErr) {
      logger.warn('Failed to record try-on receipt', { component: 'agent-tryon', paymentId }, receiptErr);
    }

    const { classifyAgentCaller, recordAgentDemand } = require('../lib/agent-demand');
    const caller = classifyAgentCaller(effectivePayer);
    recordAgentDemand('try_on', caller, 'succeeded');

    logger.info('Agent try-on served', {
      component: 'agent-tryon',
      paymentId,
      slug,
      listingId,
      provider: render.value.provider,
      isDigital,
      caller,
      payerAddress: effectivePayer,
      paymentMethod,
    });

    // Log funnel event: tryon_complete (paid, agent)
    logFunnelEvent(db, {
      eventType: 'tryon_complete',
      source: 'agent',
      tier: 'paid',
      curatorSlug: slug,
      listingId,
      payerAddress: effectivePayer,
      provider: render.value.provider,
      revenueUsd: priceCusd.toFixed(4),
      metadata: {
        paymentId,
        isDigital,
        fitScore: fitSignal?.score,
        shareId,
        lookSlug: lookSlug || null,
        paymentMethod,
      },
      clientIp: req.ip,
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
          imageUrl: keyToUrl(m.photo_keys?.[0]),
          orderUrl: `/api/curator/${m.curator_slug}/order`,
          storefrontUrl: `/api/curator/${m.curator_slug}/storefront`,
          webUrl: storefrontWebUrl(m.curator_slug),
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

    // ── Persist polaroid to R2 for a shareable web URL ──
    //
    // Best-effort: if the upload fails, the try-on still succeeded.
    // The agent gets the render inline; the polaroid URL is a bonus.
    let polaroid = null;
    let polaroidWarning = null;
    let polaroidRenderKey = null;
    try {
      const imageData = render.value.generatedImage;
      // Renders arrive as data URIs, ephemeral provider URLs (YouCam), or raw
      // base64 — normalize before persisting.
      const imageDataUri = await ensureDataUri(imageData);
      const imageBuffer = Buffer.from(imageDataUri.split(',')[1], 'base64');
      const imageKey = r2KeyFor.agentPolaroid(String(paymentId));
      await r2Upload(imageKey, imageBuffer, 'image/jpeg');
      polaroidRenderKey = imageKey;
      const imageUrl = r2PublicUrl(imageKey);

      // ── Mirror to Alibaba Cloud OSS (best-effort) ──
      // Qwen Cloud Hackathon, Track 4: Autopilot Agent.
      // This mirror satisfies the "Proof of Alibaba Cloud Deployment"
      // requirement and provides a second-region backup of try-on
      // artifacts. Failures are non-fatal — R2 remains the primary.
      if (ossConfigured()) {
        try {
          await ossMirror(String(paymentId), 'polaroid', imageBuffer, 'image/jpeg');
        } catch (ossErr) {
          logger.warn('OSS mirror failed (non-fatal)', { component: 'agent-tryon', paymentId }, ossErr);
        }
      }

      const meta = {
        item: itemLabel,
        curatorSlug: slug,
        curatorName: row.curator.name,
        listingId,
        inventoryType: row.listing.inventoryType,
        imageUrl,
        fitSignal,
        ...(aiCost ? { aiCost } : {}),
        stylingTips: render.value.stylingTips || [],
        payment: {
          txHash: effectiveTxHash,
          amountCusd: priceCusd.toFixed(2),
          explorerUrl,
          paymentMethod,
        },
        storefrontUrl: storefrontWebUrl(slug),
        createdAt: new Date().toISOString(),
      };
      const metaKey = r2KeyFor.agentPolaroidMeta(String(paymentId));
      await r2Upload(metaKey, Buffer.from(JSON.stringify(meta), 'utf-8'), 'application/json');

      polaroid = {
        imageUrl,
        webUrl: polaroidWebUrl(String(paymentId)),
      };

      // Cache the persistent R2 URL (not the ephemeral provider URL) so a
      // repeat try-on of the same photo+listing skips the paid render and
      // never serves an expired link.
      await setRenderCache(renderCacheKey, imageUrl);
    } catch (polaroidErr) {
      logger.warn('Polaroid upload failed — try-on still succeeded', { component: 'agent-tryon', paymentId }, polaroidErr);
      // Surfaced in the 200 response so a caller can tell "no shareable
      // artifact because storage rejected the write" from "no artifact was
      // asked for" — otherwise the failure is only visible in server logs.
      polaroidWarning = {
        code: 'polaroid_storage_write_failed',
        reason: String(polaroidErr.message || polaroidErr).slice(0, 300),
        paymentId: String(paymentId),
        hint: `The /p/${paymentId} page will not exist. Save tryOn.render.image yourself, or re-run the try-on once storage credentials are fixed — a provider-URL render is not cacheable, so a retry costs a new render.`,
      };
      // No persistent copy exists; still cache inline data-URI renders so a
      // retry skips the paid call. Ephemeral provider URLs are deliberately
      // NOT cached here — they may expire before the cache TTL does.
      if (typeof render.value.generatedImage === 'string' && render.value.generatedImage.startsWith('data:')) {
        await setRenderCache(renderCacheKey, render.value.generatedImage);
      }
    }

    // Mark the claim completed with the stored render key so a duplicate
    // submission replays the artifact instead of triggering a new paid render.
    // Best-effort: if this write fails the claim stays 'processing' and is
    // reclaimable after the stale window (at most one extra render).
    try {
      await claimStore.markCompleted(paymentId, polaroidRenderKey);
    } catch (completeErr) {
      logger.warn('Failed to mark try-on claim completed', { component: 'agent-tryon', paymentId }, completeErr);
    }

    // ── Share card: if this try-on came from a look, generate a collage ──
    let shareCard = null;
    if (lookSlug) {
      try {
        const { composeTryOnShareCard } = require('../lib/image-composite');
        const { agentLooks, listings: listingsTable, kitSkus: kitTable } = require('@repo/db');

        const dbLook = getDb({ agentLooks, listings: listingsTable, kitSkus: kitTable });
        const [look] = await dbLook
          .select()
          .from(agentLooks)
          .where(eq(agentLooks.slug, lookSlug))
          .limit(1);

        if (look && look.status === 'live') {
          // Resolve look items for the collage
          const lookItems = await dbLook
            .select({ listing: listingsTable, kit: kitTable })
            .from(listingsTable)
            .leftJoin(kitTable, eq(listingsTable.skuId, kitTable.id))
            .where(inArray(listingsTable.id, look.listingIds));

          const itemsForCard = look.listingIds.map((id) => {
            const row = lookItems.find((r) => r.listing.id === id);
            if (!row) return null;
            const photoKey = row.listing.photoKeys?.[0] || row.listing.officialImageKey;
            return {
              title: row.listing.title || (row.kit ? `${row.kit.club} ${row.kit.kitType}` : 'Item'),
              imageUrl: photoKey ? keyToUrl(photoKey) : null,
              isHero: row.listing.id === look.heroListingId,
            };
          }).filter(Boolean);

          const cardResult = await composeTryOnShareCard({
            tryOnImageBase64: render.value.generatedImage,
            items: itemsForCard,
            agentAddress: look.agentAddress,
            lookSlug: look.slug,
            lookTitle: look.title,
          });

          shareCard = {
            imageUrl: cardResult.url,
            r2Key: cardResult.r2Key,
            lookSlug: look.slug,
            lookUrl: `${webBaseUrl()}/look/${look.slug}`,
          };

          // Increment try-on count
          await dbLook.execute(sql`UPDATE agent_looks SET try_on_count = try_on_count + 1, updated_at = now() WHERE slug = ${lookSlug}`);

          logger.info('Share card generated for look', {
            component: 'agent-tryon',
            lookSlug,
            r2Key: cardResult.r2Key,
          });
        }
      } catch (cardErr) {
        logger.warn('Share card generation failed — try-on still succeeded', {
          component: 'agent-tryon', lookSlug,
        }, cardErr);
      }
    }

    const storefrontWeb = storefrontWebUrl(slug);

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
      ...(aiCost ? { aiCost } : {}),
      polaroid,
      ...(polaroidWarning ? { polaroidWarning } : {}),
      ...(shareCard ? { shareCard } : {}),
      payment: {
        id: paymentId,
        txHash: effectiveTxHash,
        amountCusd: priceCusd.toFixed(2),
        explorerUrl,
        payoutModel: splitAddress ? '0xSplits (curator earns a share)' : 'platform',
        paymentMethod,
        ...(paymentMethod === 'paypal' && paypalPayout
          ? { paypalPayout: paypalPayout.ok
              ? { status: 'sent', batchId: paypalPayout.payoutBatchId, amountUsd: paypalPayout.amountUsd }
              : { status: 'pending_reconciliation', reason: paypalPayout.reason } }
          : {}),
      },
      receiptId,
      receiptUrl: receiptId ? `${webBaseUrl()}/receipt/${receiptId}` : undefined,
      ...(isDigital ? { similarPhysicalItems } : {}),
      next: isDigital
        ? {
            hint: nextHint,
            directory: '/api/curator/directory',
            webUrl: storefrontWeb,
          }
        : {
            order: `/api/curator/${slug}/order`,
            hint: nextHint,
            webUrl: storefrontWeb,
          },
    });
  } catch (err) {
    logger.error('Agent try-on failed', { component: 'agent-tryon', slug }, err);
    return res.status(500).json({ error: 'Failed to process try-on' });
  }
});

module.exports = router;
module.exports.__test = { isValidPhotoData, recommendSize, inferGarmentCategory, ensureDataUri, getRenderCacheKey };
