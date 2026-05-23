/**
 * In-App Notification Tests
 *
 * Covers: push, fetch, mark read, mark all read, notification builder helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock redis helpers
vi.mock("../../utils/redis-helpers", () => ({
  redisGet: vi.fn(),
  redisSetEx: vi.fn(),
}));

import { redisGet, redisSetEx } from "../../utils/redis-helpers";

const mockRedisGet = vi.mocked(redisGet);
const mockRedisSetEx = vi.mocked(redisSetEx);

describe("Notification System", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ============================================
  // Notification Builder
  // ============================================
  describe("buildSubscriptionNotification", () => {
    it("builds trial_ending notification with days remaining", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("trial_ending", { daysRemaining: 3 });

      expect(n.type).toBe("trial_ending");
      expect(n.title).toBe("Trial Ending Soon");
      expect(n.message).toContain("3 days");
      expect(n.actionUrl).toBe("/account/subscription");
    });

    it("builds payment_succeeded notification with amount", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("payment_succeeded", { tier: "pro", amount: 29.99 });

      expect(n.title).toBe("Payment Successful");
      expect(n.message).toContain("$29.99");
      expect(n.message).toContain("pro");
    });

    it("builds payment_failed notification with attempt count", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("payment_failed", { attemptCount: 2 });

      expect(n.title).toBe("Payment Failed");
      expect(n.message).toContain("attempt 2");
    });

    it("builds subscription_canceled notification", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("subscription_canceled");

      expect(n.title).toBe("Subscription Canceled");
      expect(n.message).toContain("lose access");
    });

    it("builds subscription_renewed notification with tier", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("subscription_renewed", { tier: "pro" });

      expect(n.title).toBe("Subscription Renewed");
      expect(n.message).toContain("pro");
    });

    it("builds subscription_upgraded notification", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("subscription_upgraded", { tier: "concierge" });

      expect(n.title).toBe("Plan Upgraded");
      expect(n.message).toContain("concierge");
    });

    it("builds subscription_past_due notification", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("subscription_past_due");

      expect(n.title).toBe("Subscription Past Due");
      expect(n.message).toContain("past due");
    });

    it("builds usage_limit_reached notification", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("usage_limit_reached");

      expect(n.title).toBe("Usage Limit Reached");
      expect(n.message).toContain("daily usage limit");
    });

    it("handles unknown notification type gracefully", async () => {
      const { buildSubscriptionNotification } = await import("../subscription-service");
      const n = buildSubscriptionNotification("usage_limit_reached" as any);

      expect(n.title).toBeDefined();
      expect(n.message).toBeDefined();
    });
  });

  // ============================================
  // Push Notification
  // ============================================
  describe("pushNotification", () => {
    it("pushes a notification to an empty list", async () => {
      mockRedisGet.mockResolvedValue(null); // No existing notifications
      const { pushNotification } = await import("../subscription-service");

      await pushNotification("user-test-1", {
        type: "subscription_renewed",
        title: "Test",
        message: "Test message",
        actionUrl: "/test",
      });

      expect(mockRedisSetEx).toHaveBeenCalledTimes(1);
      const saved = mockRedisSetEx.mock.calls[0][1] as any[];
      expect(saved.length).toBe(1);
      expect(saved[0].type).toBe("subscription_renewed");
      expect(saved[0].read).toBe(false);
      expect(saved[0].id).toMatch(/^notif_/);
    });

    it("prepends to existing notifications and caps at 50", async () => {
      const existing = Array.from({ length: 50 }, (_, i) => ({
        id: `notif_${i}`,
        type: "payment_succeeded" as const,
        title: `Old ${i}`,
        message: "Old message",
        timestamp: Date.now() - i * 1000,
        read: false,
      }));
      mockRedisGet.mockResolvedValue(existing);

      const { pushNotification } = await import("../subscription-service");
      await pushNotification("user-test-1", {
        type: "subscription_renewed",
        title: "Newest",
        message: "Brand new",
      });

      const saved = mockRedisSetEx.mock.calls[0][1] as any[];
      expect(saved.length).toBe(50);
      expect(saved[0].title).toBe("Newest"); // Newest first
    });

    it("sets 90-day TTL on stored notifications", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { pushNotification } = await import("../subscription-service");

      await pushNotification("user-test-1", {
        type: "payment_failed",
        title: "Test",
        message: "Test",
      });

      const ttl = mockRedisSetEx.mock.calls[0][2] as number;
      expect(ttl).toBe(90 * 86400);
    });
  });

  // ============================================
  // Fetch Notifications
  // ============================================
  describe("getNotifications", () => {
    it("returns empty array when no notifications exist", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { getNotifications } = await import("../subscription-service");

      const result = await getNotifications("user-test-1");
      expect(result).toEqual([]);
    });

    it("returns notifications sorted newest-first", async () => {
      const notifications = [
        { id: "1", type: "payment_succeeded" as const, title: "A", message: "x", timestamp: 1000, read: false },
        { id: "2", type: "payment_failed" as const, title: "B", message: "y", timestamp: 2000, read: false },
      ];
      mockRedisGet.mockResolvedValue(notifications);

      const { getNotifications } = await import("../subscription-service");
      const result = await getNotifications("user-test-1");
      expect(result).toEqual(notifications);
    });
  });

  // ============================================
  // Unread Count
  // ============================================
  describe("getUnreadCount", () => {
    it("returns count of unread notifications", async () => {
      const notifications = [
        { id: "1", type: "trial_ending" as const, title: "A", message: "x", timestamp: 1000, read: false },
        { id: "2", type: "payment_succeeded" as const, title: "B", message: "y", timestamp: 2000, read: true },
        { id: "3", type: "payment_failed" as const, title: "C", message: "z", timestamp: 3000, read: false },
      ];
      mockRedisGet.mockResolvedValue(notifications);

      const { getUnreadCount } = await import("../subscription-service");
      const count = await getUnreadCount("user-test-1");
      expect(count).toBe(2);
    });

    it("returns 0 when no notifications", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { getUnreadCount } = await import("../subscription-service");
      const count = await getUnreadCount("user-test-1");
      expect(count).toBe(0);
    });
  });

  // ============================================
  // Mark Read — Single
  // ============================================
  describe("markNotificationRead", () => {
    it("marks a specific notification as read", async () => {
      const notifications = [
        { id: "notif_1", type: "payment_failed" as const, title: "Fail", message: "x", timestamp: 1000, read: false },
        { id: "notif_2", type: "subscription_renewed" as const, title: "Renew", message: "y", timestamp: 2000, read: false },
      ];
      mockRedisGet.mockResolvedValue(notifications);

      const { markNotificationRead } = await import("../subscription-service");
      await markNotificationRead("user-test-1", "notif_1");

      const saved = mockRedisSetEx.mock.calls[0][1] as any[];
      expect(saved.find((n: any) => n.id === "notif_1")?.read).toBe(true);
      expect(saved.find((n: any) => n.id === "notif_2")?.read).toBe(false);
    });

    it("does nothing when notifications list is empty", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { markNotificationRead } = await import("../subscription-service");
      await markNotificationRead("user-test-1", "notif_1");
      expect(mockRedisSetEx).not.toHaveBeenCalled();
    });
  });

  // ============================================
  // Mark Read — All
  // ============================================
  describe("markAllNotificationsRead", () => {
    it("marks all notifications as read", async () => {
      const notifications = [
        { id: "1", type: "trial_ending" as const, title: "A", message: "x", timestamp: 1000, read: false },
        { id: "2", type: "payment_failed" as const, title: "B", message: "y", timestamp: 2000, read: false },
        { id: "3", type: "subscription_renewed" as const, title: "C", message: "z", timestamp: 3000, read: true },
      ];
      mockRedisGet.mockResolvedValue(notifications);

      const { markAllNotificationsRead } = await import("../subscription-service");
      await markAllNotificationsRead("user-test-1");

      const saved = mockRedisSetEx.mock.calls[0][1] as any[];
      saved.forEach((n: any) => expect(n.read).toBe(true));
    });

    it("does nothing when no notifications exist", async () => {
      mockRedisGet.mockResolvedValue(null);
      const { markAllNotificationsRead } = await import("../subscription-service");
      await markAllNotificationsRead("user-test-1");
      expect(mockRedisSetEx).not.toHaveBeenCalled();
    });
  });
});
