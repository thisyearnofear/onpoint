/**
 * Subscription Service Tests
 *
 * Covers: tier config, trial management, upgrade/cancel/reactivate,
 * usage tracking, Stripe sync, customer mapping, notifications.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock redis helpers
vi.mock("../../utils/redis-helpers", () => ({
  redisGet: vi.fn(),
  redisSetEx: vi.fn(),
  redisSet: vi.fn(),
  redisDel: vi.fn(),
}));

// Mock agent-auth setUserSubscription
vi.mock("../../../middleware/agent-auth", () => ({
  setUserSubscription: vi.fn(),
}));

import { redisGet, redisSetEx, redisSet, redisDel } from "../../utils/redis-helpers";

const mockRedisGet = vi.mocked(redisGet);
const mockRedisSetEx = vi.mocked(redisSetEx);

describe("Subscription Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Tier Configuration
  // ============================================
  describe("Tier Configuration", () => {
    it("defines 4 tiers with correct prices", async () => {
      const { SUBSCRIPTION_TIERS } = await import("../subscription-service");
      const tiers = Object.keys(SUBSCRIPTION_TIERS);
      expect(tiers).toEqual(["free", "basic", "pro", "concierge"]);
      expect(SUBSCRIPTION_TIERS.free.price).toBe(0);
      expect(SUBSCRIPTION_TIERS.basic.price).toBe(9.99);
      expect(SUBSCRIPTION_TIERS.pro.price).toBe(29.99);
      expect(SUBSCRIPTION_TIERS.concierge.price).toBe(99.99);
    });

    it("free tier has no permissions for execute_purchase", async () => {
      const { hasPermission } = await import("../subscription-service");
      expect(hasPermission("free", "execute_purchase")).toBe(false);
      expect(hasPermission("pro", "execute_purchase")).toBe(true);
    });

    it("getTierConfig returns correct config", async () => {
      const { getTierConfig } = await import("../subscription-service");
      const config = getTierConfig("pro");
      expect(config.name).toBe("Pro");
      expect(config.features.length).toBeGreaterThan(0);
    });
  });

  // ============================================
  // Trial Management
  // ============================================
  describe("Trial Management", () => {
    it("startTrial creates a pro-tier trial with correct duration", async () => {
      const { startTrial } = await import("../subscription-service");
      const subscription = await startTrial("user-test-1", 14);

      expect(subscription.userId).toBe("user-test-1");
      expect(subscription.tier).toBe("pro");
      expect(subscription.status).toBe("trialing");
      expect(subscription.cancelAtPeriodEnd).toBe(false);
      expect(mockRedisSetEx).toHaveBeenCalled();

      // Verify TTL was set for the subscription
      const setExCalls = mockRedisSetEx.mock.calls;
      expect(setExCalls.length).toBeGreaterThanOrEqual(1);
    });

    it("hasActiveTrial returns true when trial is active", async () => {
      mockRedisGet.mockResolvedValue({
        started: Date.now() - 86400000, // 1 day ago
        ends: Date.now() + 86400000 * 10, // 10 days from now
      });

      const { hasActiveTrial } = await import("../subscription-service");
      const active = await hasActiveTrial("user-test-1");
      expect(active).toBe(true);
    });

    it("hasActiveTrial returns false when trial has expired", async () => {
      mockRedisGet.mockResolvedValue({
        started: Date.now() - 86400000 * 30,
        ends: Date.now() - 86400000 * 10, // 10 days ago
      });

      const { hasActiveTrial } = await import("../subscription-service");
      const active = await hasActiveTrial("user-test-1");
      expect(active).toBe(false);
    });

    it("hasActiveTrial returns false when no trial exists", async () => {
      mockRedisGet.mockResolvedValue(null);

      const { hasActiveTrial } = await import("../subscription-service");
      const active = await hasActiveTrial("user-test-1");
      expect(active).toBe(false);
    });
  });

  // ============================================
  // Upgrade / Cancel / Reactivate
  // ============================================
  describe("Upgrade / Cancel / Reactivate", () => {
    it("upgradeSubscription changes tier and sets status to active", async () => {
      mockRedisGet.mockResolvedValue(null); // No existing subscription
      const { upgradeSubscription } = await import("../subscription-service");
      const result = await upgradeSubscription("user-test-1", "pro", "stripe");

      expect(result.tier).toBe("pro");
      expect(result.status).toBe("active");
      expect(result.paymentMethod).toBe("stripe");
      expect(mockRedisSetEx).toHaveBeenCalled();
    });

    it("cancelSubscription sets cancelAtPeriodEnd", async () => {
      mockRedisGet.mockResolvedValue({
        userId: "user-test-1",
        tier: "pro",
        status: "active",
        currentPeriodStart: Date.now() - 86400000 * 15,
        currentPeriodEnd: Date.now() + 86400000 * 15,
        cancelAtPeriodEnd: false,
        paymentMethod: "stripe",
      });

      const { cancelSubscription } = await import("../subscription-service");
      const result = await cancelSubscription("user-test-1", false);

      expect(result?.cancelAtPeriodEnd).toBe(true);
      expect(result?.status).toBe("active"); // Still active until period end
    });

    it("cancelSubscription with immediate=true sets status to canceled", async () => {
      mockRedisGet.mockResolvedValue({
        userId: "user-test-1",
        tier: "pro",
        status: "active",
        currentPeriodStart: Date.now() - 86400000 * 15,
        currentPeriodEnd: Date.now() + 86400000 * 15,
        cancelAtPeriodEnd: false,
        paymentMethod: "stripe",
      });

      const { cancelSubscription } = await import("../subscription-service");
      const result = await cancelSubscription("user-test-1", true);

      expect(result?.status).toBe("canceled");
    });

    it("cancelSubscription returns null when no subscription exists", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { cancelSubscription } = await import("../subscription-service");
      const result = await cancelSubscription("user-test-none");
      expect(result).toBeNull();
    });

    it("reactivateSubscription clears cancelAtPeriodEnd", async () => {
      mockRedisGet.mockResolvedValue({
        userId: "user-test-1",
        tier: "pro",
        status: "active",
        currentPeriodStart: Date.now() - 86400000 * 15,
        currentPeriodEnd: Date.now() + 86400000 * 15,
        cancelAtPeriodEnd: true,
        paymentMethod: "stripe",
      });

      const { reactivateSubscription } = await import("../subscription-service");
      const result = await reactivateSubscription("user-test-1");

      expect(result?.cancelAtPeriodEnd).toBe(false);
    });

    it("reactivateSubscription returns null when no subscription exists", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { reactivateSubscription } = await import("../subscription-service");
      const result = await reactivateSubscription("user-test-none");
      expect(result).toBeNull();
    });
  });

  // ============================================
  // Usage Tracking
  // ============================================
  describe("Usage Tracking", () => {
    it("trackUsage creates new usage entry on first call", async () => {
      mockRedisGet.mockResolvedValue(null); // No existing usage
      const { trackUsage } = await import("../subscription-service");
      await trackUsage("user-test-1", "critique", BigInt(1e17));

      expect(mockRedisSetEx).toHaveBeenCalled();
    });

    it("trackUsage increments existing usage", async () => {
      mockRedisGet.mockResolvedValue({
        userId: "user-test-1",
        tier: "pro",
        periodStart: Date.now(),
        periodEnd: Date.now() + 86400000 * 30,
        actionsCount: 5,
        spentAmount: "500000000000000000", // 0.5 ETH
        lastUpdated: Date.now(),
      });

      const { trackUsage } = await import("../subscription-service");
      await trackUsage("user-test-1", "purchase", BigInt(1e18));

      const saved = mockRedisSetEx.mock.calls[0][1] as any;
      expect(saved.actionsCount).toBe(6);
      expect(BigInt(saved.spentAmount)).toBe(BigInt("1500000000000000000")); // 1.5 ETH
    });
  });

  // ============================================
  // Proration Calculation
  // ============================================
  describe("Proration", () => {
    it("calculateProration returns 0 when period has ended", async () => {
      const { calculateProration } = await import("../subscription-service");
      const sub = {
        userId: "test",
        tier: "pro" as const,
        status: "active" as const,
        currentPeriodStart: Date.now() - 86400000 * 60,
        currentPeriodEnd: Date.now() - 86400000 * 30,
        cancelAtPeriodEnd: false,
        paymentMethod: "manual" as const,
      };
      const amount = calculateProration(sub, Date.now());
      expect(amount).toBe(0);
    });

    it("calculateProration returns positive amount for active period", async () => {
      const { calculateProration } = await import("../subscription-service");
      const now = Date.now();
      const sub = {
        userId: "test",
        tier: "pro" as const,
        status: "active" as const,
        currentPeriodStart: now - 86400000 * 15,
        currentPeriodEnd: now + 86400000 * 15,
        cancelAtPeriodEnd: false,
        paymentMethod: "manual" as const,
      };
      const amount = calculateProration(sub, now);
      expect(amount).toBeGreaterThan(0);
      expect(amount).toBeLessThan(29.99); // Pro price
    });
  });

  // ============================================
  // Price-to-Tier Mapping
  // ============================================
  describe("Price-to-Tier Mapping", () => {
    it("mapPriceToTier returns null for undefined/null", async () => {
      const { mapPriceToTier } = await import("../subscription-service");
      expect(mapPriceToTier(undefined)).toBeNull();
      expect(mapPriceToTier(null)).toBeNull();
    });

    it("mapPriceToTier returns null for unknown price ID", async () => {
      const { mapPriceToTier } = await import("../subscription-service");
      expect(mapPriceToTier("price_unknown")).toBeNull();
    });
  });
});
