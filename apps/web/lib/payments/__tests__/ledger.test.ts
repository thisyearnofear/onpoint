import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordOrderInLedger } from "../ledger";

const fetchMock = vi.fn();
const payment = {
  curatorSlug: "wanja",
  listingId: "l1",
  size: "M",
  amount: 3000,
  customerPhone: "0712345678",
  shareId: "a1b2c3d4e5f6",
  lookSlug: "weekend-fit",
  referralCode: "ref_abcdef01",
};

beforeEach(() => {
  vi.stubEnv("SERVICE_API_KEY", "svc");
  vi.stubEnv("NEXT_PUBLIC_AGENT_API_URL", "https://api.test/");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

describe("recordOrderInLedger", () => {
  it("posts the order with the service key and attribution", async () => {
    fetchMock.mockResolvedValue(json({ success: true, orderId: "o1" }, 201));
    const r = await recordOrderInLedger(payment, "SGH61XXXXX", "254712345678");
    expect(r).toEqual({ outcome: "recorded", orderId: "o1", status: 201 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/orders/record");
    expect(init.headers["x-service-key"]).toBe("svc");
    expect(JSON.parse(init.body)).toEqual({
      curatorSlug: "wanja",
      listingId: "l1",
      size: "M",
      amountKes: 3000,
      mpesaReceipt: "SGH61XXXXX",
      customerPhone: "254712345678",
      source: "site_buy",
      shareId: "a1b2c3d4e5f6",
      lookSlug: "weekend-fit",
      referralCode: "ref_abcdef01",
    });
  });

  it("reports an idempotent hit as already_recorded", async () => {
    fetchMock.mockResolvedValue(json({ success: true, idempotent: true, orderId: "o0" }, 200));
    expect(await recordOrderInLedger(payment, "SGH61XXXXX")).toMatchObject({ outcome: "already_recorded", orderId: "o0" });
  });

  it("reports API rejection as failed without throwing", async () => {
    fetchMock.mockResolvedValue(json({ error: "Unknown curator or listing" }, 404));
    expect(await recordOrderInLedger(payment, "R")).toEqual({ outcome: "failed", status: 404 });
  });

  it("reports a network error as failed without throwing", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await recordOrderInLedger(payment, "R")).toEqual({ outcome: "failed" });
  });

  it("skips (and does not call the API) without a service key", async () => {
    vi.stubEnv("SERVICE_API_KEY", "");
    expect(await recordOrderInLedger(payment, "R")).toEqual({ outcome: "skipped" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("omits empty attribution rather than sending nulls", async () => {
    fetchMock.mockResolvedValue(json({ success: true, orderId: "o1" }, 201));
    await recordOrderInLedger({ ...payment, shareId: null, lookSlug: undefined, referralCode: "" }, "R");
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).not.toHaveProperty("shareId");
    expect(body).not.toHaveProperty("lookSlug");
    expect(body).not.toHaveProperty("referralCode");
  });
});
