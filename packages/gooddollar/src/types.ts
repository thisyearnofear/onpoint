/**
 * GoodDollar integration — typed shapes.
 *
 * These types describe the *results* of GoodDollar interactions. They
 * are intentionally minimal — fields land as the corresponding helpers
 * (claim.ts, streaming.ts, balance.ts) land in subsequent waves.
 *
 * Per ADR 0009, all amounts are in raw 18-decimal bigint units. Human
 * display (e.g. "1,000 G$") is the consumer's responsibility, typically
 * via `formatEther` from viem.
 */

import { type Address, type Hash } from "viem";

// ============================================
// UBI Claim
// ============================================

/**
 * Snapshot of a user's UBI claim status, computed from the on-chain
 * `lastClaim(address)` read. `nextClaimAt` is derived as
 * `lastClaimAt + 24h` when `lastClaimAt > 0`. `canClaim` is true when
 * the current time is past `nextClaimAt` and the caller is whitelisted.
 */
export interface GClaimStatus {
  /** The address checked. */
  address: Address;
  /** Unix timestamp (seconds) of the last successful claim, or 0. */
  lastClaimAt: number;
  /** Unix timestamp (seconds) of the next eligible claim, or 0 if never claimed. */
  nextClaimAt: number;
  /** True if the address is a verified GoodDollar identity (eligible to claim). */
  isWhitelisted: boolean;
  /** True if `now >= nextClaimAt` and `isWhitelisted`. */
  canClaim: boolean;
}

/**
 * Result of an executed claim transaction. The on-chain call returns
 * the amount claimed (always >= 0); the transaction hash is captured
 * regardless so callers can build Celoscan links.
 */
export interface GClaimResult {
  /** Transaction hash of the claim call. */
  hash: Hash;
  /** Amount claimed in raw G$ (18 decimals). 0 if the call reverted. */
  amount: bigint;
  /** Unix timestamp (seconds) the claim landed on-chain. */
  timestamp: number;
  /**
   * If the call reverted, the decoded revert reason. The string is the
   * verbatim output from viem's `decodeErrorResult` — common values:
   *   - "AlreadyClaimed()" — user claimed within the last 24h
   *   - "NotIdentity()" — caller is not a verified GoodDollar identity
   *   - "IdentityEmpty()" — no identities available to claim from
   */
  revertReason?: string;
}

// ============================================
// Superfluid Streaming
// ============================================

/**
 * Direction of a G$ stream. Today OnPoint only opens sender→receiver
 * streams (user pays curator), but the enum reserves receiver→sender
 * for future "tip the stylist" inbound streams.
 */
export type GFlowDirection = "outgoing" | "incoming";

/**
 * Parameters for opening a new G$ stream. The receiver gets
 * `ratePerSecond` wei per second, streamed continuously by Superfluid's
 * CFA until the flow is closed.
 *
 * Per ADR 0009 D6, `ratePerSecond` is locked at stream creation. USD
 * drift over the streaming period is accepted.
 */
export interface GStreamParams {
  /** G$ ERC-20 token address. Defaults to G$ on Celo. */
  token: Address;
  /** Wallet that opens the stream (the payer). */
  sender: Address;
  /** Wallet that receives the stream (the curator / recipient). */
  receiver: Address;
  /** Flow rate in wei-per-second. Must be > 0. */
  ratePerSecond: bigint;
  /** Optional metadata, stored in Superfluid's `userData` field. */
  userData?: `0x${string}`;
}

/**
 * Current state of a stream between two addresses on a given token.
 * Returned by `streaming.ts#getFlowRate` (Wave 3).
 */
export interface GStreamRate {
  token: Address;
  sender: Address;
  receiver: Address;
  /** Flow rate in wei-per-second. 0 means no flow. */
  ratePerSecond: bigint;
  /** Unix timestamp (seconds) the flow was last updated. */
  lastUpdated: number;
}

// ============================================
// Balance Snapshot
// ============================================

/**
 * Cached snapshot of an address's G$ balance + outgoing flow rate.
 * Returned by `balance.ts#getGBalanceSnapshot` (Wave 2). Cached for
 * 30 seconds per address per agent-core convention.
 */
export interface GBalanceSnapshot {
  address: Address;
  /** Raw G$ balance (18 decimals). */
  balance: bigint;
  /** Total outgoing flow rate in wei-per-second across all recipients. */
  outgoingFlowRate: bigint;
  /** Unix timestamp (ms) the snapshot was taken. */
  fetchedAt: number;
}
