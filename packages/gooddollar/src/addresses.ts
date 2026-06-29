/**
 * GoodDollar G$ — contract addresses, single source of truth.
 *
 * Mirrors the shape of `@repo/agent-core/chains` `TOKEN_ADDRESSES` but
 * scoped to GoodDollar-specific concerns (Identity, UBIScheme, Faucet,
 * Superfluid forwarder).
 *
 * Verified against the official @goodsdks/citizen-sdk v1.2.5 contract
 * addresses and GoodDollar docs (https://docs.gooddollar.org/for-developers/core-contracts).
 *
 * GoodDollar on Celo uses THREE separate contracts:
 *   - Identity:  whitelist + face-verification state (isWhitelisted, getWhitelistedRoot)
 *   - UBIScheme: daily claim distribution (claim, checkEntitlement)
 *   - Faucet:    gas sponsorship for claims (topWallet)
 *
 * The G$ token on Celo is a native Superfluid SuperToken (SuperGoodDollar.sol),
 * so streaming works without wrapping.
 */

import { type Address } from "viem";

/**
 * G$ ERC-20 / SuperToken address by chain. On Celo this is a native
 * Superfluid SuperToken — no wrapping needed for streaming.
 */
export const GOOD_DOLLAR_TOKEN_ADDRESSES: Record<string, Address | null> = {
  celo: "0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A" as Address,
  celoSepolia: null,
  base: null,
  ethereum: "0x67C5870b4A41D4Ebef24d2456547A03F1f3e094B" as Address,
  polygon: null,
  arbitrum: null,
};

/**
 * Superfluid CFAv1Forwarder on Celo. The canonical forwarder for
 * createFlow / updateFlow / deleteFlow on G$ (native SuperToken).
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
 * GoodDollar Identity contract. Handles whitelist management, face
 * verification state, and wallet-linking (connected accounts).
 *
 * Key methods: isWhitelisted, getWhitelistedRoot, lastAuthenticated,
 * authenticationPeriod, connectAccount, disconnectAccount.
 */
export const GOODDOLLAR_IDENTITY_ADDRESSES: Record<string, Address | null> = {
  celo: "0xC361A6E67822a0EDc17D899227dd9FC50BD62F42" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
};

/**
 * GoodDollar UBIScheme contract. Handles daily UBI distribution.
 *
 * Key methods: claim, checkEntitlement, nextClaimTime.
 * This is SEPARATE from the Identity contract — do not confuse them.
 */
export const GOODDOLLAR_UBISCHEME_ADDRESSES: Record<string, Address | null> = {
  celo: "0x43d72Ff17701B2DA814620735C39C620Ce0ea4A1" as Address,
  celoSepolia: null,
  base: null,
  ethereum: null,
  polygon: null,
  arbitrum: null,
};

/**
 * GoodDollar Faucet contract. Provides gas sponsorship so users can
 * claim UBI without holding CELO. The faucet tops up the user's
 * native balance just enough for a claim transaction.
 */
export const GOODDOLLAR_FAUCET_ADDRESSES: Record<string, Address | null> = {
  celo: "0x4F93Fa058b03953C851eFaA2e4FC5C34afDFAb84" as Address,
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

/** Resolve GoodDollar Identity contract. Null where not deployed. */
export function getGoodDollarIdentityAddress(chain: string): Address | null {
  return GOODDOLLAR_IDENTITY_ADDRESSES[chain] ?? null;
}

/** Resolve GoodDollar UBIScheme (claim) contract. Null where not deployed. */
export function getGoodDollarUbiSchemeAddress(chain: string): Address | null {
  return GOODDOLLAR_UBISCHEME_ADDRESSES[chain] ?? null;
}

/** Resolve GoodDollar Faucet contract. Null where not deployed. */
export function getGoodDollarFaucetAddress(chain: string): Address | null {
  return GOODDOLLAR_FAUCET_ADDRESSES[chain] ?? null;
}

/** True if GoodDollar is live on the given chain (token + identity + UBI deployed). */
export function isGoodDollarLiveChain(chain: string): boolean {
  return (
    GOOD_DOLLAR_TOKEN_ADDRESSES[chain] != null &&
    GOODDOLLAR_IDENTITY_ADDRESSES[chain] != null &&
    GOODDOLLAR_UBISCHEME_ADDRESSES[chain] != null
  );
}
