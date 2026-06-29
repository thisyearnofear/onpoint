/**
 * Spend Policy Engine - Agent Spending Controls
 *
 * Enforces spending limits based on agent reputation tier. OWS can be used as
 * an optional backend enforcement layer, but the product primitive is the
 * user-visible spending policy.
 * Prevents runaway agents from draining wallets.
 *
 * Onramp credits (via Etherfuse top-ups) are tracked separately by the
 * @repo/etherfuse credit ledger and are NOT counted against the daily
 * spend cap. They appear as a `topUpBalance` field on the check result
 * and are included in the `remaining` calculation so users get the full
 * spending power of their onramp funds without reducing their daily limit.
 */

import { agentReputation, REPUTATION_CONFIG } from "./agent-reputation";
import { getTopUpBalance } from "@repo/etherfuse";

export interface SpendPolicy {
  walletAddress: string;
  maxPerTransaction: number;
  maxPerDay: number;
  allowedTokens: string[];
  allowedChains: number[];
  requiresApproval: boolean;
}

export interface SpendCheckResult {
  allowed: boolean;
  reason: string;
  maxAmount: number;
  usedToday: number;
  remaining: number;
  /**
   * Onramp credits (Etherfuse top-ups) available to this wallet.
   * These are positive adjustments that do NOT reduce the daily cap.
   * `remaining` already includes this amount. 0 if onramp is not
   * configured or the user has no credits.
   */
  topUpBalance: number;
}

// Track daily usage in memory
const dailyUsage = new Map<string, { date: string; amount: number }>();

function getTodayKey(): string {
  const parts = new Date().toISOString().split("T");
  return parts[0] || "";
}

function getDailyUsageKey(walletAddress: string): string {
  return `${walletAddress.toLowerCase()}:${getTodayKey()}`;
}

export async function checkSpendPolicy(
  walletAddress: string,
  amount: number,
): Promise<SpendCheckResult> {
  const limit = await agentReputation.getSpendLimit(walletAddress);

  // Get daily usage
  let used = 0;
  const usageKey = getDailyUsageKey(walletAddress);
  const usage = dailyUsage.get(usageKey);

  if (usage && usage.date === getTodayKey()) {
    used = usage.amount;
  }

  // Get onramp credit balance — these are positive adjustments, not spends.
  // They add spending power without reducing the daily cap.
  // Returns 0 if Etherfuse is not configured (no env vars set) — the
  // getTopUpBalance function itself catches errors and returns 0.
  const topUpBalance = await getTopUpBalance(walletAddress as `0x${string}`).catch(() => 0);

  // Remaining = (daily limit - spent today) + onramp credits
  const baseRemaining = limit - used;
  const remaining = baseRemaining + topUpBalance;
  const allowed = amount <= remaining;

  const reason = allowed
    ? "Approved"
    : topUpBalance > 0
      ? `Would exceed daily limit ($${limit}) even with $${topUpBalance.toFixed(2)} in onramp credits. Used today: $${used}`
      : `Would exceed daily limit ($${limit}). Used: $${used}, Remaining: $${baseRemaining}`;

  return {
    allowed,
    reason,
    maxAmount: limit,
    usedToday: used,
    remaining,
    topUpBalance,
  };
}

export async function recordSpend(
  walletAddress: string,
  amount: number,
): Promise<void> {
  const usageKey = getDailyUsageKey(walletAddress);
  const current = dailyUsage.get(usageKey);
  const today = getTodayKey();

  if (current && current.date === today) {
    current.amount += amount;
  } else {
    dailyUsage.set(usageKey, { date: today, amount });
  }

  // Also record to reputation
  await agentReputation.recordTransaction(walletAddress, amount, true);
}

export async function enforceSpendPolicy(
  walletAddress: string,
  amount: number,
): Promise<{ allowed: boolean; tx: any }> {
  const check = await checkSpendPolicy(walletAddress, amount);

  if (!check.allowed) {
    return {
      allowed: false,
      tx: { error: check.reason, code: "SPEND_LIMIT_EXCEEDED" },
    };
  }

  // Record the spend
  await recordSpend(walletAddress, amount);

  return {
    allowed: true,
    tx: {
      maxPerDay: check.maxAmount,
      usedToday: check.usedToday + amount,
      remaining: check.remaining - amount,
    },
  };
}

// Get policy for agent
export async function getAgentPolicy(
  walletAddress: string,
): Promise<SpendPolicy> {
  const tier = await agentReputation.getSpendLimit(walletAddress);
  const reputation = await agentReputation.getReputation(walletAddress);

  return {
    walletAddress: walletAddress.toLowerCase(),
    maxPerTransaction: tier,
    maxPerDay: tier,
    allowedTokens: ["USDC", "cUSD", "G$", "ETH"],
    allowedChains: [8453, 42220], // Base, Celo
    requiresApproval: tier < REPUTATION_CONFIG.establishedLimit,
  };
}
