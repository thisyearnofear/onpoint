import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rateLimit: vi.fn() }));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  getClientId: () => "1.2.3.4",
  RateLimits: { general: { maxRequests: 100, windowMs: 60000, prefix: "api" } },
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  mocks.rateLimit.mockReset().mockResolvedValue({ allowed: false });
  fetchMock.mockReset().mockImplementation(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const json = (url: string, body: unknown) =>
  new NextRequest(url, { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });

describe("public curator routes are rate limited", () => {
  it("POST /views", async () => {
    const { POST } = await import("../views/route");
    const res = await POST(json("https://onpoint.test/api/curator/views", { curatorSlug: "wanja", listingId: "l1" }));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /analytics/track", async () => {
    const { POST } = await import("../analytics/track/route");
    const res = await POST(json("https://onpoint.test/api/curator/analytics/track", { event: "page_view", curatorSlug: "wanja" }));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POST /leads", async () => {
    const { POST } = await import("../leads/route");
    const res = await POST(json("https://onpoint.test/api/curator/leads", { curatorSlug: "wanja", source: "storefront" }));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("GET /recommendations", async () => {
    const { GET } = await import("../recommendations/route");
    const res = await GET(new Request("https://onpoint.test/api/curator/recommendations?curatorSlug=wanja"));
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Redis helpers refuse unsafe curator slugs", () => {
  it.each(["wanja/0/1", "recent/../x", "A B", "a", "x".repeat(65), ""])(
    "%j never reaches Redis",
    async (slug) => {
      const { readPayments, getPaymentById, updatePaymentInRedis, readNotifications } = await import("../../../../lib/utils/notifications");
      expect(await readPayments(slug)).toEqual([]);
      expect(await getPaymentById(slug, "stk_1760000000000_abcdefg")).toBeNull();
      expect(await updatePaymentInRedis(slug, "stk_1760000000000_abcdefg", { a: 1 })).toBeNull();
      expect(await readNotifications(slug)).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("still reads for a valid slug", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ result: [JSON.stringify({ id: "p1" })] }), { status: 200 }));
    const { readPayments } = await import("../../../../lib/utils/notifications");
    expect(await readPayments("wanja")).toEqual([{ id: "p1" }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
