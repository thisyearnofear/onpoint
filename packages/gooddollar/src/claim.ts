/**
 * @repo/gooddollar — claim helper.
 *
 * Wave 2 stub. The real implementation lands with the integration of
 * Integration 3 (G$ claim onboarding) per
 * docs/hackathons/goodbuilders-season-4.md Wave 2.
 *
 * Per ADR 0009, this module MUST:
 *   - Resolve the Identity address via @repo/gooddollar/addresses
 *   - Read `lastClaim` and `isWhitelisted` before submitting
 *   - Surface revert reasons verbatim (per integration 3 risk register)
 *   - Use viem directly — no Superfluid SDK, no ethers
 */

import { type GClaimStatus, type GClaimResult } from "./types.js";

/**
 * Read a user's claim status. Wave 2 implementation will accept a
 * viem `PublicClient` and use `GOODDOLLAR_IDENTITY_ABI`. The stub
 * exists so consumers can import the symbol and write call sites
 * today, before the implementation lands.
 */
export async function getClaimStatus(
  _address: `0x${string}`,
): Promise<GClaimStatus> {
  throw new Error(
    "getClaimStatus: not implemented (Wave 2 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}

/**
 * Submit a UBI claim transaction. Wave 2 implementation will accept a
 * viem `WalletClient` + `PublicClient`, build the claim call against
 * the Identity contract on Celo, and return the parsed result.
 */
export async function claimUBI(
  _account: `0x${string}`,
): Promise<GClaimResult> {
  throw new Error(
    "claimUBI: not implemented (Wave 2 — see docs/hackathons/goodbuilders-season-4.md).",
  );
}
