import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getPaymentById: vi.fn(), rateLimit: vi.fn() }));

vi.mock("../../../../../lib/utils/notifications", () => ({ getPaymentById: mocks.getPaymentById }));
vi.mock("../../../../../lib/utils/rate-limit", () => ({ rateLimit: mocks.rateLimit, getClientId: () => "1.2.3.4" }));

import { GET } from "./route";

const ID = "stk_1760000000000_0123456789abcdef01234567";
const get = (qs: string) => GET(new NextRequest(`https://onpoint.test/api/curator/payments/status${qs}`));

describe("GET /api/curator/payments/status", () => {
  beforeEach(() => {
    mocks.rateLimit.mockReset().mockResolvedValue({ allowed: true });
    mocks.getPaymentById.mockReset().mockResolvedValue({
      id: ID, status: "paid", mpesaCode: "SGH61XXXXX", ledgerStatus: "recorded", orderId: "o1", customerPhone: "0700000000", shareId: "a1b2c3d4e5f6",
    });
  });

  it("returns only the public status fields", async () => {
    const res = await get(`?id=${ID}&curatorSlug=wanja`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toMatchObject({ found: true, status: "paid", mpesaCode: "SGH61XXXXX" });
    for (const leaked of ["ledgerStatus", "orderId", "customerPhone", "shareId"]) {
      expect(data).not.toHaveProperty(leaked);
    }
  });

  it("rejects malformed ids without a storage read, and rate limits", async () => {
    expect((await get(`?id=nope&curatorSlug=wanja`)).status).toBe(404);
    expect(mocks.getPaymentById).not.toHaveBeenCalled();
    mocks.rateLimit.mockResolvedValue({ allowed: false });
    expect((await get(`?id=${ID}&curatorSlug=wanja`)).status).toBe(429);
  });

  it("returns 404 for an unknown payment", async () => {
    mocks.getPaymentById.mockResolvedValue(null);
    expect((await get(`?id=${ID}&curatorSlug=wanja`)).status).toBe(404);
  });
});
