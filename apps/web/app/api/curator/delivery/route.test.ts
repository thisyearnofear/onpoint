import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getPaymentById: vi.fn(),
  updatePaymentInRedis: vi.fn(),
  createDeliveryNotification: vi.fn(),
  sendReceipt: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("../../../../lib/utils/notifications", () => ({
  getPaymentById: mocks.getPaymentById,
  updatePaymentInRedis: mocks.updatePaymentInRedis,
  createDeliveryNotification: mocks.createDeliveryNotification,
}));
vi.mock("../../../../lib/payments/send-receipt", () => ({ sendReceipt: mocks.sendReceipt }));
vi.mock("../../../../lib/utils/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientId: () => "1.2.3.4" }));

import { POST } from "./route";

const ID = "stk_1760000000000_0123456789abcdef01234567";
const body = {
  paymentId: ID,
  curatorSlug: "wanja",
  recipientName: "Amina",
  recipientPhone: "0712345678",
  deliveryAddress: "Westlands, Nairobi",
};
const stored = { id: ID, curatorSlug: "wanja", status: "paid", fulfilmentStatus: "awaiting_delivery_details", customerPhone: "0700000000", mpesaCode: "SGH61XXXXX" };

function post(payload: unknown = body, raw?: string) {
  return POST(
    new NextRequest("https://onpoint.test/api/curator/delivery", {
      method: "POST",
      body: raw ?? JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/curator/delivery", () => {
  beforeEach(() => {
    mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true });
    mocks.getPaymentById.mockReset().mockResolvedValue({ ...stored });
    mocks.updatePaymentInRedis.mockReset().mockImplementation(async (_s, _id, u) => ({ ...stored, ...u }));
    mocks.createDeliveryNotification.mockReset().mockResolvedValue(undefined);
    mocks.sendReceipt.mockReset().mockResolvedValue(undefined);
  });

  it("saves delivery details and does NOT echo the stored payment record", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(mocks.updatePaymentInRedis).toHaveBeenCalledWith("wanja", ID, expect.objectContaining({ recipientName: "Amina", deliveryAddress: "Westlands, Nairobi" }));
  });

  it("accepts delivery details while a manual payment is still awaiting verification", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...stored, status: "pending_verification", fulfilmentStatus: undefined });
    expect((await post()).status).toBe(200);
  });

  it.each(["ready_for_pickup", "rider_assigned", "delivered"])(
    "refuses to change the address once the order is %s",
    async (fulfilmentStatus) => {
      mocks.getPaymentById.mockResolvedValue({ ...stored, fulfilmentStatus });
      const res = await post();
      expect(res.status).toBe(409);
      expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
      expect(mocks.sendReceipt).not.toHaveBeenCalled();
    },
  );

  it("refuses delivery details for a rejected payment", async () => {
    mocks.getPaymentById.mockResolvedValue({ ...stored, status: "rejected" });
    expect((await post()).status).toBe(409);
    expect(mocks.updatePaymentInRedis).not.toHaveBeenCalled();
  });

  it("returns 404 for an unknown payment and for a malformed id (without touching storage)", async () => {
    mocks.getPaymentById.mockResolvedValue(null);
    expect((await post()).status).toBe(404);
    mocks.getPaymentById.mockClear();
    expect((await post({ ...body, paymentId: "../../etc" })).status).toBe(404);
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    expect((await post()).status).toBe(429);
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
  });

  it("validates the body", async () => {
    expect((await post(undefined, "not json")).status).toBe(400);
    expect((await post({ ...body, recipientName: undefined })).status).toBe(400);
    expect((await post({ ...body, curatorSlug: "A B" })).status).toBe(400);
  });
});
