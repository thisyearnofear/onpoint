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
 * Per-curator override: if the curator's commerce config has
 * tryOnPriceUsd, use it. Otherwise fall back to the env var
 * X402_TRYON_PRICE_USD (default: 0.03 — see ADR 0013).
 *
 * @param {object} [curator] — optional curator record for per-curator pricing
 */
function tryOnPriceCusd(curator) {
  // Per-curator override
  const perCurator = Number(curator?.commerce?.tryOnPriceUsd);
  if (Number.isFinite(perCurator) && perCurator > 0) return perCurator;

  // Global env var
  const price = Number(process.env.X402_TRYON_PRICE_USD);
  return Number.isFinite(price) && price > 0 ? price : 0.03;
}

/** Storefront-level agent commerce metadata (chain, token, order endpoint). */
function buildStorefrontAgentCommerce(curator, slug) {
  const enabled = Boolean(curatorPayoutAddress(curator));
  const splitAddr = curatorSplitAddress(curator);
  const tryOnPrice = tryOnPriceCusd(curator);
  return {
    enabled,
    chain: 'celo',
    chainId: sharedTypes.X402_CHAIN_ID,
    network: sharedTypes.X402_NETWORK,
    token: **********************,
    tokenSymbol: 'cUSD',
    orderEndpoint: `/api/curator/${slug}/order`,
    payoutModel: splitAddr ? '0xSplits (non-custodial)' : 'custodial',
    splitAddress: splitAddr || undefined,
    tryOn: {
      endpoint: '/api/agent/try-on',
      priceCusd: tryOnPrice,
      description:
        'x402-paid fitting room: POST {curatorSlug, listingId, photoData} to render this catalog on your human and get a fit signal before buying.',
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

module.exports = {
  kesToCusd,
  kesPerUsd,
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  tryOnPriceCusd,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
};
