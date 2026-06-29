/**
 * @repo/gooddollar — claim helper.
 *
 * Wave 2 implementation. Reads UBI claim status from the GoodDollar
 * Identity + UBIScheme contracts and submits claim transactions via viem.
 *
 * GoodDollar on Celo uses TWO separate contracts:
 *   - Identity:  isWhitelisted, getWhitelistedRoot (whitelist checks)
 *   - UBIScheme: claim, checkEntitlement (claim distribution)
 *
 * Per ADR 0009, this module:
 *   - Resolves contract addresses via @repo/gooddollar/addresses
 *   - Uses getWhitelistedRoot (not just isWhitelisted) to handle connected wallets
 *   - Uses checkEntitlement for accurate claim eligibility (not lastClaim + 24h)
 *   - Surfaces revert reasons verbatim
 *   - Uses viem directly — no ethers
 *
 * For the full delightful UX (face verification, gas faucet, multi-chain
 * fallback), use @goodsdks/citizen-sdk's ClaimSDK in the web layer.
 * This module is the raw-viem alternative for non-web consumers.
 */

import {
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
  type Chain,
  decodeErrorResult,
} from "viem";

import { type GClaimStatus, type GClaimResult } from "./types.js";
import {
  GOODDOLLAR_IDENTITY_ABI,
  GOODDOLLAR_UBISCHEME_ABI,
} from "./abis.js";
import {
  getGoodDollarIdentityAddress,
  getGoodDollarUbiSchemeAddress,
} from "./addresses.js";

/** 24 hours in seconds — approximate claim cooldown for UI display. */
const CLAIM_COOLDOWN_SECONDS = 24 * 60 * 60;

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

/**
 * Map a viem `Chain` to the string key used by the address tables.
 */
function chainKey(chain: Chain | undefined): string | null {
  if (!chain) return null;
  if (chain.id === 42220) return "celo";
  if (chain.id === 11155929) return "celoSepolia";
  return chain.name?.toLowerCase() ?? null;
}

/**
 * Read a user's UBI claim status.
 *
 * Reads `getWhitelistedRoot` from the Identity contract (handles connected
 * wallets — returns the root whitelisted address, or zero address if not
 * eligible) and `checkEntitlement` from the UBIScheme contract (returns the
 * claimable amount, 0 if already claimed or not eligible).
 *
 * @param publicClient  viem PublicClient connected to the target chain
 * @param address       The wallet to check
 * @param chain         Optional chain key override (e.g. "celo")
 */
export async function getClaimStatus(
  publicClient: PublicClient,
  address: Address,
  chain?: string,
): Promise<GClaimStatus> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'getClaimStatus: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const identity = getGoodDollarIdentityAddress(key);
  const ubiScheme = getGoodDollarUbiSchemeAddress(key);
  if (!identity || !ubiScheme) {
    throw new Error(
      `getClaimStatus: GoodDollar not fully deployed on chain "${key}".`,
    );
  }

  // getWhitelistedRoot handles connected wallets: returns the root
  // whitelisted address (non-zero) if eligible, zero address if not.
  // checkEntitlement returns the claimable amount (0 if already claimed).
  const [rootRaw, entitlement] = await Promise.all([
    publicClient.readContract({
      address: identity,
      abi: GOODDOLLAR_IDENTITY_ABI,
      functionName: "getWhitelistedRoot",
      args: [address],
    }) as Promise<Address>,
    publicClient.readContract({
      address: ubiScheme,
      abi: GOODDOLLAR_UBISCHEME_ABI,
      functionName: "checkEntitlement",
      args: [address],
    }) as Promise<bigint>,
  ]);

  const isWhitelisted = rootRaw !== ZERO_ADDRESS;
  const now = Math.floor(Date.now() / 1000);
  // If entitlement > 0, user can claim right now. Otherwise approximate
  // nextClaimAt as now + 24h for UI display (the on-chain contract enforces
  // the real rule — claim resets at 12pm UTC).
  const canClaim = isWhitelisted && entitlement > 0n;
  const nextClaimAt = canClaim ? 0 : now + CLAIM_COOLDOWN_SECONDS;

  return {
    address,
    lastClaimAt: 0, // UBIScheme doesn't expose lastClaim directly; use entitlement
    nextClaimAt,
    isWhitelisted,
    canClaim,
  };
}

/**
 * Submit a UBI claim transaction on the UBIScheme contract.
 *
 * Simulates the claim first to surface revert reasons before prompting
 * the user to sign. After the transaction is mined, returns the hash and
 * on-chain timestamp.
 *
 * NOTE: This does NOT handle gas faucet or face verification. For the
 * full delightful UX, use @goodsdks/citizen-sdk's ClaimSDK which handles
 * gas sponsorship and FV redirect automatically.
 *
 * @param walletClient  viem WalletClient — the connected signer
 * @param publicClient  viem PublicClient on the same chain
 * @param account       The claiming wallet address
 * @param chain         Optional chain key override
 */
export async function claimUBI(
  walletClient: WalletClient,
  publicClient: PublicClient,
  account: Address,
  chain?: string,
): Promise<GClaimResult> {
  const key = chain ?? chainKey(publicClient.chain);
  if (!key) {
    throw new Error(
      'claimUBI: could not resolve chain — pass an explicit chain key (e.g. "celo").',
    );
  }

  const ubiScheme = getGoodDollarUbiSchemeAddress(key);
  if (!ubiScheme) {
    throw new Error(
      `claimUBI: GoodDollar UBIScheme not deployed on chain "${key}".`,
    );
  }

  // Simulate first to catch reverts before prompting the user.
  try {
    await publicClient.simulateContract({
      address: ubiScheme,
      abi: GOODDOLLAR_UBISCHEME_ABI,
      functionName: "claim",
      account,
    });
  } catch (err) {
    const revertReason = tryDecodeRevert(err);
    if (revertReason) {
      throw new Error(`claimUBI: ${revertReason}`);
    }
    throw err;
  }

  // Submit the transaction.
  const hash = (await walletClient.writeContract({
    address: ubiScheme,
    abi: GOODDOLLAR_UBISCHEME_ABI,
    functionName: "claim",
    account,
    chain: publicClient.chain,
  })) as Hash;

  const receipt = (await publicClient.waitForTransactionReceipt({
    hash,
  }));

  // Use the block timestamp as the canonical claim time.
  let timestamp = Math.floor(Date.now() / 1000);
  try {
    const block = await publicClient.getBlock({
      blockHash: receipt.blockHash,
    });
    timestamp = Number(block.timestamp);
  } catch {
    // Fall back to wall-clock if block fetch fails.
  }

  // The claim amount isn't returned by the UBIScheme claim() function
  // (void return). We'd need to parse logs or re-read entitlement.
  // For now, return 0n — the SDK's ClaimSDK handles this better.
  return {
    hash,
    amount: 0n,
    timestamp,
  };
}

/**
 * Best-effort decode of a viem contract-call revert into a human-readable
 * reason string.
 */
function tryDecodeRevert(err: unknown): string | undefined {
  try {
    const decoded = decodeErrorResult({
      abi: GOODDOLLAR_UBISCHEME_ABI,
      data: (err as { data?: `0x${string}` })?.data ?? (err as { raw?: `0x${string}` })?.raw,
    } as Parameters<typeof decodeErrorResult>[0]);
    if (decoded) {
      return `${decoded.errorName}(${decoded.args?.join(", ") ?? ""})`;
    }
  } catch {
    // Not a decoded revert — fall through.
  }
  const short = (err as { shortMessage?: string })?.shortMessage;
  if (short) return short;
  return undefined;
}
