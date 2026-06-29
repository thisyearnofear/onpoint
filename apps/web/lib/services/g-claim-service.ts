/**
 * g-claim-service — GoodDollar claim service backed by @goodsdks/citizen-sdk.
 *
 * This is the primary UI-facing service for GoodDollar UBI claims. It wraps
 * the official citizen-sdk (viem-based) which handles:
 *   - Identity verification (getWhitelistedRoot, generateFVLink)
 *   - Entitlement checking (checkEntitlement)
 *   - Claim submission with gas faucet (claim)
 *   - Multi-chain fallback
 *
 * The raw-viem helpers in @repo/gooddollar/claim.ts remain available for
 * non-web consumers (api server, scripts) but do NOT handle gas faucet or
 * face verification. This service is the delightful path.
 */

import { type Address, type PublicClient, type WalletClient } from "viem";
import {
  IdentitySDK,
  ClaimSDK,
  type ClaimEntitlementResult,
  type IdentityExpiryData,
} from "@goodsdks/citizen-sdk";
import { formatGAmount } from "@repo/gooddollar";

export { formatGAmount };

/** GoodDollar environment — always production in the live app. */
const ENV = "production" as const;

/**
 * Initialize the IdentitySDK from wagmi-provided viem clients.
 * Returns null if the wallet is not connected.
 */
export async function createIdentitySDK(
  publicClient: PublicClient | undefined,
  walletClient: WalletClient | undefined,
  account: Address | undefined,
): Promise<IdentitySDK | null> {
  if (!publicClient || !walletClient || !account) return null;
  try {
    return new IdentitySDK({
      account,
      publicClient,
      walletClient,
      env: ENV,
    });
  } catch {
    return null;
  }
}

/**
 * Initialize the ClaimSDK from wagmi-provided viem clients.
 * Returns null if the wallet is not connected.
 */
export async function createClaimSDK(
  publicClient: PublicClient | undefined,
  walletClient: WalletClient | undefined,
  account: Address | undefined,
): Promise<ClaimSDK | null> {
  if (!publicClient || !walletClient || !account) return null;
  try {
    const identitySDK = new IdentitySDK({
      account,
      publicClient,
      walletClient,
      env: ENV,
    });
    return new ClaimSDK({
      account,
      publicClient,
      walletClient,
      identitySDK,
      env: ENV,
    });
  } catch {
    return null;
  }
}

/**
 * Check if the connected wallet is whitelisted (or connected to a
 * whitelisted root). Uses getWhitelistedRoot which handles connected
 * wallets properly.
 */
export async function checkWhitelist(
  identitySDK: IdentitySDK | null,
  address: Address,
): Promise<{ isWhitelisted: boolean; root: Address }> {
  if (!identitySDK) {
    return {
      isWhitelisted: false,
      root: "0x0000000000000000000000000000000000000000" as Address,
    };
  }
  return identitySDK.getWhitelistedRoot(address);
}

/**
 * Check the claimable entitlement for the connected wallet.
 * Returns the amount (0 if not eligible or already claimed).
 */
export async function checkEntitlement(
  claimSDK: ClaimSDK | null,
): Promise<ClaimEntitlementResult | null> {
  if (!claimSDK) return null;
  try {
    return await claimSDK.checkEntitlement();
  } catch {
    return null;
  }
}

/**
 * Get the next claim time for the connected wallet.
 * Returns a Date (epoch if can claim now).
 */
export async function getNextClaimTime(
  claimSDK: ClaimSDK | null,
): Promise<Date | null> {
  if (!claimSDK) return null;
  try {
    return await claimSDK.nextClaimTime();
  } catch {
    return null;
  }
}

/**
 * Generate a face verification link for in-app identity verification.
 * The link opens GoodDollar's FV flow; after completion, the user's
 * connected wallet is whitelisted.
 *
 * @param identitySDK  The IdentitySDK instance
 * @param callbackUrl  URL to redirect back to after FV completes
 */
export async function generateFVLink(
  identitySDK: IdentitySDK | null,
  callbackUrl?: string,
): Promise<string | null> {
  if (!identitySDK) return null;
  try {
    return await identitySDK.generateFVLink(true, callbackUrl);
  } catch {
    return null;
  }
}

/**
 * Submit a UBI claim. The ClaimSDK handles:
 *   1. Whitelist check (redirects to FV if not whitelisted)
 *   2. Entitlement check
 *   3. Gas faucet (if balance too low)
 *   4. Claim transaction
 *
 * @param claimSDK    The ClaimSDK instance
 * @param onConfirm   Optional callback for transaction confirmation prompts
 * @returns           The transaction receipt
 */
export async function claimUBI(
  claimSDK: ClaimSDK | null,
  onConfirm?: (message: string) => void | Promise<void>,
): Promise<`0x${string}` | null> {
  if (!claimSDK) return null;
  const receipt = await claimSDK.claim(onConfirm);
  return (receipt as { transactionHash?: `0x${string}` })?.transactionHash ?? null;
}

/**
 * Get identity expiry data for the connected wallet.
 */
export async function getIdentityExpiry(
  identitySDK: IdentitySDK | null,
  address: Address,
): Promise<IdentityExpiryData | null> {
  if (!identitySDK) return null;
  try {
    return await identitySDK.getIdentityExpiryData(address);
  } catch {
    return null;
  }
}
