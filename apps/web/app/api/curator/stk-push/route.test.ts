import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initiateStkPush: vi.fn(),
  verifyListingPrice: vi.fn(),
  saveCheckoutIndex: vi.fn(),
  createPaymentNotification: vi.fn(),
}));

vi.mock("../../../../lib/payments/daraja", () => ({ initiateStkPush: mocks.initiateStkPush }));
vi.mock("../../../../lib/payments/price-check", () => ({ verifyListingPrice: mocks.verifyListingPrice }));
vi.mock("../../../../lib/payments/checkout-store", () => ({ saveCheckoutIndex: mocks.saveCheckoutIndex }));
vi.mock("../../../../lib/utils/notifications", () => ({ createPaymentNotification: mocks.createPaymentNotification }));

import { POST } from "./route";

const body = {
  curatorSlug: "wanja",
  listingId: "l1",
  itemName: "Arsenal home kit",
  size: "M",
  amount: 3000,
  customerPhone: "0712345678",
  shareId: "a1b2c3d4e5f6",
  lookSlug: "weekend-fit",
  referralCode: "ref_abcdef01",
};

function post(payload: Record<string, unknown> = body) {
  return POST(
    new NextRequest("https://onpoint.test/api/curator/stk-push", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/curator/stk-push", () => {
  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    mocks.verifyListingPrice.mockReset().mockResolvedValue({ ok: true, price: 3000 });
    mocks.initiateStkPush.mockReset().mockResolvedValue({ checkoutRequestId: "ws_CO_123456789" });
    mocks.saveCheckoutIndex.mockReset().mockResolvedValue(true);
    mocks.createPaymentNotification.mockReset().mockResolvedValue(undefined);
  });

  it("refuses a tampered amount BEFORE charging the customer", async () => {
    mocks.verifyListingPrice.mockResolvedValue({ ok: false, status: 409, error: "The amount does not match the listing price. Refresh and try again." });
    const res = await post({ ...body, amount: 1 });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/does not match the listing price/);
    expect(mocks.initiateStkPush).not.toHaveBeenCalled();
    expect(mocks.saveCheckoutIndex).not.toHaveBeenCalled();
  });

  it("verifies exactly the listing, size and amount that were submitted", async () => {
    await post();
    expect(mocks.verifyListingPrice).toHaveBeenCalledWith({ curatorSlug: "wanja", listingId: "l1", size: "M", amount: 3000 });
  });

  it("fails closed when the price cannot be verified", async () => {
    mocks.verifyListingPrice.mockResolvedValue({ ok: false, status: 503, error: "Could not verify the price right now. Please try again." });
    expect((await post()).status).toBe(503);
    expect(mocks.initiateStkPush).not.toHaveBeenCalled();
  });

  it("starts the push for a verified price and indexes the payment with an unguessable id", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.paymentId).toMatch(/^stk_\d{13}_[0-9a-f]{24}$/);
    expect(mocks.initiateStkPush).toHaveBeenCalledWith(expect.objectContaining({ amount: 3000 }));
    expect(mocks.saveCheckoutIndex).toHaveBeenCalledWith(
      expect.objectContaining({
        id: data.paymentId,
        checkoutRequestId: "ws_CO_123456789",
        shareId: "a1b2c3d4e5f6",
        lookSlug: "weekend-fit",
        referralCode: "ref_abcdef01",
        status: "pending_verification",
      }),
    );
  });

  it("drops malformed attribution instead of storing it", async () => {
    await post({ ...body, shareId: "x'; drop", lookSlug: "A B", referralCode: "ref_abc'; DROP" });
    expect(mocks.saveCheckoutIndex).toHaveBeenCalledWith(
      expect.objectContaining({ shareId: null, lookSlug: null, referralCode: null }),
    );
  });

  it("still validates required fields first", async () => {
    expect((await post({ ...body, size: undefined })).status).toBe(400);
    expect((await post({ ...body, customerPhone: undefined })).status).toBe(400);
    expect(mocks.verifyListingPrice).not.toHaveBeenCalled();
  });
});
