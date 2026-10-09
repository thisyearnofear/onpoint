import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPaymentById: vi.fn(), rateLimit: vi.fn() }));

vi.mock("../../../../lib/utils/notifications", () => ({ getPaymentById: mocks.getPaymentById }));
vi.mock("../../../../lib/utils/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientId: () => "1.2.3.4" }));

import { GET } from "./route";

const ID = "mpesa_1760000000000_0123456789abcdef01234567";
const stored = { id: ID, status: "paid", amount: 3000, itemName: "Kit", recipientName: "Amina", recipientPhone: "0712345678", deliveryAddress: "Westlands", customerPhone: "0700000000" };

const get = (qs: string) => GET(new NextRequest(`https://onpoint.test/api/curator/tracking${qs}`));

describe("GET /api/curator/tracking", () => {
  beforeEach(() => {
    mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true });
    mocks.getPaymentById.mockReset().mockResolvedValue({ ...stored });
  });

  it("returns tracking data for a valid id", async () => {
    const res = await get(`?id=${ID}&curatorSlug=wanja`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.found).toBe(true);
    expect(data.delivery.recipientName).toBe("Amina");
    expect(data.orderNumber).toMatch(/^ONP-[0-9A-F]{8}$/);
  });

  it("never exposes the customer's own phone or internal fields", async () => {
    const text = JSON.stringify(await (await get(`?id=${ID}&curatorSlug=wanja`)).json());
    expect(text).not.toContain("0700000000");
  });

  it("treats malformed and unknown ids identically (404, no storage read for malformed)", async () => {
    for (const id of ["x", "../../etc", "stk_1_a", ""]) {
      const res = await get(`?id=${encodeURIComponent(id)}&curatorSlug=wanja`);
      expect([400, 404]).toContain(res.status);
    }
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
    mocks.getPaymentById.mockResolvedValue(null);
    expect((await get(`?id=${ID}&curatorSlug=wanja`)).status).toBe(404);
  });

  it("is rate limited before reading storage", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    expect((await get(`?id=${ID}&curatorSlug=wanja`)).status).toBe(429);
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
  });

  it("requires both parameters", async () => {
    expect((await get(`?id=${ID}`)).status).toBe(400);
    expect((await get(`?curatorSlug=wanja`)).status).toBe(400);
  });
});
