/**
 * x402 Payment Protocol — shared shapes and builders.
 *
 * Single source of truth for building HTTP 402 payment challenges,
 * used by both apps/web (Next routes) and apps/api (Express routes).
 *
 * Network selection is explicit: set X402_NETWORK=celo-alfajores to opt
 * into testnet. The default is Celo mainnet — agent commerce must produce
 * verifiable mainnet activity, so testnet is never inferred from NODE_ENV.
 *
 * Spec: https://github.com/coinbase/x402
 */

/** Structural equivalent of PaymentRequirements from "x402/types". */
export interface X402PaymentRequirements {
  scheme: "exact";
  network: string;
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: string;
}

export interface X402Challenge {
  x402Version: 1;
  accepts: X402PaymentRequirements[];
}

// cUSD — 18 decimals
const CUSD_CELO_MAINNET = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const CUSD_CELO_TESTNET = "0x874069Fa1Eb16D44d622F2e0Ca25eeA172369bC1"; // Alfajores

const IS_TESTNET = process.env.X402_NETWORK === "celo-alfajores";

export const X402_NETWORK = IS_TESTNET ? "celo-alfajores" : "celo";
export const X402_ASSET = IS_TESTNET ? CUSD_CELO_TESTNET : CUSD_CELO_MAINNET;
export const X402_CHAIN_ID = IS_TESTNET ? 44787 : 42220;
export const X402_DECIMALS = 18;

/**
 * Convert a USD amount to an atomic (wei) string without float drift.
 * Truncates beyond 6 decimal places (well below cUSD dust).
 */
export function usdToAtomic(usdAmount: number): string {
  if (!Number.isFinite(usdAmount) || usdAmount < 0) {
    throw new Error(`Invalid USD amount: ${usdAmount}`);
  }
  const micros = BigInt(Math.round(usdAmount * 1_000_000));
  return (micros * 10n ** BigInt(X402_DECIMALS - 6)).toString();
}

/**
 * Build a PaymentRequirements object for a given USD amount.
 * @param usdAmount   Dollar amount (e.g. 5.00)
 * @param payTo       Recipient address
 * @param resource    Full URL of the resource being gated
 * @param description Human-readable description shown in wallet UI
 */
export function buildPaymentRequirements(
  usdAmount: number,
  payTo: string,
  resource: string,
  description: string,
): X402PaymentRequirements {
  return {
    scheme: "exact",
    network: X402_NETWORK,
    maxAmountRequired: usdToAtomic(usdAmount),
    resource,
    description,
    mimeType: "application/json",
    payTo,
    maxTimeoutSeconds: 300,
    asset: X402_ASSET,
  };
}

/** Standard 402 response body per x402 spec. */
export function build402Body(
  requirements: X402PaymentRequirements[],
): X402Challenge {
  return { x402Version: 1, accepts: requirements };
}

/** Extract the X-PAYMENT header value from a Headers object. */
export function getPaymentHeader(headers: {
  get(name: string): string | null;
}): string | null {
  return headers.get("X-PAYMENT") ?? headers.get("x-payment");
}
