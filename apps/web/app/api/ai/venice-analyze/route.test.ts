import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000, limit: 60 })),
  getClientId: vi.fn(() => "test-client"),
  redisGet: vi.fn(async () => null),
  redisSetEx: vi.fn(async () => undefined),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimits: { veniceBurst: { maxRequests: 10, windowMs: 1000, prefix: "test" } },
  rateLimitHeaders: vi.fn(() => ({})),
  getClientId: mocks.getClientId,
}));

vi.mock("../../../../lib/utils/redis-helpers", () => ({
  redisGet: mocks.redisGet,
  redisSetEx: mocks.redisSetEx,
}));

// Mock fetch globally for Venice API calls
const originalFetch = globalThis.fetch;

describe("POST /api/ai/venice-analyze", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.stubEnv("VENICE_API_KEY", "test-key");
    mocks.redisGet.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ allowed: true, remaining: 59, resetAt: Date.now() + 60000, limit: 60 });
    globalThis.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: "Great outfit." } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as any;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("returns 400 when image or goal is missing", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/venice-analyze", {
        method: "POST",
        body: JSON.stringify({ goal: "daily" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 429 when rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5000, limit: 10 });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/venice-analyze", {
        method: "POST",
        body: JSON.stringify({ image: "base64data", goal: "daily" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 429 when frame limit exceeded", async () => {
    mocks.redisGet.mockResolvedValue(31 as any);

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/venice-analyze", {
        method: "POST",
        body: JSON.stringify({ image: "base64data", goal: "daily" }),
      }),
    );
    expect(res.status).toBe(429);
  });

  it("calls Venice API and returns analysis", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/venice-analyze", {
        method: "POST",
        body: JSON.stringify({ image: "base64data", goal: "daily" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.analysis).toBe("Great outfit.");
    expect(body.frameCount).toBe(1);
  });
});
