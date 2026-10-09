import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPaymentById: vi.fn(), rateLimit: vi.fn() }));

vi.mock("../../../../lib/utils/notifications", () => ({ getPaymentById: mocks.getPaymentById }));
vi.mock("../../../../lib/utils/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientId: () => "1.2.3.4" }));

import { DELETE, POST } from "./route";

const fetchMock = vi.fn();
const ID = "stk_1760000000000_0123456789abcdef01234567";
const sub = { endpoint: "https://push.example.test/abc", keys: { p256dh: "k", auth: "a" } };

function req(method: "POST" | "DELETE", body: unknown) {
  return new Request("https://onpoint.test/api/curator/push-subscribe", {
    method,
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true });
  mocks.getPaymentById.mockReset().mockResolvedValue({ id: ID, curatorSlug: "wanja" });
  fetchMock.mockReset().mockImplementation(async () => new Response("[]", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("DELETE /api/curator/push-subscribe", () => {
  it.each([
    "x/curator:payments:wanja", // would have become DEL curator:push:x curator:payments:wanja
    "x/curator:notifications:wanja",
    "../../etc/passwd",
    "stk_1760000000000_abc/def",
    "a b",
    "",
  ])("rejects the key-injection attempt %j without calling Redis", async (paymentId) => {
    const res = await DELETE(req("DELETE", { paymentId }));
    expect([400]).toContain(res.status);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes exactly one key, via the JSON body (never the URL path)", async () => {
    const res = await DELETE(req("DELETE", { paymentId: ID }));
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://redis.test/pipeline");
    expect(JSON.parse(init.body)).toEqual([["DEL", `curator:push-subscriptions:${ID}`]]);
  });
});

describe("POST /api/curator/push-subscribe", () => {
  it("stores a subscription for a real order, with a TTL, through the pipeline body", async () => {
    const res = await POST(req("POST", { curatorSlug: "wanja", paymentId: ID, subscription: sub }));
    expect(res.status).toBe(200);
    expect(mocks.getPaymentById).toHaveBeenCalledWith("wanja", ID);
    const [url, init] = fetchMock.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("https://redis.test/pipeline");
    const commands = JSON.parse(init.body) as string[][];
    expect(commands[0]?.slice(0, 2)).toEqual(["SET", `curator:push-subscriptions:${ID}`]);
    expect(commands[0]?.slice(3)).toEqual(["EX", String(30 * 24 * 3600)]);
    expect(commands.map((c) => c[0])).toEqual(["SET", "LPUSH", "LTRIM"]);
  });

  it("refuses a payment that does not exist (no arbitrary Redis writes)", async () => {
    mocks.getPaymentById.mockResolvedValue(null);
    expect((await POST(req("POST", { curatorSlug: "wanja", paymentId: ID, subscription: sub }))).status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects injected slugs and payment ids", async () => {
    const bad = [
      { curatorSlug: "wanja/0/1", paymentId: ID, subscription: sub },
      { curatorSlug: "A B", paymentId: ID, subscription: sub },
      { curatorSlug: "wanja", paymentId: "x/curator:payments:wanja", subscription: sub },
    ];
    for (const b of bad) {
      expect([400, 404]).toContain((await POST(req("POST", b))).status);
    }
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
  });

  it.each([
    [{ endpoint: "http://insecure.test/x" }, "non-https endpoint"],
    [{ endpoint: "https://ok.test/x", pad: "x".repeat(5000) }, "oversized payload"],
    ["a string", "non-object"],
    [[], "array"],
    [{}, "missing endpoint"],
  ])("rejects an invalid subscription: %j (%s)", async (subscription: unknown, _label: string) => {
    const res = await POST(req("POST", { curatorSlug: "wanja", paymentId: ID, subscription }));
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    expect((await POST(req("POST", { curatorSlug: "wanja", paymentId: ID, subscription: sub }))).status).toBe(429);
    expect((await DELETE(req("DELETE", { paymentId: ID }))).status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
