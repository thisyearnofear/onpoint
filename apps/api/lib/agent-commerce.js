/**
 * Agent Commerce Helpers — pricing + quote shapes for agent-facing storefronts.
 *
 * Single source of truth for KES→cUSD conversion and the `agentCommerce`
 * block exposed on storefront listings. Used by curator-storefront.js for
 * both the public catalog (GET) and the on-chain order flow (POST /order).
 */

const sharedTypes = require('@onpoint/shared-types');

const DEFAULT_KES_PER_USD = 130;

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
 * Build the agent-facing commerce block for a storefront listing.
 * Returns null when the curator has no payout wallet — the listing is
 * then browsable but not agent-purchasable.
 */
function buildListingAgentCommerce(curator, listing) {
  if (!curatorPayoutAddress(curator)) return null;
  // Digital designs are try-on only — never expose purchase offers.
  if (listing?.inventoryType === 'digital') return null;

  const offers = (Array.isArray(listing.sizes) ? listing.sizes : [])
    .filter((entry) => Number(entry.stock) > 0)
    .map((entry) => ({
      size: entry.size,
      stock: Number(entry.stock),
      priceKes: Number(entry.price),
      priceCusd: kesToCusd(entry.price),
    }))
    .filter((offer) => offer.priceCusd !== null);

  if (offers.length === 0) return null;

  return { available: true, currency: 'cUSD', offers };
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
      description:
        'x402-paid fitting room: POST {curatorSlug, listingId, photoData} to render this catalog on your human and get a fit signal before buying. Tiered pricing: $0.03 digital listings, $0.05 physical listings (defaults; per-curator override may apply).',
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
  return process.env.WEB_BASE_URL?.replace(/\/$/, '') || 'https://beonpoint.netlify.app';
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
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  tryOnPriceCusd,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
  webBaseUrl,
  storefrontWebUrl,
  polaroidWebUrl,
  buildRevenueHint,
};
