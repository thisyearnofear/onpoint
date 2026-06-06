/**
 * Etherfuse onramp quote helper.
 *
 * OnPoint flows ask for a quote first, present it to the user, and only
 * create an order when the user accepts. The quote carries the SPEI / OXXO
 * payment instructions needed to fund the order.
 */

import type { EtherfuseClient } from "./client.js";
import type {
  EtherfuseChain,
  EtherfuseFiat,
  QuoteRequest,
  QuoteResponse,
  TopUpQuote,
  TopUpRequest,
} from "./types.js";

const ETHERFUSE_QUOTE_PATH = "/ramp/quote";

export async function getOnrampQuote(
  client: EtherfuseClient,
  req: QuoteRequest,
): Promise<QuoteResponse> {
  return client.post<QuoteResponse>(ETHERFUSE_QUOTE_PATH, req);
}

/**
 * Convenience wrapper used by OnPoint: it answers the user-facing question
 * "if I send X MXN, how much USDC do I get on Base?"
 */
export async function getTopUpQuote(
  client: EtherfuseClient,
  topUp: TopUpRequest,
): Promise<TopUpQuote> {
  const chain: EtherfuseChain =
    topUp.chain ?? client.config.defaultChain ?? "base";

  const quote = await getOnrampQuote(client, {
    type: "onramp",
    sourceAsset: topUp.fiat,
    targetAsset: "USDC",
    amount: topUp.fiatAmount,
    chain,
  });

  return toTopUpQuote(quote, topUp, chain);
}

function toTopUpQuote(
  quote: QuoteResponse,
  topUp: TopUpRequest,
  chain: EtherfuseChain,
): TopUpQuote {
  return {
    quoteId: quote.quoteId,
    fiat: topUp.fiat,
    fiatAmount: topUp.fiatAmount,
    cryptoAsset: quote.targetAsset,
    cryptoAmount: quote.targetAmount,
    rate: quote.rate,
    fees: quote.fees,
    expiresAt: quote.expiresAt,
    paymentInstructions: quote.paymentInstructions,
    chain,
    recipientAddress: topUp.userAddress,
  };
}

/** Fetch the public exchange rate — useful for "live rate" UI without auth. */
export async function getPublicExchangeRate(
  client: EtherfuseClient,
  fiat: EtherfuseFiat,
): Promise<{ fiat: EtherfuseFiat; rateUsd: string; timestamp: string }> {
  // /ramp/lookup/exchange-rates is public per Etherfuse docs.
  return client.get(`/ramp/lookup/exchange-rates/${fiat}`);
}
