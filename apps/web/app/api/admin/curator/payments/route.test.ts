import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentById: vi.fn(),
  updatePaymentInRedis: vi.fn(),
  recordOrderInLedger: vi.fn(),
}));

vi.mock("../../../../../lib/utils/notifications", () => ({
  getPaymentById: mocks.getPaymentById,
  updatePaymentInRedis: mocks.updatePaymentInRedis,
}));
vi.mock("../../../../../lib/payments/ledger", () => ({
  recordOrderInLedger: mocks.recordOrderInLedger,
}));
vi.mock("../../../../../lib/payments/send-receipt", () => ({
  sendFulfilmentUpdate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../../../../../lib/payments/push-notify", () => ({
  sendPushNotification: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "./route";

function post(body: Record<string, unknown>) {
  return POST(
    new NextRequest("https://onpoint.test/api/admin/curator/payments", {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

const manualPending = {
  id: "mpesa_1",
  curatorSlug: "wanja",
  listingId: "l1",
  size: "M",
  amount: 3000,
  provider: "mpesa_manual",
  status: "pending_verification",
  mpesaCode: "SGH61XXXXX",
  shareId: "a1b2c3d4e5f6",
  lookSlug: "weekend-fit",
};

const verify = { curatorSlug: "wanja", paymentId: "mpesa_1", paymentAction: "verify" };

describe("admin payments: verifying a manual M-Pesa payment", () => {
  beforeEach(() => {
    mocks.getPaymentById.mockReset().mockResolvedValue({ ...manualPending });
    mocks.updatePaymentInRedis.mockReset().mockImplementation(async (_s, _id, updates) => ({
      ...manualPending,
      ...updates,
    }));
    mocks.recordOrderInLedger.mockReset().mockResolvedValue({ outcome: "recorded", orderId: "order-1" });
  });

  it("records the order BEFORE marking paid, passing attribution through", async () => {
    const res = await post(verify);
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(mocks.recordOrderInLedger).toHaveBeenCalledTimes(1);
    const [paymentArg, receipt] = mocks.recordOrderInLedger.mock.calls[0] as unknown as [Record<string, unknown>, string];
    expect(receipt).toBe("SGH61XXXXX");
    expect(paymentArg).toMatchObject({ shareId: "a1b2c3d4e5f6", lookSlug: "weekend-fit", amount: 3000 });

    expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
      "wanja",
      "mpesa_1",
      expect.objectContaining({ status: "paid", ledgerStatus: "recorded", orderId: "order-1" }),
    );
    expect(body.ledger).toEqual({ outcome: "recorded" });
    expect(body.payment.status).toBe("paid");
  });

  it("is idempotent: verifying an already-ledgered payment does not create a second order", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...manualPending, status: "paid", ledgerStatus: "recorded", orderId: "order-1" });
    const res = await post(verify);
    expect(res.status).toBe(200);
    expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
  });

  it("refuses to count a reused M-Pesa code twice and leaves the payment pending", async () => {
    mocks.recordOrderInLedger.mockResolvedValue({ outcome: "already_recorded", orderId: "someone-elses-order" });
    const res = await post(verify);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/already recorded on another order/i);
    const updates = mocks.updatePaymentInRedis.mock.calls.map((c) => c[2]);
    expect(updates).toEqual([{ ledgerStatus: "duplicate_receipt" }]);
    expect(updates.some((u) => u.status === "paid")).toBe(false);
  });

  it("after an earlier failed attempt, treats an existing receipt as our own insert", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...manualPending, status: "paid", ledgerStatus: "failed" });
    mocks.recordOrderInLedger.mockResolvedValue({ outcome: "already_recorded", orderId: "order-1" });
    const res = await post(verify);
    expect(res.status).toBe(200);
    expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
      "wanja",
      "mpesa_1",
      expect.objectContaining({ ledgerStatus: "recorded", orderId: "order-1" }),
    );
  });

  it("still verifies when the ledger is unreachable, but says so and keeps it retryable", async () => {
    mocks.recordOrderInLedger.mockResolvedValue({ outcome: "failed" });
    const res = await post(verify);
    expect(res.status).toBe(200);
    expect((await res.json()).ledger).toEqual({ outcome: "failed" });
    expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
      "wanja",
      "mpesa_1",
      expect.objectContaining({ status: "paid", ledgerStatus: "failed" }),
    );

    // A second click retries the ledger because it was never recorded.
    mocks.getPaymentById.mockResolvedValue({ ...manualPending, status: "paid", ledgerStatus: "failed" });
    mocks.recordOrderInLedger.mockResolvedValue({ outcome: "recorded", orderId: "order-2" });
    await post(verify);
    expect(mocks.recordOrderInLedger).toHaveBeenCalledTimes(2);
  });

  it("does not ledger STK payments (the callback already did)", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...manualPending, provider: "mpesa_stk", status: "paid" });
    const res = await post(verify);
    expect(res.status).toBe(200);
    expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown payment", async () => {
    mocks.getPaymentById.mockResolvedValue(null);
    expect((await post(verify)).status).toBe(404);
    expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
  });
});

describe("admin payments: rejecting", () => {
  beforeEach(() => {
    mocks.getPaymentById.mockReset();
    mocks.updatePaymentInRedis.mockReset().mockImplementation(async (_s, _id, u) => ({ ...manualPending, ...u }));
    mocks.recordOrderInLedger.mockReset();
  });

  it("rejects a pending payment without touching the ledger", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...manualPending });
    const res = await post({ ...verify, paymentAction: "reject" });
    expect(res.status).toBe(200);
    expect(mocks.recordOrderInLedger).not.toHaveBeenCalled();
    expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith(
      "wanja",
      "mpesa_1",
      expect.objectContaining({ status: "rejected" }),
    );
  });

  it("will not reject a payment that is already an order in the ledger", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...manualPending, status: "paid", ledgerStatus: "recorded" });
    const res = await post({ ...verify, paymentAction: "reject" });
    expect(res.status).toBe(409);
    expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
  });
});
