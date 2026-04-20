import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000, limit: 60 })),
  getClientId: vi.fn(() => "test-client"),
  extractAuth: vi.fn(async () => ({ userId: "user1", tier: "free", permissions: [] })),
  verifySessionToken: vi.fn(() => null),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimits: {
    veniceFree: { maxRequests: 60, windowMs: 60000, prefix: "venice-free" },
    geminiSession: { maxRequests: 10, windowMs: 3600000, prefix: "gemini" },
  },
  rateLimitHeaders: vi.fn(() => ({})),
  getClientId: mocks.getClientId,
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  extractAuth: mocks.extractAuth,
}));

vi.mock("../../../../lib/utils/session-token", () => ({
  verifySessionToken: mocks.verifySessionToken,
}));

vi.mock("../../../../config/chains", () => ({
  AGENT_WALLET: "0xAgent",
  NFT_CONTRACTS: { celo: "0xNFT" },
}));

describe("POST /api/ai/live-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VENICE_API_KEY", "test-key");
  });

  it("provisions a Venice free session", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/live-session", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", provider: "venice" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.config.provider).toBe("venice");
    expect(body.config.maxCaptures).toBe(3);
    // API key should NOT be in the response
    expect(body.config.apiKey).toBeUndefined();
  });

  it("returns 429 when Venice rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5000, limit: 60 });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/live-session", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", provider: "venice" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 402 for Gemini without payment or BYOK", async () => {
    // Reset rate limit to allow
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 9, resetAt: Date.now() + 3600000, limit: 10 });
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("VERTEX_API_KEY", "");

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/live-session", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", provider: "gemini" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body.paymentRequired).toBe(true);
  });

  it("returns 400 for invalid provider", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/live-session", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", provider: "invalid" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
