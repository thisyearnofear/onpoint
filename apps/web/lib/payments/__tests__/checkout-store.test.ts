import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPaymentByCheckoutRequestId,
  isValidCheckoutRequestId,
  saveCheckoutIndex,
  updateCheckoutIndex,
} from "../checkout-store";

const fetchMock = vi.fn();
const ID = "ws_CO_123456789";
const payment = { id: "stk_1", curatorSlug: "wanja", checkoutRequestId: ID, status: "pending_verification" };

beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("isValidCheckoutRequestId", () => {
  it("accepts Daraja-shaped ids and rejects anything that could shape a key or path", () => {
    expect(isValidCheckoutRequestId(ID)).toBe(true);
    for (const bad of ["", "short", "a/b/c/d/e/f", "ws CO 1234", "x".repeat(200), 42, null]) {
      expect(isValidCheckoutRequestId(bad)).toBe(false);
    }
  });
});

describe("saveCheckoutIndex", () => {
  it("SETs the payment under the checkout id with a 7-day TTL", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    expect(await saveCheckoutIndex(payment)).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://redis.test/pipeline");
    const [[cmd, key, value, ex, ttl]] = JSON.parse(init.body);
    expect([cmd, key, ex, ttl]).toEqual(["SET", `curator:payments:checkout:${ID}`, "EX", String(7 * 24 * 3600)]);
    expect(JSON.parse(value)).toMatchObject({ id: "stk_1" });
  });

  it("does nothing without Redis or with an invalid id", async () => {
    expect(await saveCheckoutIndex({ ...payment, checkoutRequestId: "../x" })).toBe(false);
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    expect(await saveCheckoutIndex(payment)).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getPaymentByCheckoutRequestId", () => {
  it("returns the indexed payment", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: JSON.stringify(payment) }), { status: 200 }));
    expect(await getPaymentByCheckoutRequestId(ID)).toEqual({ curatorSlug: "wanja", payment });
    expect(fetchMock.mock.calls[0][0]).toContain(encodeURIComponent(`curator:payments:checkout:${ID}`));
  });

  it("returns null for a miss, bad JSON, a record without a curator, or an invalid id", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: null }), { status: 200 }));
    expect(await getPaymentByCheckoutRequestId(ID)).toBeNull();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: "{not json" }), { status: 200 }));
    expect(await getPaymentByCheckoutRequestId(ID)).toBeNull();
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ result: JSON.stringify({ id: "x" }) }), { status: 200 }));
    expect(await getPaymentByCheckoutRequestId(ID)).toBeNull();
    fetchMock.mockClear();
    expect(await getPaymentByCheckoutRequestId("../etc")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("updateCheckoutIndex", () => {
  it("merges updates into the stored copy", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    await updateCheckoutIndex(payment, { status: "paid", ledgerStatus: "recorded" });
    const [[, , value]] = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(value)).toMatchObject({ id: "stk_1", status: "paid", ledgerStatus: "recorded" });
  });
});
