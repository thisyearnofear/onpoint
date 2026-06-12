/**
 * x402 Payment Protocol utilities
 *
 * Builds PaymentRequirements for HTTP 402 responses and validates
 * incoming X-PAYMENT headers. Uses Base Sepolia (testnet) for demo;
 * swap network to "base" for mainnet.
 *
 * Spec: https://github.com/coinbase/x402
 */

import type { PaymentRequirements } from "x402/types";

// cUSD on Celo Alfajores (testnet) — 18 decimals
const CUSD_CELO_TESTNET = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1";
// cUSD on Celo mainnet — 18 decimals
const CUSD_CELO_MAINNET = "0x765DE8164458C172EE097029dfb482Ff182ad001";

const IS_TESTNET = process.env.NODE_ENV !== "production";

export const X402_NETWORK = IS_TESTNET ? "celo-alfajores" : "celo";
export const X402_ASSET = IS_TESTNET ? CUSD_CELO_TESTNET : CUSD_CELO_MAINNET;
// 18 decimals: 1 cUSD = 1_000_000_000_000_000_000
export const X402_DECIMALS = 18;

/**
 * Build a PaymentRequirements object for a given USD amount.
 * @param usdAmount  Dollar amount (e.g. 5.00)
 * @param payTo      Recipient address (agent wallet)
 * @param resource   Full URL of the resource being gated
 * @param description Human-readable description shown in wallet UI
 */
export function buildPaymentRequirements(
  usdAmount: number,
  payTo: string,
  resource: string,
  description: string,
): PaymentRequirements {
  const atomicAmount = Math.round(usdAmount * 10 ** X402_DECIMALS).toString();
  return {
    scheme: "exact",
    network: X402_NETWORK as PaymentRequirements["network"],
    maxAmountRequired: atomicAmount,
    resource,
    description,
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: X402_ASSET,
  };
}

/**
 * Extract the X-PAYMENT header value from a Request.
 * Returns null if absent.
 */
export function getPaymentHeader(headers: Headers): string | null {
  return headers.get("X-PAYMENT") ?? headers.get("x-payment");
}

/**
 * Build the standard 402 response body per x402 spec.
 */
export function payment402Response(
  requirements: PaymentRequirements[],
): Response {
  return new Response(
    JSON.stringify({ x402Version: 1, accepts: requirements }),
    {
      status: 402,
      headers: {
        "Content-Type": "application/json",
        "X-Payment-Required": "true",
      },
    },
  );
}
