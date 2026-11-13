/**
 * Agent Commerce Helpers — pricing + quote shapes for agent-facing storefronts.
 *
 * Single source of truth for KES→cUSD conversion and the `agentCommerce`
 * block exposed on storefront listings. Used by curator-storefront.js for
 * both the public catalog (GET) and the on-chain order flow (POST /order).
 */

const sharedTypes = require('@onpoint/shared-types');
const { nearPayoutAccount, nearQuoteForUsd } = require('./near-payments');

const DEFAULT_KES_PER_USD = 130;
const DEFAULT_OFFER_FRESHNESS_DAYS = 30;

function offerFreshnessMaxDays() {
  const days = Number(process.env.OFFER_FRESHNESS_MAX_DAYS);
  return Number.isFinite(days) && days > 0 ? Math.floor(days) : DEFAULT_OFFER_FRESHNESS_DAYS;
}

function kesPerUsd() {
  const rate = Number(process.env.KES_PER_USD);
  return Number.isFinite(rate) && rate > 0 ? rate : DEFAULT_KES_PER_USD;
}

/** Convert a KES price to cUSD (2 dp). cUSD tracks USD 1:1. */
function kesToCusd(kes) {
  const amount = Number(kes);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round((amount / kesPerUsd()) * 100) / 100;
}

/** Curator payout wallet — reuses commerce.walletAddress (also used for G$ streaming). */
function curatorPayoutAddress(curator) {
  const address = curator?.commerce?.walletAddress;
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
    ? address
    : null;
}

/**
 * Curator's 0xSplits SplitV2 address — when present, the buyer pays the
 * Split contract directly instead of the platform wallet. The Split
 * non-custodially holds funds until `distribute` is called.
 */
function curatorSplitAddress(curator) {
  const address = curator?.commerce?.splitAddress;
  return typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)
    ? address
    : null;
}

/**
 * Seller share in basis points. `commerce.revShare` is the platform's
 * fraction of attributed sales (e.g. 0.05), so the curator keeps the rest.
 * Falls back to the default split in @repo/agent-core when unset.
 */
function curatorSellerBps(curator) {
  const revShare = Number(curator?.commerce?.revShare);
  if (!Number.isFinite(revShare) || revShare < 0 || revShare >= 1) return undefined;
  return Math.round((1 - revShare) * 10000);
}

/**
 * Curator's negotiation floor: `commerce.priceFloorPct` in (0, 1] — the
 * minimum fraction of the listed total they'll accept from an agent offer.
 * Absent or out-of-range → null (posted price only, no discounting).
 */
function curatorPriceFloorPct(curator) {
  const pct = Number(curator?.commerce?.priceFloorPct);
  return Number.isFinite(pct) && pct > 0 && pct <= 1 ? pct : null;
}

/**
 * Resolve an agent's price offer for an order.
 *
 * `offerUsd` is the total USD offered for the whole order. The curator's
 * floor is commerce.priceFloorPct of the listed total; when the field is
 * absent the floor IS the listed total (posted price only — below-list
 * offers get countered at list). Below floor → countered at the floor
 * price; at/above floor → agreed = min(offer, list), so a negotiated quote
 * never exceeds the listed price. Omit the offer and pricing is unchanged.
 *
 * The agreed price also round-trips inside the quoteId's `-o<cents>`
 * segment, so the payment-proof re-POST needn't repeat offerUsd — it is
 * re-validated against the floor here either way.
 */
function resolveOrderOffer({ listCusd, curator, offerUsd, clientQuoteId, quoteIdPrefix }) {
  const floorPct = curatorPriceFloorPct(curator) ?? 1;
  // Ceiling — the curator never rounds their own floor down.
  const floorCusd = Math.ceil(listCusd * floorPct * 100) / 100;
  const floorCents = Math.round(floorCusd * 100);

  let offerCents = offerUsd !== undefined && offerUsd !== null
    ? Math.round(Number(offerUsd) * 100)
    : null;
  if (offerCents === null && typeof clientQuoteId === 'string') {
    // Only honor an offer encoded for THIS listing+size+quantity — a quote
    // minted for a smaller order must not reprice a bigger one.
    const match = clientQuoteId.match(/-o(\d+)-\d+$/);
    if (match && (!quoteIdPrefix || clientQuoteId.startsWith(`${quoteIdPrefix}-o`))) {
      offerCents = parseInt(match[1], 10);
    }
  }

  const base = { listCusd, floorCusd, negotiable: floorCusd < listCusd };
  if (offerCents === null) {
    return { ...base, offerUsd: null, agreedCusd: listCusd, negotiated: false, countered: false, counterOfferUsd: null };
  }
  if (offerCents < floorCents) {
    return { ...base, offerUsd: offerCents / 100, agreedCusd: listCusd, negotiated: false, countered: true, counterOfferUsd: floorCusd };
  }
  const agreedCusd = Math.min(offerCents / 100, listCusd);
  return { ...base, offerUsd: offerCents / 100, agreedCusd, negotiated: agreedCusd < listCusd, countered: false, counterOfferUsd: null };
}

