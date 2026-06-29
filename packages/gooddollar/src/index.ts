/**
 * @repo/gooddollar — GoodDollar G$ integration for OnPoint
 *
 * Single source of truth for GoodDollar contract addresses, ABIs, claim
 * helpers, and Superfluid streaming helpers. Mirrors the shape of
 * `@repo/etherfuse`. See ADR 0009.
 */

export {
  GOOD_DOLLAR_TOKEN_ADDRESSES,
  SUPERFLUID_CFA_FORWARDER_ADDRESSES,
  GOODDOLLAR_IDENTITY_ADDRESSES,
  GOODDOLLAR_UBISCHEME_ADDRESSES,
  GOODDOLLAR_FAUCET_ADDRESSES,
  getGTokenAddress,
  getSuperfluidCFAForwarderAddress,
  getGoodDollarIdentityAddress,
  getGoodDollarUbiSchemeAddress,
  getGoodDollarFaucetAddress,
  isGoodDollarLiveChain,
} from "./addresses.js";

export {
  ERC20_ABI,
  SUPERFLUID_CFA_FORWARDER_ABI,
  GOODDOLLAR_IDENTITY_ABI,
  GOODDOLLAR_UBISCHEME_ABI,
  GOODDOLLAR_FAUCET_ABI,
} from "./abis.js";

export type {
  GClaimResult,
  GClaimStatus,
  GStreamParams,
  GFlowDirection,
  GStreamRate,
  GBalanceSnapshot,
} from "./types.js";

export { getClaimStatus, claimUBI } from "./claim.js";
export { getGBalanceSnapshot, formatGAmount } from "./balance.js";
export {
  createGStream,
  updateGStream,
  deleteGStream,
  getFlowRate,
  getTotalFlowRate,
  monthlyToFlowRate,
  flowRateToMonthly,
} from "./streaming.js";
