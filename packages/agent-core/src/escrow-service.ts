/**
 * Escrow Service
 *
 * Manages user-funded escrow accounts for agent spending.
 * Prevents platform wallet depletion by requiring users to pre-fund their agent allowances.
 */

import { parseEther, formatEther, type Address } from "viem";
import { redisGet, redisSetEx, redisSet } from "./redis-helpers";
import { Metrics } from "./metrics";

// ============================================
// Types
// ============================================

export interface EscrowBalance {
  userId: string;
  agentId: string;
  balance: string; // in wei (string for BigInt serialization)
  allowance: string;
  spent: string;
  lastUpdated: number;
  chainId: number;
  tokenAddress: Address;
}

export interface EscrowDeposit {
  userId: string;
  agentId: string;
  amount: bigint;
  txHash: string;
  chainId: number;
  timestamp: number;
}

export interface EscrowWithdrawal {
  userId: string;
  agentId: string;
  amount: bigint;
  recipient: Address;
  txHash?: string;
  status: "pending" | "completed" | "failed";
  timestamp: number;
}

// ============================================
// Redis Keys
// ============================================

const ESCROW_BALANCE_KEY = (userId: string, agentId: string) =>
  `escrow:balance:${userId}:${agentId}`;
const ESCROW_DEPOSIT_KEY = (txHash: string) => `escrow:deposit:${txHash}`;
const ESCROW_WITHDRAWAL_KEY = (id: string) => `escrow:withdrawal:${id}`;

// ============================================
// Balance Management
// ============================================

export async function getEscrowBalance(
  userId: string,
  agentId: string,
): Promise<EscrowBalance | null> {
  return redisGet<EscrowBalance>(ESCROW_BALANCE_KEY(userId, agentId));
}

export async function initializeEscrow(
  userId: string,
  agentId: string,
  chainId: number,
  tokenAddress: Address,
  initialAllowance: bigint = parseEther("100"),
): Promise<EscrowBalance> {
  const balance: EscrowBalance = {
    userId,
    agentId,
    balance: "0",
    allowance: initialAllowance.toString(),
    spent: "0",
    lastUpdated: Date.now(),
    chainId,
    tokenAddress,
  };

  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);
  Metrics.setEscrowBalance(userId, balance.balance);
  return balance;
}

export async function depositToEscrow(
  userId: string,
  agentId: string,
  amount: bigint,
  txHash: string,
  chainId: number,
): Promise<EscrowBalance> {
  let balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    balance = await initializeEscrow(
      userId,
      agentId,
      chainId,
      "0x765DE816845861e75A25fCA122bb6898B8B1282a" as Address,
    );
  }

  const currentBalance = BigInt(balance.balance);
  balance.balance = (currentBalance + amount).toString();
  balance.lastUpdated = Date.now();

  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);
  Metrics.setEscrowBalance(userId, balance.balance);

  const deposit: EscrowDeposit = {
    userId,
    agentId,
    amount,
    txHash,
    chainId,
    timestamp: Date.now(),
  };
  await redisSetEx(ESCROW_DEPOSIT_KEY(txHash), deposit, 86400 * 90);

  return balance;
}

export async function canSpendFromEscrow(
  userId: string,
  agentId: string,
  amount: bigint,
): Promise<{ allowed: boolean; reason?: string; balance?: EscrowBalance }> {
  const balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    return {
      allowed: false,
      reason: "No escrow account found. Please deposit funds first.",
    };
  }

  const currentBalance = BigInt(balance.balance);
  const currentSpent = BigInt(balance.spent);
  const allowance = BigInt(balance.allowance);

  if (currentBalance < amount) {
    return {
      allowed: false,
      reason: `Insufficient escrow balance. Have: ${formatEther(currentBalance)} cUSD, Need: ${formatEther(amount)} cUSD`,
      balance,
    };
  }

  if (currentSpent + amount > allowance) {
    return {
      allowed: false,
      reason: `Spending would exceed allowance. Allowance: ${formatEther(allowance)} cUSD, Already spent: ${formatEther(currentSpent)} cUSD`,
      balance,
    };
  }

  return { allowed: true, balance };
}

export async function deductFromEscrow(
  userId: string,
  agentId: string,
  amount: bigint,
): Promise<EscrowBalance> {
  const balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    throw new Error("No escrow account found");
  }

  const currentBalance = BigInt(balance.balance);
  const currentSpent = BigInt(balance.spent);

  if (currentBalance < amount) {
    throw new Error("Insufficient escrow balance");
  }

  balance.balance = (currentBalance - amount).toString();
  balance.spent = (currentSpent + amount).toString();
  balance.lastUpdated = Date.now();

  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);

  // Track escrow balance for metrics
  Metrics.setEscrowBalance(userId, balance.balance);

  return balance;
}

export async function updateAllowance(
  userId: string,
  agentId: string,
  newAllowance: bigint,
): Promise<EscrowBalance> {
  const balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    throw new Error("No escrow account found");
  }

  balance.allowance = newAllowance.toString();
  balance.lastUpdated = Date.now();

  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);
  return balance;
}

export async function withdrawFromEscrow(
  userId: string,
  agentId: string,
  amount: bigint,
  recipient: Address,
): Promise<{ withdrawal: EscrowWithdrawal; balance: EscrowBalance }> {
  const balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    throw new Error("No escrow account found");
  }

  const currentBalance = BigInt(balance.balance);

  if (currentBalance < amount) {
    throw new Error("Insufficient balance for withdrawal");
  }

  balance.balance = (currentBalance - amount).toString();
  balance.lastUpdated = Date.now();
  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);
  Metrics.setEscrowBalance(userId, balance.balance);

  const withdrawalId = `withdrawal_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const withdrawal: EscrowWithdrawal = {
    userId,
    agentId,
    amount,
    recipient,
    status: "pending",
    timestamp: Date.now(),
  };

  await redisSetEx(ESCROW_WITHDRAWAL_KEY(withdrawalId), withdrawal, 86400 * 90);

  return { withdrawal, balance };
}

export async function resetDailySpending(
  userId: string,
  agentId: string,
): Promise<EscrowBalance> {
  const balance = await getEscrowBalance(userId, agentId);

  if (!balance) {
    throw new Error("No escrow account found");
  }

  balance.spent = "0";
  balance.lastUpdated = Date.now();

  await redisSet(ESCROW_BALANCE_KEY(userId, agentId), balance);
  return balance;
}
