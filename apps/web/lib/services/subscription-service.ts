/**
 * Subscription Service - Phase 6.3
 * 
 * Advanced subscription management with tiered permissions and billing.
 * Supports both fiat (Stripe) and on-chain (Superfluid) payment methods.
 */

import { parseEther } from "viem";
import { redisGet, redisSetEx, redisSet, redisDel } from "../utils/redis-helpers";
import type { AgentPermission } from "../../middleware/agent-auth";

// ============================================
// Types
// ============================================

export type SubscriptionTier = "free" | "basic" | "pro" | "concierge";

export interface SubscriptionConfig {
  tier: SubscriptionTier;
  name: string;
  price: number; // USD per month
  dailyLimit: bigint;
  perActionLimit: bigint;
  autonomyThreshold: bigint;
  permissions: AgentPermission[];
  features: string[];
}

export interface UserSubscription {
  userId: string;
  tier: SubscriptionTier;
  status: "active" | "past_due" | "canceled" | "trialing";
  currentPeriodStart: number;
  currentPeriodEnd: number;
  cancelAtPeriodEnd: boolean;
  paymentMethod: "stripe" | "superfluid" | "manual";
  stripeSubscriptionId?: string;
  superfluidFlowRate?: string;
  metadata?: Record<string, unknown>;
}

export interface SubscriptionUsage {
  userId: string;
  tier: SubscriptionTier;
  periodStart: number;
  periodEnd: number;
  actionsCount: number;
  spentAmount: string; // in wei
  lastUpdated: number;
}

// ============================================
// Subscription Tiers Configuration
// ============================================

export const SUBSCRIPTION_TIERS: Record<SubscriptionTier, SubscriptionConfig> = {
  free: {
    tier: "free",
    name: "Free",
    price: 0,
    dailyLimit: parseEther("10"), // $10/day
    perActionLimit: parseEther("5"), // $5 per action
    autonomyThreshold: parseEther("1"), // $1 auto-approve
    permissions: [
      "create_suggestion",
      "accept_suggestion",
      "reject_suggestion",
      "search_catalog",
    ],
    features: [
      "Basic style analysis",
      "Product catalog search",
      "Manual approval for purchases",
      "10 actions per day",
    ],
  },
  basic: {
    tier: "basic",
    name: "Basic",
    price: 9.99,
    dailyLimit: parseEther("50"), // $50/day
    perActionLimit: parseEther("25"), // $25 per action
    autonomyThreshold: parseEther("5"), // $5 auto-approve
    permissions: [
      "create_suggestion",
      "accept_suggestion",
      "reject_suggestion",
      "search_catalog",
      "execute_purchase",
      "view_receipts",
    ],
    features: [
      "Advanced style analysis",
      "Autonomous purchases up to $5",
      "Product recommendations",
      "Purchase history",
      "50 actions per day",
    ],
  },
  pro: {
    tier: "pro",
    name: "Pro",
    price: 29.99,
    dailyLimit: parseEther("500"), // $500/day
    perActionLimit: parseEther("100"), // $100 per action
    autonomyThreshold: parseEther("25"), // $25 auto-approve
    permissions: [
      "create_suggestion",
      "accept_suggestion",
      "reject_suggestion",
      "search_catalog",
      "execute_purchase",
      "view_receipts",
      "external_search",
    ],
    features: [
      "Premium style analysis with AI",
      "Autonomous purchases up to $25",
      "External marketplace search",
      "Priority support",
      "NFT minting",
      "500 actions per day",
    ],
  },
  concierge: {
    tier: "concierge",
    name: "Concierge",
    price: 99.99,
    dailyLimit: parseEther("5000"), // $5000/day
    perActionLimit: parseEther("1000"), // $1000 per action
    autonomyThreshold: parseEther("100"), // $100 auto-approve
    permissions: [
      "create_suggestion",
      "accept_suggestion",
      "reject_suggestion",
      "search_catalog",
      "execute_purchase",
      "view_receipts",
      "external_search",
    ],
    features: [
      "White-glove AI styling service",
      "Autonomous purchases up to $100",
      "Unlimited external search",
      "Personal stylist consultation",
      "Exclusive brand access",
      "Custom NFT collections",
      "Unlimited actions",
    ],
  },
};

// ============================================
// Redis Keys
// ============================================

const SUBSCRIPTION_KEY = (userId: string) => `subscription:${userId}`;
const USAGE_KEY = (userId: string, period: string) => `usage:${userId}:${period}`;
const TRIAL_KEY = (userId: string) => `trial:${userId}`;

// ============================================
// Subscription Management
// ============================================

/**
 * Get user's current subscription
 */
export async function getUserSubscription(
  userId: string,
): Promise<UserSubscription | null> {
  return redisGet<UserSubscription>(SUBSCRIPTION_KEY(userId));
}

/**
 * Create or update subscription
 */
export async function setSubscription(
  subscription: UserSubscription,
): Promise<void> {
  const ttl = Math.ceil((subscription.currentPeriodEnd - Date.now()) / 1000);
  await redisSetEx(SUBSCRIPTION_KEY(subscription.userId), subscription, ttl);
}

/**
 * Start a free trial
 */
export async function startTrial(
  userId: string,
  durationDays: number = 14,
): Promise<UserSubscription> {
  const now = Date.now();
  const trialEnd = now + durationDays * 24 * 60 * 60 * 1000;

  const subscription: UserSubscription = {
    userId,
    tier: "pro", // Trial gets Pro features
    status: "trialing",
    currentPeriodStart: now,
    currentPeriodEnd: trialEnd,
    cancelAtPeriodEnd: false,
    paymentMethod: "manual",
  };

  await setSubscription(subscription);
  await redisSetEx(TRIAL_KEY(userId), { started: now, ends: trialEnd }, durationDays * 86400);

  return subscription;
}

