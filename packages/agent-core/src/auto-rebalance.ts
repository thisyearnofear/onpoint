/**
 * Auto-Rebalance Escrow — Detection Module
 *
 * Scans all user escrow balances and surfaces accounts whose balance has
 * drifted significantly from their spending limits. This is the
 * *detection* layer — actual refunds stay user-initiated (the user must
 * call /api/agent/escrow/withdraw themselves) to avoid the agent moving
 * money unilaterally.
 *
 * Threshold logic (configurable via thresholdMultiplier, default 1.5):
 *   - balance > dailyLimit * thresholdMultiplier  → "over"  (excess)
 *   - balance < dailyLimit * (2 - thresholdMultiplier) → "under" (starved)
 *   - else                                     → "ok"
 *
 * With the default 1.5 multiplier:
 *   - balance > 1.5 × daily_limit  → "over"  (refund excess)
 *   - balance < 0.5 × daily_limit  → "under" (needs top-up)
 *
 * Designed to be called once per heartbeat cycle. For very large user
 * counts, see `detectRebalanceCandidatesWithPagination`.
 *
 * Why detection-only (v1)?
 *   The withdrawal path requires on-chain transactions signed by either
 *   the user's wallet or the agent's. Auto-signing refunds adds policy
 *   decisions (how much, how often, who pays gas) that warrant a
 *   separate design pass. Detection surfaces the candidates via metrics
 *   so the operator (or a future user-facing notification) can act.
 */

import { logger } from "./logger";
import { Metrics } from "./metrics";
import { getEscrowBalance, type EscrowBalance } from "./escrow-service";
import { loadSpendingLimits } from "./agent-store";
import { redisScan } from "./redis-helpers";

// ============================================
// Types
// ============================================

export type RebalanceReason = "over" | "under" | "ok";

export interface RebalanceCandidate {
  userId: string;
  agentId: string;
  currentBalance: bigint;
  dailyLimit: bigint;
  excess: bigint; // positive if over, negative if under, zero if ok
  reason: RebalanceReason;
}

export interface RebalanceStats {
  scannedUsers: number;
  candidates: RebalanceCandidate[];
  usersOver: number;
  usersUnder: number;
  totalExcessWei: bigint;
  totalShortfallWei: bigint;
  durationMs: number;
}

// ============================================
// Constants
// ============================================

const DEFAULT_THRESHOLD_MULTIPLIER = 1.5;
const DEFAULT_MAX_USERS_PER_CYCLE = 500;
const ESCROW_BALANCE_KEY_PATTERN = (agentId: string) =>
  `escrow:balance:*:${agentId}`;

// ============================================
// Detection
// ============================================

/**
 * Detect escrow accounts whose balance has drifted significantly from
 * their daily spending limit.
 *
 * @param agentId       — which agent's users to scan
 * @param thresholdMul  — over = balance > limit * thresholdMul
 *                        under = balance < limit * (2 - thresholdMul)
 * @param maxUsers      — cap on users scanned per call (for safety)
 */
export async function detectRebalanceCandidates(
  agentId: string,
  thresholdMul: number = DEFAULT_THRESHOLD_MULTIPLIER,
  maxUsers: number = DEFAULT_MAX_USERS_PER_CYCLE,
): Promise<RebalanceCandidate[]> {
  if (thresholdMul <= 1.0 || thresholdMul >= 2.0) {
    throw new Error(
      `thresholdMultiplier must be in (1.0, 2.0); got ${thresholdMul}`,
    );
  }

  // Find all escrow balance keys for this agent. Key format:
  //   escrow:balance:{userId}:{agentId}
  const keys = await redisScan(ESCROW_BALANCE_KEY_PATTERN(agentId), maxUsers);
  if (keys.length === 0) return [];

  const candidates: RebalanceCandidate[] = [];

  for (const key of keys) {
    // Extract userId from key. Splitting is cheap and the key format
    // is stable (see ESCROW_BALANCE_KEY in escrow-service.ts).
    const parts = key.split(":");
    if (parts.length < 4) continue;
    const userId = parts.slice(2, -1).join(":");
    if (!userId) continue;

    const balance = await getEscrowBalance(userId, agentId);
    if (!balance) continue;

    const limits = await loadSpendingLimits(agentId, userId);
    if (!limits) continue;

    const dailyLimit = BigInt(limits.daily || "0");
    if (dailyLimit === 0n) continue; // no limit set — skip

    const currentBalance = BigInt(balance.balance);

    const overThreshold = dailyLimit * BigInt(Math.floor(thresholdMul * 1000)) / 1000n;
    const underThreshold = dailyLimit * BigInt(Math.floor((2 - thresholdMul) * 1000)) / 1000n;

    let reason: RebalanceReason = "ok";
    let excess = 0n;

    if (currentBalance > overThreshold) {
      reason = "over";
      excess = currentBalance - dailyLimit;
    } else if (currentBalance < underThreshold) {
      reason = "under";
      excess = currentBalance - dailyLimit; // negative
    }

    if (reason !== "ok") {
      candidates.push({
        userId,
        agentId,
        currentBalance,
        dailyLimit,
        excess,
        reason,
      });
    }
  }

  return candidates;
}

/**
 * Detect candidates + aggregate stats. Designed for the heartbeat call
 * site — one round-trip with everything needed for metrics + logs.
 */
export async function getRebalanceStats(
  agentId: string,
  thresholdMul: number = DEFAULT_THRESHOLD_MULTIPLIER,
): Promise<RebalanceStats> {
  const start = Date.now();

  const candidates = await detectRebalanceCandidates(agentId, thresholdMul);

  let totalExcessWei = 0n;
  let totalShortfallWei = 0n;
  let usersOver = 0;
  let usersUnder = 0;

  for (const c of candidates) {
    if (c.reason === "over") {
      totalExcessWei += c.excess;
      usersOver++;
    } else if (c.reason === "under") {
      totalShortfallWei += -c.excess; // excess is negative for "under"
      usersUnder++;
    }
  }

  return {
    scannedUsers: candidates.length,
    candidates,
    usersOver,
    usersUnder,
    totalExcessWei,
    totalShortfallWei,
    durationMs: Date.now() - start,
  };
}

// ============================================
// Metrics
// ============================================

/**
 * Update Prometheus metrics from a rebalance stats result.
 * Called from the heartbeat after getRebalanceStats.
 */
export function updateRebalanceMetrics(stats: RebalanceStats): void {
  Metrics.setEscrowRebalanceCandidates("over", stats.usersOver);
  Metrics.setEscrowRebalanceCandidates("under", stats.usersUnder);
  Metrics.setEscrowRebalanceExcess(stats.totalExcessWei);
  Metrics.setEscrowRebalanceShortfall(stats.totalShortfallWei);
}

// ============================================
// Default export for convenience
// ============================================

export const AutoRebalance = {
  detectRebalanceCandidates,
  getRebalanceStats,
  updateRebalanceMetrics,
};

export default AutoRebalance;