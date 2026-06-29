/**
 * GoodDollar G$ — contract addresses, single source of truth.
 *
 * Mirrors the shape of `@repo/agent-core/chains` `TOKEN_ADDRESSES` but
 * scoped to GoodDollar-specific concerns (Identity, Superfluid forwarder).
 * Per ADR 0009 D2, G$ is also registered in agent-core's `TOKEN_ADDRESSES`
 * so generic ERC-20 helpers (transfer, balanceOf) resolve it the same way
 * as cUSD and USDT. This module is for GoodDollar-specific surfaces only.
 *
 * Verified against:
 *   - CeloScan: https://celoscan.io/token/0x62B8B1109F25406f3D27cDaA3F8d2305d6eDbBB7
 *   - GoodDollar docs: https://docs.gooddollar.org
 *   - Superfluid docs (Celo forwarder):
 *     https://docs.superfluid.finance/developers/constant-flow-agreement-cfa
 *
 * GoodDollar Identity (a.k.a. "UBI contract") is the entry point for the
 * daily UBI claim. Address on Celo mainnet verified against the
 * GoodDollar protocol deployment on 2026-06-29. If GoodDollar migrates
 * contracts, update here and the canonical @repo/agent-core/chains map in
 * the same commit.
 */

import { type Address } from "viem";

/**
 * G$ ERC-20 token address by chain. Mirrors agent-core's TOKEN_ADDRESSES
 * for the GOOD_DOLLAR key. Re-declared here so this package is importable
 * from web/api without pulling in agent-core's chain definitions.
 */
export const GOOD_DOLLAR_TOKEN_ADDRESSES: Record<string, Address | null> = {
  celo: "0x62B8B1109F25406f3D27cDaA3F8d2305d6eDbBB7" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
};

/**
 * Superfluid CFAv1Forwarder on Celo. The canonical forwarder for
 * createFlow / updateFlow / deleteFlow on G$ (native SuperToken). Single
 * deployment per chain. Mirrors agent-core's SUPERFLUID_CFA_FORWARDER.
 */
export const SUPERFLUID_CFA_FORWARDER_ADDRESSES: Record<string, Address | null> = {
  celo: "0xcfA132E353cB4E398081B7F68C40dA562f0Fa1Da" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
};

/**
 * GoodDollar Identity (UBI) contract. Entry point for daily claim. The
 * `claim()` function on this contract enforces GoodDollar's per-identity
 * rate limit on-chain — OnPoint's app-layer caps exist only to make the
 * audit trail honest (see ADR 0009 D3).
 *
 * Address verified against the official GoodDollar protocol docs as of
 * 2026-06-29. If GoodDollar migrates to V4 or a new Identity, this is
 * the single line that needs to change.
 */
export const GOODDOLLAR_IDENTITY_ADDRESSES: Record<string, Address | null> = {
  celo: "0xC95eb8842A2e4E20112E0Fc88b9eE852d7A5E89a" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
};

// ============================================
// Resolver helpers (single source of truth)
// ============================================

/** Resolve G$ token address. Null on chains where G$ is not deployed. */
export function getGTokenAddress(chain: string): Address | null {
  return GOOD_DOLLAR_TOKEN_ADDRESSES[chain] ?? null;
}

/** Resolve Superfluid CFAv1Forwarder. Null where Superfluid is not deployed. */
export function getSuperfluidCFAForwarderAddress(chain: string): Address | null {
  return SUPERFLUID_CFA_FORWARDER_ADDRESSES[chain] ?? null;
}

/** Resolve GoodDollar Identity (UBI) contract. Null where not deployed. */
export function getGoodDollarIdentityAddress(chain: string): Address | null {
  return GOODDOLLAR_IDENTITY_ADDRESSES[chain] ?? null;
}

/** True if GoodDollar is live on the given chain (token + identity deployed). */
export function isGoodDollarLiveChain(chain: string): boolean {
  return (
    GOOD_DOLLAR_TOKEN_ADDRESSES[chain] != null &&
    GOODDOLLAR_IDENTITY_ADDRESSES[chain] != null
  );
}
