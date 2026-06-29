/**
 * @repo/gooddollar — GoodDollar G$ integration for OnPoint
 *
 * Single source of truth for GoodDollar contract addresses, ABIs, claim
 * helpers, and Superfluid streaming helpers. Mirrors the shape of
 * `@repo/etherfuse`. See ADR 0009.
 *
 * This file is intentionally minimal in Wave 1 (skeleton): addresses,
 * ABIs, and types only. Claim, streaming, and balance helpers land in
 * subsequent waves per the implementation plan in
 * docs/hackathons/goodbuilders-season-4.md.
 */

export {
  GOOD_DOLLAR_TOKEN_ADDRESSES,
  SUPERFLUID_CFA_FORWARDER_ADDRESSES,
  GOODDOLLAR_IDENTITY_ADDRESSES,
  getGTokenAddress,
  getSuperfluidCFAForwarderAddress,
  getGoodDollarIdentityAddress,
  isGoodDollarLiveChain,
} from "./addresses.js";

export {
  ERC20_ABI,
  SUPERFLUID_CFA_FORWARDER_ABI,
  GOODDOLLAR_IDENTITY_ABI,
} from "./abis.js";

export type {
  GClaimResult,
  GClaimStatus,
  GStreamParams,
  GFlowDirection,
  GStreamRate,
  GBalanceSnapshot,
} from "./types.js";