/**
 * Evaluate whether a listing is a trusted executable offer.
 *
 * This is deliberately separate from `agentPurchasable`: the legacy flag
 * means wallet + physical inventory, while this contract also checks the
 * fields an agent needs to act safely (identity, media, stocked size,
 * price, and freshness). The result is exposed even when the listing is not
 * currently purchasable so operators can fix the specific blockers.
 */
function normalizeSize(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isNumericValue(value) {
  if (typeof value === 'boolean' || value === null || value === undefined) return false;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'string' || value.trim() === '') return false;
  return /^-?([0-9]+(\\.[0-9]+)?|\\.[0-9]+)$/.test(value)
    && Number.isFinite(Number(value));
}

function isIntegerValue(value) {
  if (typeof value === 'number') return Number.isInteger(value) && Number.isFinite(value);
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

function validPriceOffers(listing) {
  return (Array.isArray(listing?.sizes) ? listing.sizes : [])
    .filter((entry) => (
      normalizeSize(entry?.size).length > 0
      && isNumericValue(entry.price)
      && kesToCusd(entry.price) !== null
    ));
}

function validStockOffers(listing) {
  return validPriceOffers(listing)
    .filter((entry) => isIntegerValue(entry.stock)
      && Number(entry.stock) > 0)
    .map((entry) => ({
      size: normalizeSize(entry.size),
      stock: Number(entry.stock),
      priceKes: Number(entry.price),
      priceCusd: kesToCusd(entry.price),
    }));
}

// These blockers describe the inventory facts that an operator can certify.
// Wallet and freshness are deliberately excluded: verification records the
// current stock/price snapshot, while payout configuration and the timestamp
// are separate readiness concerns.
const REVERIFICATION_IGNORED_BLOCKERS = new Set([
  'missing_payout_wallet',
  'missing_freshness',
  'stale_inventory',
  'future_freshness_timestamp',
]);

function inventoryVerificationBlockers(contract) {
  return (contract?.blockers || []).filter(
    (blocker) => !REVERIFICATION_IGNORED_BLOCKERS.has(blocker),
  );
}

function evaluateTrustedOffer(curator, listing, now = new Date()) {
  const isDigital = listing?.inventoryType === 'digital';
  const validOffers = validStockOffers(listing);
  const normalizedSizeNames = (Array.isArray(listing?.sizes) ? listing.sizes : [])
    .map((entry) => normalizeSize(entry?.size).toLowerCase())
    .filter(Boolean);
  const hasDuplicateSizeNames = new Set(normalizedSizeNames).size !== normalizedSizeNames.length;
  const hasMedia = Boolean(
    (Array.isArray(listing?.photoKeys) && listing.photoKeys.length > 0)
    || listing?.kit?.officialImageKey,
  );
  const hasIdentity = Boolean(listing?.skuId || listing?.kit?.id || listing?.title);
  // Only an explicit inventory verification can certify stock/price truth.
  // `updatedAt` is deliberately ignored because photo/status/metadata edits
  // must not make an old inventory snapshot look fresh.
  const freshnessSource = 'last_verified_at';
  const lastVerifiedDate = listing?.lastVerifiedAt ? new Date(listing.lastVerifiedAt) : null;
  const maxAgeDays = offerFreshnessMaxDays();
  const validTimestamp = lastVerifiedDate && !Number.isNaN(lastVerifiedDate.getTime());
  const ageMs = validTimestamp ? now.getTime() - lastVerifiedDate.getTime() : null;
  const freshnessStatus = ageMs === null || ageMs < 0
    ? 'unknown'
    : ageMs <= maxAgeDays * 24 * 60 * 60 * 1000 ? 'fresh' : 'stale';
  const checks = {
    identity: hasIdentity,
    media: hasMedia,
    sizeStock: isDigital ? false : validOffers.length > 0,
    price: isDigital ? false : validPriceOffers(listing).length > 0,
    payout: Boolean(curatorPayoutAddress(curator)),
    freshness: freshnessStatus === 'fresh',
  };
  const completenessKeys = isDigital
    ? ['identity', 'media', 'freshness']
    : Object.keys(checks);
  const completeness = Math.round(
    (completenessKeys.filter((key) => checks[key]).length / completenessKeys.length) * 100,
  ) / 100;
  const blockers = [];
  if (!checks.identity) blockers.push('missing_product_identity');
  if (!checks.media) blockers.push('missing_product_media');
  if (!isDigital && !checks.sizeStock) blockers.push('missing_in_stock_size');
  if (!isDigital && !checks.price) blockers.push('missing_valid_price');
  if (!isDigital && hasDuplicateSizeNames) blockers.push('duplicate_size_names');
  if (!isDigital && !checks.payout) blockers.push('missing_payout_wallet');
  if (freshnessStatus === 'unknown') {
    blockers.push(ageMs !== null && ageMs < 0 ? 'future_freshness_timestamp' : 'missing_freshness');
  }
  if (freshnessStatus === 'stale') blockers.push('stale_inventory');

  return {
    version: 1,
    kind: isDigital ? 'try_on' : 'purchase',
    scope: isDigital ? 'try_on' : 'purchase',
    completeness,
    readiness: blockers.length === 0,
    freshness: {
      status: freshnessStatus,
      source: freshnessSource,
      lastVerifiedAt: lastVerifiedDate && validTimestamp ? lastVerifiedDate.toISOString() : null,
      maxAgeDays,
    },
    checks,
    blockers,
  };
}

/**
 * Build the agent-facing commerce block for a storefront listing.
 * Returns null when the curator has no payout wallet or no valid offer —
 * the listing remains browsable and exposes its contract separately.
 */
function buildListingAgentCommerce(curator, listing) {
  // Digital designs are try-on only — never expose purchase offers.
  if (listing?.inventoryType === 'digital') return null;

  const contract = evaluateTrustedOffer(curator, listing);
  if (!contract.readiness) return null;

  const offers = validStockOffers(listing);
  if (offers.length === 0) return null;

  const priceFloorPct = curatorPriceFloorPct(curator);

  return {
    available: true,
    currency: 'cUSD',
    offers,
    contract,
    ...(priceFloorPct !== null
      ? {
          negotiation: {
            offerParam: 'offerUsd',
            offerSemantics: 'total USD offered for the order (all sizes × quantity)',
            priceFloorPct,
            belowFloor: 'HTTP 409 with a machine-readable counterOfferUsd at the floor price',
          },
        }
      : {}),
  };
}

/**
 * Price of one agent try-on call in cUSD.
 *
 * Tiered by listing inventory type: digital try-ons default to $0.03,
 * physical try-ons default to $0.05 (see ADR 0013). Precedence:
 * per-curator `commerce.tryOnPriceUsd` → env var
 * (X402_TRYON_PRICE_USD applies to both, optionally tiered via
 * X402_TRYON_PRICE_USD_DIGITAL / X402_TRYON_PRICE_USD_PHYSICAL) →
 * type-based default.
 *
 * @param {object} [curator] — optional curator record for per-curator pricing
 * @param {string} [inventoryType] — 'digital' | 'physical' (default: physical)
 */
function tryOnPriceCusd(curator, inventoryType) {
  // Per-curator override
  const perCurator = Number(curator?.commerce?.tryOnPriceUsd);
  if (Number.isFinite(perCurator) && perCurator > 0) return perCurator;

  const isDigital = inventoryType === 'digital';
  const defaultPrice = isDigital ? 0.03 : 0.05;

  // Type-specific env var, then the shared env var
  const typedEnv = Number(
    process.env[isDigital ? 'X402_TRYON_PRICE_USD_DIGITAL' : 'X402_TRYON_PRICE_USD_PHYSICAL'],
  );
  if (Number.isFinite(typedEnv) && typedEnv > 0) return typedEnv;

  const price = Number(process.env.X402_TRYON_PRICE_USD);
  return Number.isFinite(price) && price > 0 ? price : defaultPrice;
}

/** Storefront-level agent commerce metadata (chain, token, order endpoint). */
function buildStorefrontAgentCommerce(curator, slug) {
  const enabled = Boolean(curatorPayoutAddress(curator));
  const splitAddr = curatorSplitAddress(curator);
  // Storefront-level advertises the physical tier; actual price is resolved
  // per-listing at POST /api/agent/try-on ($0.03 digital / $0.05 physical).
  const tryOnPrice = tryOnPriceCusd(curator);
  // NEAR rail: advertised when a payout account + USD rate are configured.
  const nearPayTo = nearPayoutAccount(curator);
  const nearQuote = nearPayTo ? nearQuoteForUsd(tryOnPrice) : null;
  return {
    enabled,
    chain: 'celo',
    chainId: sharedTypes.X402_CHAIN_ID,
    network: sharedTypes.X402_NETWORK,
    token: sharedTypes.X402_ASSET,
    tokenSymbol: 'cUSD',
    orderEndpoint: `/api/curator/${slug}/order`,
    payoutModel: splitAddr ? '0xSplits (non-custodial)' : 'custodial',
    splitAddress: splitAddr || undefined,
    tryOn: {
      endpoint: '/api/agent/try-on',
      priceCusd: tryOnPrice,
      paymentRails: ['celo_cusd', ...(nearQuote ? ['near'] : [])],
      ...(nearQuote
        ? {
            near: {
              network: nearQuote.network,
              accountId: nearPayTo,
              amountNear: nearQuote.amountNear,
              amountYocto: nearQuote.amountYocto,
              usdRate: nearQuote.usdRate,
            },
          }
        : {}),
      description:
        'x402-paid fitting room: POST {curatorSlug, listingId, photoData} to render this catalog on your human and get a fit signal before buying. Tiered pricing: $0.03 digital listings, $0.05 physical listings (defaults; per-curator override may apply). Payment rails: cUSD on Celo (paymentTxHash)' +
        (nearQuote ? ' or NEAR (nearAccountId + nearTxHash)' : '') +
        '.',
    },
    earningsEndpoint: `/api/curator/${slug}/earnings`,
    flow: enabled
      ? [
          `Optional: POST /api/agent/try-on with {curatorSlug, listingId, photoData} to check fit first (${tryOnPrice} cUSD)`,
          `POST ${`/api/curator/${slug}/order`} with {listingId, size, quantity} to receive a 402 payment challenge`,
          'Transfer the exact cUSD amount to the payTo address on Celo',
          'Re-POST the same body plus {paymentTxHash, quoteId} to confirm the order',
        ]
      : ['Curator has not configured a payout wallet; agent checkout unavailable'],
  };
}

/**
 * Web app base URL — used to construct human-facing shareable URLs.
 * Falls back to the production URL if not configured via env.
 */
function webBaseUrl() {
  return process.env.WEB_BASE_URL?.replace(/\/$/, '') || 'https://onpoint.trustfall.xyz';
}

/** Human-browsable storefront URL for a curator. */
function storefrontWebUrl(slug) {
  return `${webBaseUrl()}/s/${slug}`;
}

/** Shareable polaroid page URL for an agent try-on (by payment ID). */
function polaroidWebUrl(paymentId) {
  return `${webBaseUrl()}/p/${paymentId}`;
}

/**
 * Revenue hint for 402 challenge responses — tells agents the economics
 * so they can decide whether to add a markup for their human.
 */
function buildRevenueHint(type, { totalCusd, curator }) {
  const sellerBps = curatorSellerBps(curator);
  const platformFeeBps = sellerBps ? 10000 - sellerBps : 500; // default 5%
  const platformFeeCusd = Math.round(totalCusd * platformFeeBps) / 10000;
  const curatorShareCusd = Math.round((totalCusd - platformFeeCusd) * 100) / 100;

  const note = type === 'try_on'
    ? 'Charge your human more than the try-on fee to earn a spread. OnPoint does not cap agent markups.'
    : 'Charge your human more than the listing price to earn a spread. OnPoint does not cap agent markups.';

  return {
    youPay: `${totalCusd.toFixed(2)} cUSD`,
    curatorEarns: `${curatorShareCusd.toFixed(2)} cUSD`,
    platformFee: `${platformFeeCusd.toFixed(2)} cUSD`,
    agentMarkupNote: note,
  };
}

module.exports = {
  kesToCusd,
  kesPerUsd,
  offerFreshnessMaxDays,
  validPriceOffers,
  validStockOffers,
  isNumericValue,
  isIntegerValue,
  inventoryVerificationBlockers,
  evaluateTrustedOffer,
  curatorPriceFloorPct,
  resolveOrderOffer,
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  tryOnPriceCusd,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
  webBaseUrl,
  storefrontWebUrl,
  polaroidWebUrl,
  normalizeSize,
  buildRevenueHint,
};
