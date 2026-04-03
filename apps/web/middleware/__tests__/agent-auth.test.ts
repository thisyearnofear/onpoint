/**
 * Agent Authentication Middleware Tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  requireAgentAuth,
  requirePermission,
  requireAuthWithRateLimit,
  extractAuth,
  isPremiumUser,
  generateApiKey,
  type AgentAuthContext,
} from "../agent-auth";

// Mock rate limiting
vi.mock("../../lib/utils/rate-limit", () => ({
  rateLimit: vi.fn(() =>
    Promise.resolve({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60000,
      limit: 60,
    }),
  ),
  RateLimits: {
    general: {
      maxRequests: 100,
      windowMs: 60000,
      prefix: "api",
    },
  },
  getClientId: vi.fn(() => "test-client-id"),
}));

describe("Authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("extractAuth", () => {
    it("extracts userId from Bearer token", async () => {
      const request = new NextRequest("http://localhost/api/test", {
        headers: {
          Authorization: "Bearer test-user-123",
        },
      });

      const auth = await extractAuth(request);

      expect(auth).toBeDefined();
      expect(auth?.userId).toBe("test-user-123");
    });

    it("extracts userId from query param", async () => {
      const request = new NextRequest(
        "http://localhost/api/test?userId=query-user",
      );

      const auth = await extractAuth(request);

      expect(auth).toBeDefined();
      expect(auth?.userId).toBe("query-user");
    });

    it("returns null when no auth provided", async () => {
      const request = new NextRequest("http://localhost/api/test");

      const auth = await extractAuth(request);

      expect(auth).toBeNull();
    });

    it("sets default agentId", async () => {
      const request = new NextRequest("http://localhost/api/test?userId=user1");

      const auth = await extractAuth(request);

      expect(auth?.agentId).toBe("onpoint-stylist");
    });

    it("uses custom agentId from query", async () => {
      const request = new NextRequest(
        "http://localhost/api/test?userId=user1&agentId=custom-agent",
      );

      const auth = await extractAuth(request);

      expect(auth?.agentId).toBe("custom-agent");
    });

    it("assigns free tier by default", async () => {
      const request = new NextRequest("http://localhost/api/test?userId=user1");

      const auth = await extractAuth(request);

      expect(auth?.tier).toBe("free");
    });

    it("assigns premium tier for premium users", async () => {
      vi.stubEnv("PREMIUM_USERS", "user1,user2");

      const request = new NextRequest("http://localhost/api/test?userId=user1");

      const auth = await extractAuth(request);

      expect(auth?.tier).toBe("premium");
      expect(auth?.permissions).toContain("execute_purchase");

      vi.unstubAllEnvs();
    });
  });

  describe("requireAgentAuth", () => {
    it("passes auth context to handler", async () => {
      const handler = vi.fn(
        async (_req: NextRequest, ctx: AgentAuthContext) => {
          return new Response(JSON.stringify({ userId: ctx.userId }));
        },
      );

      const wrappedHandler = requireAgentAuth(handler);
      const request = new NextRequest(
        "http://localhost/api/test?userId=test123",
      );

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][1].userId).toBe("test123");
    });

    it("returns 401 when not authenticated", async () => {
      const handler = vi.fn(async () => {
        return new Response("Should not reach here");
      });

      const wrappedHandler = requireAgentAuth(handler);
      const request = new NextRequest("http://localhost/api/test");

      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(401);
    });
  });

  describe("requirePermission", () => {
    it("allows access with correct permission", async () => {
      const handler = vi.fn(async () => {
        return new Response("Success");
      });

      const wrappedHandler = requirePermission("create_suggestion")(handler);
      const request = new NextRequest("http://localhost/api/test?userId=user1");

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
    });

    it("denies access without permission", async () => {
      const handler = vi.fn(async () => {
        return new Response("Should not reach here");
      });

      const wrappedHandler = requirePermission("execute_purchase")(handler);

      // Free tier user doesn't have execute_purchase
      const request = new NextRequest(
        "http://localhost/api/test?userId=freeuser",
      );

      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(403);
    });
  });

  describe("requireAuthWithRateLimit", () => {
    it("applies rate limiting", async () => {
      const handler = vi.fn(async () => {
        return new Response("Success");
      });

      const wrappedHandler = requireAuthWithRateLimit(handler);
      const request = new NextRequest("http://localhost/api/test?userId=user1");

      await wrappedHandler(request);

      expect(handler).toHaveBeenCalled();
    });

    it("returns 429 when rate limited", async () => {
      // Mock rate limit exceeded
      vi.mocked(
        await import("../../lib/utils/rate-limit"),
      ).rateLimit.mockResolvedValueOnce({
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        limit: 60,
      });

      const handler = vi.fn(async () => {
        return new Response("Should not reach here");
      });

      const wrappedHandler = requireAuthWithRateLimit(handler);
      const request = new NextRequest("http://localhost/api/test?userId=user1");

      const response = await wrappedHandler(request);

      expect(handler).not.toHaveBeenCalled();
      expect(response.status).toBe(429);
    });
  });
});

describe("Utility Functions", () => {
  describe("isPremiumUser", () => {
    it("returns false when PREMIUM_USERS not set", () => {
      expect(isPremiumUser("user1")).toBe(false);
    });

    it("returns true for premium user", () => {
      vi.stubEnv("PREMIUM_USERS", "user1,user2,premium-user");

      expect(isPremiumUser("user1")).toBe(true);
      expect(isPremiumUser("premium-user")).toBe(true);

      vi.unstubAllEnvs();
    });

    it("returns false for non-premium user", () => {
      vi.stubEnv("PREMIUM_USERS", "user1,user2");

      expect(isPremiumUser("regular-user")).toBe(false);

      vi.unstubAllEnvs();
    });
  });

  describe("generateApiKey", () => {
    it("generates API key with user prefix", () => {
      const apiKey = generateApiKey("testuser");

      expect(apiKey).toMatch(/^sk_testuser_/);
    });

    it("generates unique keys", () => {
      const key1 = generateApiKey("user1");
      const key2 = generateApiKey("user1");

      expect(key1).not.toBe(key2);
    });

    it("includes timestamp in key", () => {
      const before = Date.now();
      const apiKey = generateApiKey("user1");
      const after = Date.now();

      // Key should contain timestamp (in base36)
      const timestamp = parseInt(apiKey.split("_").pop()!, 36);
      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after + 1000); // Allow some margin
    });
  });
});

describe("Permission Tiers", () => {
  it("free tier has basic permissions", async () => {
    const request = new NextRequest(
      "http://localhost/api/test?userId=freetier",
    );
    const { extractAuth } = await import("../agent-auth");
    const auth = await extractAuth(request);

    expect(auth?.permissions).toContain("create_suggestion");
    expect(auth?.permissions).toContain("search_catalog");
    expect(auth?.permissions).not.toContain("execute_purchase");
  });

  it("premium tier has all permissions", async () => {
    vi.stubEnv("PREMIUM_USERS", "premiumuser");

    const request = new NextRequest(
      "http://localhost/api/test?userId=premiumuser",
    );
    const { extractAuth } = await import("../agent-auth");
    const auth = await extractAuth(request);

    expect(auth?.permissions).toContain("create_suggestion");
    expect(auth?.permissions).toContain("execute_purchase");
    expect(auth?.permissions).toContain("external_search");
    expect(auth?.permissions).toContain("view_receipts");

    vi.unstubAllEnvs();
  });
});