/**
 * Check if user has active trial
 */
export async function hasActiveTrial(userId: string): Promise<boolean> {
  const trial = await redisGet<{ started: number; ends: number }>(TRIAL_KEY(userId));
  if (!trial) return false;
  return Date.now() < trial.ends;
}

/**
 * Upgrade subscription tier
 */
export async function upgradeSubscription(
  userId: string,
  newTier: SubscriptionTier,
  paymentMethod: "stripe" | "superfluid" | "manual",
  paymentId?: string,
): Promise<UserSubscription> {
  const existing = await getUserSubscription(userId);
  const now = Date.now();
  const periodEnd = now + 30 * 24 * 60 * 60 * 1000; // 30 days

  const subscription: UserSubscription = {
    userId,
    tier: newTier,
    status: "active",
    currentPeriodStart: existing?.currentPeriodStart || now,
    currentPeriodEnd: periodEnd,
    cancelAtPeriodEnd: false,
    paymentMethod,
    stripeSubscriptionId: paymentMethod === "stripe" ? paymentId : undefined,
    superfluidFlowRate: paymentMethod === "superfluid" ? paymentId : undefined,
    metadata: existing?.metadata,
  };

  await setSubscription(subscription);
  return subscription;
}

/**
 * Cancel subscription (at period end)
 */
export async function cancelSubscription(
  userId: string,
  immediate: boolean = false,
): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return null;

  if (immediate) {
    subscription.status = "canceled";
    subscription.currentPeriodEnd = Date.now();
  } else {
    subscription.cancelAtPeriodEnd = true;
  }

  await setSubscription(subscription);
  return subscription;
}

/**
 * Reactivate canceled subscription
 */
export async function reactivateSubscription(
  userId: string,
): Promise<UserSubscription | null> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return null;

  subscription.cancelAtPeriodEnd = false;
  if (subscription.status === "canceled") {
    subscription.status = "active";
    subscription.currentPeriodEnd = Date.now() + 30 * 24 * 60 * 60 * 1000;
  }

  await setSubscription(subscription);
  return subscription;
}

// ============================================
// Usage Tracking
// ============================================

/**
 * Get current billing period key
 */
function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Track action usage
 */
export async function trackUsage(
  userId: string,
  actionType: string,
  amount: bigint,
): Promise<void> {
  const period = getCurrentPeriod();
  const key = USAGE_KEY(userId, period);

  let usage = await redisGet<SubscriptionUsage>(key);

  if (!usage) {
    const subscription = await getUserSubscription(userId);
    usage = {
      userId,
      tier: subscription?.tier || "free",
      periodStart: Date.now(),
      periodEnd: Date.now() + 30 * 24 * 60 * 60 * 1000,
      actionsCount: 0,
      spentAmount: "0",
      lastUpdated: Date.now(),
    };
  }

  usage.actionsCount += 1;
  usage.spentAmount = (BigInt(usage.spentAmount) + amount).toString();
  usage.lastUpdated = Date.now();

  await redisSetEx(key, usage, 90 * 86400); // 90 day retention
}

/**
 * Get usage for current period
 */
export async function getUsage(userId: string): Promise<SubscriptionUsage | null> {
  const period = getCurrentPeriod();
  return redisGet<SubscriptionUsage>(USAGE_KEY(userId, period));
}

/**
 * Check if user has exceeded usage limits
 */
export async function checkUsageLimits(
  userId: string,
): Promise<{ exceeded: boolean; reason?: string }> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) {
    return { exceeded: false }; // Free tier has no hard limits
  }

  const config = SUBSCRIPTION_TIERS[subscription.tier];
  const usage = await getUsage(userId);

  if (!usage) {
    return { exceeded: false };
  }

  // Check if spent amount exceeds daily limit
  const spent = BigInt(usage.spentAmount);
  if (spent >= config.dailyLimit) {
    return {
      exceeded: true,
      reason: `Daily spending limit of ${config.dailyLimit.toString()} reached`,
    };
  }

  return { exceeded: false };
}

// ============================================
// Subscription Helpers
// ============================================

/**
 * Get tier configuration
 */
export function getTierConfig(tier: SubscriptionTier): SubscriptionConfig {
  return SUBSCRIPTION_TIERS[tier];
}

/**
 * Check if tier has permission
 */
export function hasPermission(
  tier: SubscriptionTier,
  permission: AgentPermission,
): boolean {
  return SUBSCRIPTION_TIERS[tier].permissions.includes(permission);
}

/**
 * Get all available tiers
 */
export function getAllTiers(): SubscriptionConfig[] {
  return Object.values(SUBSCRIPTION_TIERS);
}

/**
 * Calculate prorated refund amount
 */
export function calculateProration(
  subscription: UserSubscription,
  cancelDate: number = Date.now(),
): number {
  const totalPeriod = subscription.currentPeriodEnd - subscription.currentPeriodStart;
  const remainingPeriod = subscription.currentPeriodEnd - cancelDate;
  const config = SUBSCRIPTION_TIERS[subscription.tier];

  if (remainingPeriod <= 0) return 0;

  const proratedAmount = (config.price * remainingPeriod) / totalPeriod;
  return Math.max(0, proratedAmount);
}

/**
 * Check if subscription needs renewal
 */
export async function checkRenewal(userId: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  if (!subscription) return false;

  const now = Date.now();
  const gracePeriod = 3 * 24 * 60 * 60 * 1000; // 3 days

  // Check if subscription expired
  if (now > subscription.currentPeriodEnd + gracePeriod) {
    subscription.status = "past_due";
    await setSubscription(subscription);
    return true;
  }

  return false;
}
