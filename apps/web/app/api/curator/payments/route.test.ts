import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  verifyListingPrice: vi.fn(),
  createPaymentNotification: vi.fn(),
  readPayments: vi.fn(),
  recordCuratorPurchase: vi.fn(),
}));

vi.mock("../../../../lib/payments/price-check", () => ({ verifyListingPrice: mocks.verifyListingPrice }));
vi.mock("../../../../lib/utils/notifications", () => ({
  createPaymentNotification: mocks.createPaymentNotification,
  readPayments: mocks.readPayments,
}));
vi.mock("../../../../lib/utils/curator-analytics-store", () => ({ recordCuratorPurchase: mocks.recordCuratorPurchase }));

import { POST } from "./route";

const body = {
  curatorSlug: "wanja",
  listingId: "l1",
  itemName: "Arsenal home kit",
  size: "M",
  amount: 3000,
  customerPhone: "0712345678",
  mpesaCode: "sgh61xxxxx",
  status: "paid", // a client must not be able to self-declare a status
};

function post(payload: Record<string, unknown> = body) {
  return POST(
    new NextRequest("https://onpoint.test/api/curator/payments", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/curator/payments (manual M-Pesa submission)", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    mocks.verifyListingPrice.mockReset().mockResolvedValue({ ok: true, price: 3000 });
    mocks.createPaymentNotification.mockReset().mockResolvedValue(undefined);
    mocks.recordCuratorPurchase.mockReset().mockResolvedValue(undefined);
  });

  it("rejects an amount that differs from the listing price and records nothing", async () => {
    mocks.verifyListingPrice.mockResolvedValue({ ok: false, status: 409, error: "The amount does not match the listing price. Refresh and try again." });
    const res = await post({ ...body, amount: 10 });
    expect(res.status).toBe(409);
    expect(mocks.recordCuratorPurchase).not.toHaveBeenCalled();
  });

  it("accepts a matching amount and issues an unguessable id", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const { payment } = await res.json();
    expect(payment.id).toMatch(/^mpesa_\d{13}_[0-9a-f]{24}$/);
    expect(payment.mpesaCode).toBe("SGH61XXXXX");
    expect(payment.provider).toBe("mpesa_manual");
  });

  it("ignores a client-supplied status: a customer cannot submit a payment as already paid", async () => {
    for (const status of ["paid", "verified", "anything"]) {
      const { payment } = await (await post({ ...body, status })).json();
      expect(payment.status).toBe("pending_verification");
    }
  });

  it("validates required fields before looking up the price", async () => {
    expect((await post({ ...body, mpesaCode: undefined })).status).toBe(400);
    expect(mocks.verifyListingPrice).not.toHaveBeenCalled();
  });
});
