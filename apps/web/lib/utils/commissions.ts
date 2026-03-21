/**
 * Commission Split Utilities
 *
 * Calculates revenue splits for checkout transactions.
 * Supports seller, platform, affiliate, and agent commission tiers.
 *
 * Architecture: API-layer splits (off-chain). On-chain 0xSplits
 * integration pending for trustless settlement.
 *
 * Commission tiers:
 *   Seller:    85%  (product creator/brand)
 *   Platform:  10%  (OnPoint platform)
 *   Affiliate:  3%  (if referred by affiliate)
 *   Agent:      2%  (if recommended by AI agent)
 *
 * Without affiliate/agent, their share goes to platform.
 */

import { type Address } from "viem";
import { PLATFORM_WALLET } from "../../config/chains";

// ============================================
// Types
// ============================================

export interface CommissionRecipient {
  address: Address;
  label: string;
  percentBps: number; // basis points (100 = 1%)
  amount: bigint;
}

export interface CommissionSplit {
  total: bigint;
  recipients: CommissionRecipient[];
}

export interface CommissionRecord {
  id: string;
  orderId: string;
  total: string; // wei string
  recipients: Array<{
    address: string;
    label: string;
    percentBps: number;
    amount: string; // wei string
  }>;
  affiliateId?: string;
  agentId?: string;
  timestamp: number;
}

// ============================================
// Commission Tiers (in basis points, 10000 = 100%)
// ============================================

const BPS = {
  seller: 8500, // 85%
  platform: 1000, // 10%
  affiliate: 300, // 3%
  agent: 200, // 2%
} as const;

// ============================================
// Split Calculator
// ============================================

/**
 * Calculate commission split for a transaction.
 *
 * @param totalWei - Total transaction amount in wei
 * @param sellerAddress - Product seller/brand wallet
 * @param opts - Optional affiliate/agent refs
 * @returns CommissionSplit with all recipients and amounts
 */
export function calculateSplit(
  totalWei: bigint,
  sellerAddress: Address,
  opts?: {
    affiliateAddress?: Address;
    agentAddress?: Address;
  },
): CommissionSplit {
  const recipients: CommissionRecipient[] = [];

  // Seller always gets 85%
  const sellerAmount = (totalWei * BigInt(BPS.seller)) / 10000n;
  recipients.push({
    address: sellerAddress,
    label: "seller",
    percentBps: BPS.seller,
    amount: sellerAmount,
  });

  // Platform gets base 10% + any unallocated affiliate/agent share
  let platformBps = BPS.platform;
  let affiliateAmount = 0n;
  let agentAmount = 0n;

  if (opts?.affiliateAddress) {
    affiliateAmount = (totalWei * BigInt(BPS.affiliate)) / 10000n;
    recipients.push({
      address: opts.affiliateAddress,
      label: "affiliate",
      percentBps: BPS.affiliate,
      amount: affiliateAmount,
    });
  } else {
    // No affiliate — their share goes to platform
    platformBps += BPS.affiliate;
  }

  if (opts?.agentAddress) {
    agentAmount = (totalWei * BigInt(BPS.agent)) / 10000n;
    recipients.push({
      address: opts.agentAddress,
      label: "agent",
      percentBps: BPS.agent,
      amount: agentAmount,
    });
  } else {
    // No agent — their share goes to platform
    platformBps += BPS.agent;
  }

  // Platform gets remainder
  const platformAmount =
    totalWei - sellerAmount - affiliateAmount - agentAmount;
  recipients.push({
    address: PLATFORM_WALLET,
    label: "platform",
    percentBps: platformBps,
    amount: platformAmount,
  });

  return { total: totalWei, recipients };
}

// ============================================
// Commission Record Builder
// ============================================

/**
 * Create a commission record for audit trail.
 */
export function createCommissionRecord(
  orderId: string,
  split: CommissionSplit,
  opts?: {
    affiliateId?: string;
    agentId?: string;
  },
): CommissionRecord {
  return {
    id: `comm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    orderId,
    total: split.total.toString(),
    recipients: split.recipients.map((r) => ({
      address: r.address,
      label: r.label,
      percentBps: r.percentBps,
      amount: r.amount.toString(),
    })),
    affiliateId: opts?.affiliateId,
    agentId: opts?.agentId,
    timestamp: Date.now(),
  };
}
