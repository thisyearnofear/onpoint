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

// USDC on Base Sepolia (testnet) — 6 decimals
const USDC_BASE_SEPOLIA = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";
// USDC on Base mainnet — 6 decimals
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const IS_TESTNET = process.env.NODE_ENV !== "production";

export const X402_NETWORK = IS_TESTNET ? "base-sepolia" : "base";
export const X402_ASSET = IS_TESTNET ? USDC_BASE_SEPOLIA : USDC_BASE;
// 6 decimals: 1 USDC = 1_000_000
export const X402_DECIMALS = 6;

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
    network: X402_NETWORK,
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
