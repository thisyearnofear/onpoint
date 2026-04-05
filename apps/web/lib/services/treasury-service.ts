/**
 * Treasury Service - Phase 6.5
 * 
 * Manages agent treasury and automated revenue distribution.
 * Integrates with 0xSplits for on-chain revenue sharing.
 */

import { parseEther, type Address } from "viem";
import { redisGet, redisSetEx, redisSet } from "../utils/redis-helpers";
import { logger } from "../utils/logger";

// ============================================
// Types
// ============================================

export interface AgentTreasury {
  agentId: string;
  balance: string; // in wei
  earned: string; // total earned
  spent: string; // total spent on compute/operations
  lastUpdated: number;
  chainId: number;
  tokenAddress: Address;
}

export interface RevenueStream {
  id: string;
  agentId: string;
  source: "tips" | "commissions" | "subscriptions" | "api_fees";
  amount: string; // in wei
  from: Address;
  txHash?: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface TreasuryExpense {
  id: string;
  agentId: string;
  type: "compute" | "api_call" | "gas" | "storage" | "other";
  amount: string; // in wei
  description: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface RevenueSplit {
  seller: { address: Address; percentage: number };
  platform: { address: Address; percentage: number };
  affiliate?: { address: Address; percentage: number };
  agent: { address: Address; percentage: number };
}

// ============================================
// Configuration
// ============================================

// Default revenue split: 85% seller, 10% platform, 3% affiliate, 2% agent
export const DEFAULT_SPLIT: RevenueSplit = {
  seller: { address: "0x0000000000000000000000000000000000000000" as Address, percentage: 85 },
  platform: { address: "0x0000000000000000000000000000000000000000" as Address, percentage: 10 },
  affiliate: { address: "0x0000000000000000000000000000000000000000" as Address, percentage: 3 },
  agent: { address: "0x0000000000000000000000000000000000000000" as Address, percentage: 2 },
};

// ============================================
// Redis Keys
// ============================================

const TREASURY_KEY = (agentId: string) => `treasury:${agentId}`;
const REVENUE_KEY = (id: string) => `revenue:${id}`;
const REVENUE_INDEX_KEY = (agentId: string) => `revenue:index:${agentId}`;
const EXPENSE_KEY = (id: string) => `expense:${id}`;
const EXPENSE_INDEX_KEY = (agentId: string) => `expense:index:${agentId}`;

// ============================================
// Treasury Management
// ============================================

/**
 * Get agent treasury
 */
export async function getAgentTreasury(
  agentId: string,
): Promise<AgentTreasury | null> {
  return redisGet<AgentTreasury>(TREASURY_KEY(agentId));
}

/**
 * Initialize agent treasury
 */
export async function initializeTreasury(
  agentId: string,
  chainId: number = 42220, // Celo mainnet
  tokenAddress: Address = "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address, // cUSD
): Promise<AgentTreasury> {
  const treasury: AgentTreasury = {
    agentId,
    balance: "0",
    earned: "0",
    spent: "0",
    lastUpdated: Date.now(),
    chainId,
    tokenAddress,
  };

  await redisSet(TREASURY_KEY(agentId), treasury);
  return treasury;
}

/**
 * Add revenue to treasury
 */
export async function addRevenue(
  agentId: string,
  source: RevenueStream["source"],
  amount: bigint,
  from: Address,
  txHash?: string,
  metadata?: Record<string, unknown>,
): Promise<{ treasury: AgentTreasury; revenue: RevenueStream }> {
  let treasury = await getAgentTreasury(agentId);

  if (!treasury) {
    treasury = await initializeTreasury(agentId);
  }

  // Update treasury
  const currentBalance = BigInt(treasury.balance);
  const currentEarned = BigInt(treasury.earned);

  treasury.balance = (currentBalance + amount).toString();
  treasury.earned = (currentEarned + amount).toString();
  treasury.lastUpdated = Date.now();

  await redisSet(TREASURY_KEY(agentId), treasury);

  // Record revenue stream
  const revenueId = `revenue_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const revenue: RevenueStream = {
    id: revenueId,
    agentId,
    source,
    amount: amount.toString(),
    from,
    txHash,
    timestamp: Date.now(),
    metadata,
  };

  await redisSetEx(REVENUE_KEY(revenueId), revenue, 86400 * 365); // 1 year retention

  logger.info("Revenue added to treasury", {
    component: "treasury",
    agentId,
    source,
    amount: amount.toString(),
  });

  return { treasury, revenue };
}

/**
 * Record expense from treasury
 */
export async function recordExpense(
  agentId: string,
  type: TreasuryExpense["type"],
  amount: bigint,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<{ treasury: AgentTreasury; expense: TreasuryExpense }> {
  let treasury = await getAgentTreasury(agentId);

  if (!treasury) {
    treasury = await initializeTreasury(agentId);
  }

  const currentBalance = BigInt(treasury.balance);
  const currentSpent = BigInt(treasury.spent);

  // Check if enough balance
  if (currentBalance < amount) {
    throw new Error(
      `Insufficient treasury balance. Have: ${currentBalance}, Need: ${amount}`,
    );
  }

  // Update treasury
  treasury.balance = (currentBalance - amount).toString();
  treasury.spent = (currentSpent + amount).toString();
  treasury.lastUpdated = Date.now();

  await redisSet(TREASURY_KEY(agentId), treasury);

  // Record expense
  const expenseId = `expense_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const expense: TreasuryExpense = {
    id: expenseId,
    agentId,
    type,
    amount: amount.toString(),
    description,
    timestamp: Date.now(),
    metadata,
  };

  await redisSetEx(EXPENSE_KEY(expenseId), expense, 86400 * 365);

  logger.info("Expense recorded", {
    component: "treasury",
    agentId,
    type,
    amount: amount.toString(),
    description,
  });

  return { treasury, expense };
}

/**
 * Check if agent can afford expense
 */
export async function canAffordExpense(
  agentId: string,
  amount: bigint,
): Promise<{ canAfford: boolean; balance: bigint; shortfall?: bigint }> {
  const treasury = await getAgentTreasury(agentId);

  if (!treasury) {
    return { canAfford: false, balance: 0n, shortfall: amount };
  }

  const balance = BigInt(treasury.balance);

  if (balance >= amount) {
    return { canAfford: true, balance };
  }

  return {
    canAfford: false,
    balance,
    shortfall: amount - balance,
  };
}

// ============================================
// Revenue Splitting (0xSplits Integration)
// ============================================

/**
 * Calculate revenue split amounts
 */
export function calculateRevenueSplit(
  totalAmount: bigint,
  split: RevenueSplit,
): {
  seller: bigint;
  platform: bigint;
  affiliate: bigint;
  agent: bigint;
} {
  const seller = (totalAmount * BigInt(split.seller.percentage)) / 100n;
  const platform = (totalAmount * BigInt(split.platform.percentage)) / 100n;
  const affiliate = split.affiliate
    ? (totalAmount * BigInt(split.affiliate.percentage)) / 100n
    : 0n;
  const agent = (totalAmount * BigInt(split.agent.percentage)) / 100n;

  return { seller, platform, affiliate, agent };
}

/**
 * Process revenue split and update treasuries
 */
export async function processRevenueSplit(
  agentId: string,
  totalAmount: bigint,
  split: RevenueSplit,
  txHash: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const amounts = calculateRevenueSplit(totalAmount, split);

  // Add agent's share to treasury
  await addRevenue(
    agentId,
    "commissions",
    amounts.agent,
    split.seller.address,
    txHash,
    {
      ...metadata,
      splitType: "commission",
      totalAmount: totalAmount.toString(),
    },
  );

  logger.info("Revenue split processed", {
    component: "treasury",
    agentId,
    totalAmount: totalAmount.toString(),
    agentShare: amounts.agent.toString(),
  });
}

// ============================================
// Compute Cost Management
// ============================================

const COMPUTE_COSTS = {
  gemini_live: parseEther("0.5"), // 0.5 cUSD per session
  venice_vision: parseEther("0.1"), // 0.1 cUSD per image
  openai_gpt4: parseEther("0.05"), // 0.05 cUSD per request
  ipfs_pin: parseEther("0.01"), // 0.01 cUSD per pin
  external_search: parseEther("0.1"), // 0.1 cUSD per search
};

/**
 * Pay for compute from treasury
 */
export async function payForCompute(
  agentId: string,
  computeType: keyof typeof COMPUTE_COSTS,
  description: string,
): Promise<{ success: boolean; treasury?: AgentTreasury; error?: string }> {
  const cost = COMPUTE_COSTS[computeType];

  const affordCheck = await canAffordExpense(agentId, cost);

  if (!affordCheck.canAfford) {
    return {
      success: false,
      error: `Insufficient treasury balance. Need ${cost.toString()}, have ${affordCheck.balance.toString()}`,
    };
  }

  try {
    const { treasury } = await recordExpense(agentId, "compute", cost, description, {
      computeType,
    });

    return { success: true, treasury };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Payment failed",
    };
  }
}

/**
 * Get treasury statistics
 */
export async function getTreasuryStats(agentId: string): Promise<{
  treasury: AgentTreasury | null;
  profitMargin: number; // percentage
  burnRate: number; // spending per day
  runway: number; // days until balance depleted
}> {
  const treasury = await getAgentTreasury(agentId);

  if (!treasury) {
    return {
      treasury: null,
      profitMargin: 0,
      burnRate: 0,
      runway: 0,
    };
  }

  const earned = BigInt(treasury.earned);
  const spent = BigInt(treasury.spent);
  const balance = BigInt(treasury.balance);

  // Calculate profit margin
  const profitMargin = earned > 0n ? Number((earned - spent) * 100n / earned) : 0;

  // Estimate burn rate (simplified - would need time-series data for accuracy)
  const burnRate = Number(spent) / 1e18; // Convert to cUSD

  // Calculate runway
  const runway = burnRate > 0 ? Number(balance) / 1e18 / burnRate : Infinity;

  return {
    treasury,
    profitMargin,
    burnRate,
    runway,
  };
}

/**
 * Auto-fund treasury from platform if balance low
 */
export async function autoFundTreasury(
  agentId: string,
  minimumBalance: bigint = parseEther("10"), // $10 minimum
  fundAmount: bigint = parseEther("50"), // Fund $50 when low
): Promise<{ funded: boolean; treasury?: AgentTreasury }> {
  const treasury = await getAgentTreasury(agentId);

  if (!treasury) {
    return { funded: false };
  }

  const balance = BigInt(treasury.balance);

  if (balance < minimumBalance) {
    // In production, execute actual transfer from platform treasury
    // For now, just update the balance
    await addRevenue(
      agentId,
      "subscriptions",
      fundAmount,
      "0x0000000000000000000000000000000000000000" as Address, // Platform
      undefined,
      { autoFunded: true, reason: "Low balance" },
    );

    const updatedTreasury = await getAgentTreasury(agentId);

    logger.info("Treasury auto-funded", {
      component: "treasury",
      agentId,
      amount: fundAmount.toString(),
    });

    return { funded: true, treasury: updatedTreasury || undefined };
  }

  return { funded: false, treasury };
}
