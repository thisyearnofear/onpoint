/**
 * Spend Policy Engine - OWS Hackathon Track 2: Spend Governance
 *
 * Enforces spending limits based on agent reputation tier.
 * Prevents runaway agents from draining wallets.
 */

import { agentReputation, REPUTATION_CONFIG } from "./agent-reputation";

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

  const remaining = limit - used;
  const allowed = amount <= remaining;

  return {
    allowed,
    reason: allowed
      ? "Approved"
      : `Would exceed daily limit ($${limit}). Used: $${used}, Remaining: $${remaining}`,
    maxAmount: limit,
    usedToday: used,
    remaining,
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
    allowedTokens: ["USDC", "cUSD", "ETH"],
    allowedChains: [8453, 42220], // Base, Celo
    requiresApproval: tier < REPUTATION_CONFIG.establishedLimit,
  };
}
