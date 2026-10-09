import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentByCheckoutRequestId: vi.fn(),
  updateCheckoutIndex: vi.fn(),
  recordOrderInLedger: vi.fn(),
  updatePaymentInRedis: vi.fn(),
  createStkConfirmedNotification: vi.fn(),
}));

vi.mock("../../../../lib/payments/checkout-store", () => ({
  getPaymentByCheckoutRequestId: mocks.getPaymentByCheckoutRequestId,
  updateCheckoutIndex: mocks.updateCheckoutIndex,
}));
vi.mock("../../../../lib/payments/ledger", () => ({
  recordOrderInLedger: mocks.recordOrderInLedger,
}));
vi.mock("../../../../lib/utils/notifications", () => ({
  updatePaymentInRedis: mocks.updatePaymentInRedis,
  createStkConfirmedNotification: mocks.createStkConfirmedNotification,
}));

import { POST } from "./route";

const CHECKOUT_ID = "ws_CO_123456789";

function callback(over: Record<string, unknown> = {}, items?: unknown[]) {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: "m-1",
        CheckoutRequestID: CHECKOUT_ID,
        ResultCode: 0,
        ResultDesc: "The service request is processed successfully.",
        CallbackMetadata: {
          Item: items ?? [
            { Name: "Amount", Value: 3000 },
            { Name: "MpesaReceiptNumber", Value: "SGH61XXXXX" },
            { Name: "PhoneNumber", Value: 254712345678 },
          ],
        },
        ...over,
      },
    },
  };
}

function post(body: unknown, query = "") {
  return POST(
    new NextRequest(`https://onpoint.test/api/curator/stk-callback${query}`, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

const pending = {
  id: "stk_1",
  curatorSlug: "wanja",
  listingId: "l1",
  size: "M",
  amount: 3000,
  provider: "mpesa_stk",
  status: "pending_verification",
  checkoutRequestId: CHECKOUT_ID,
  shareId: "a1b2c3d4e5f6",
  lookSlug: "weekend-fit",
  referralCode: "ref_abcdef01",
};

describe("STK callback", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("DARAJA_CALLBACK_SECRET", "s3cret");
    mocks.getPaymentByCheckoutRequestId.mockReset().mockResolvedValue({ curatorSlug: "wanja", payment: { ...pending } });
    mocks.updateCheckoutIndex.mockReset().mockResolvedValue(true);
    mocks.recordOrderInLedger.mockReset().mockResolvedValue({ outcome: "recorded", orderId: "order-1" });
    mocks.updatePaymentInRedis.mockReset().mockImplementation(async (_s, _id, u) => ({ ...pending, ...u }));
    mocks.createStkConfirmedNotification.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  describe("authenticity", () => {
    it.each([["", "missing token"], ["?s=wrong", "wrong token"], ["?s=", "empty token"]])(
      "rejects with 403 and does nothing: %s (%s)",
      async (query) => {
        const res = await post(callback(), query);
        expect(res.status).toBe(403);
        expect(mocks.getPaymentByCheckoutRequestId).not.toHaveBeenCalled();
        expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
        expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
      },
    );

    it("accepts the right token", async () => {
      const res = await post(callback(), "?s=s3cret");
      expect(res.status).toBe(200);
      expect(mocks.recordOrderInLedger).toHaveBeenCalledTimes(1);
    });

    it("keeps working unauthenticated when no secret is configured (legacy, with a warning)", async () => {
      vi.stubEnv("DARAJA_CALLBACK_SECRET", "");
      const res = await post(callback());
      expect(res.status).toBe(200);
      expect(mocks.recordOrderInLedger).toHaveBeenCalledTimes(1);
    });
  });

  describe("a successful payment", () => {
    it("marks it paid, notifies, ledgers with attribution, and records the ledger result", async () => {
      const res = await post(callback(), "?s=s3cret");
      expect(await res.json()).toEqual({ ResultCode: 0, ResultDesc: "Success" });

      expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
        "wanja",
        "stk_1",
        expect.objectContaining({ status: "paid", mpesaCode: "SGH61XXXXX", verifiedPhone: "254712345678" }),
      );
      expect(mocks.createStkConfirmedNotification).toHaveBeenCalledTimes(1);

      const [paymentArg, receipt, phone] = mocks.recordOrderInLedger.mock.calls[0] as unknown as [Record<string, unknown>, string, string];
      expect(receipt).toBe("SGH61XXXXX");
      expect(phone).toBe("254712345678");
      expect(paymentArg).toMatchObject({
        shareId: "a1b2c3d4e5f6",
        lookSlug: "weekend-fit",
        referralCode: "ref_abcdef01",
        listingId: "l1",
        amount: 3000,
      });

      expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith("wanja", "stk_1", {
        ledgerStatus: "recorded",
        orderId: "order-1",
      });
    });

    it("ignores a replayed callback for an already-paid payment (no second notification or order)", async () => {
      mocks.getPaymentByCheckoutRequestId.mockResolvedValue({
        curatorSlug: "wanja",
        payment: { ...pending, status: "paid" },
      });
      const res = await post(callback(), "?s=s3cret");
      expect(await res.json()).toEqual({ ResultCode: 0, ResultDesc: "Already processed" });
      expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
      expect(mocks.createStkConfirmedNotification).not.toHaveBeenCalled();
      expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    });
  });

  describe("forged or failed callbacks", () => {
    it("rejects a success whose amount differs from what was requested, without ledgering", async () => {
      const res = await post(
        callback({}, [
          { Name: "Amount", Value: 1 },
          { Name: "MpesaReceiptNumber", Value: "FORGED123" },
        ]),
        "?s=s3cret",
      );
      expect(res.status).toBe(200); // still acknowledged to Safaricom
      expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
        "wanja",
        "stk_1",
        expect.objectContaining({ status: "rejected", rejectionReason: "amount_mismatch: paid 1, expected 3000" }),
      );
      expect(mocks.createStkConfirmedNotification).not.toHaveBeenCalled();
      expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    });

    it("marks a failed or cancelled payment rejected and never ledgers it", async () => {
      await post(callback({ ResultCode: 1032, ResultDesc: "Request cancelled by user", CallbackMetadata: undefined }), "?s=s3cret");
      expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
        "wanja",
        "stk_1",
        expect.objectContaining({ status: "rejected", rejectionReason: "Request cancelled by user" }),
      );
      expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    });

    it("acknowledges an unknown checkout request without side effects", async () => {
      mocks.getPaymentByCheckoutRequestId.mockResolvedValue(null);
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      const res = await post(callback(), "?s=s3cret");
      expect(res.status).toBe(200);
      expect((await res.json()).ResultDesc).toMatch(/payment not found/);
      expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
      expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    });

    it("returns 400 for a non-JSON body", async () => {
      const res = await POST(
        new NextRequest("https://onpoint.test/api/curator/stk-callback?s=s3cret", { method: "POST", body: "not json" }),
      );
      expect(res.status).toBe(400);
    });
  });

  describe("lookup", () => {
    it("falls back to the recent-payments scan for payments created before the index existed", async () => {
      mocks.getPaymentByCheckoutRequestId.mockResolvedValue(null);
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://redis.test");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "tok");
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(
          new Response(JSON.stringify({ result: [JSON.stringify({ ...pending, id: "stk_old" })] }), { status: 200 }),
        ),
      );
      const res = await post(callback(), "?s=s3cret");
      expect(res.status).toBe(200);
      expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith("wanja", "stk_old", expect.objectContaining({ status: "paid" }));
    });
  });
});
