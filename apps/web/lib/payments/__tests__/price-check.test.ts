import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { verifyListingPrice } from "../price-check";

const fetchMock = vi.fn();
const storefront = {
  listings: [
    {
      id: "l1",
      sizes: [
        { size: "M", stock: 3, price: 3000 },
        { size: "L", stock: 0, price: 3000 },
        { size: "XL", stock: 2, price: 0 },
        { size: "S", stock: 2, price: 2999.6 },
      ],
    },
  ],
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const base = { curatorSlug: "wanja", listingId: "l1", size: "M", amount: 3000 };

beforeEach(() => {
  fetchMock.mockReset().mockImplementation(async () => json(storefront)); // fresh Response per call (bodies are single-use)
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

describe("verifyListingPrice", () => {
  it("accepts the exact listing price", async () => {
    expect(await verifyListingPrice(base)).toEqual({ ok: true, price: 3000 });
  });

  it("matches the size case-insensitively", async () => {
    expect((await verifyListingPrice({ ...base, size: " m " })).ok).toBe(true);
  });

  it("rejects a tampered amount (the underpayment attack)", async () => {
    for (const amount of [1, 2999, 3001, 30000]) {
      expect(await verifyListingPrice({ ...base, amount })).toMatchObject({ ok: false, status: 409 });
    }
  });

  it("compares whole shillings, matching how payments are rounded", async () => {
    expect((await verifyListingPrice({ ...base, size: "S", amount: 3000 })).ok).toBe(true);
  });

  it("rejects unknown listings, sizes, out-of-stock and unpriced sizes", async () => {
    expect(await verifyListingPrice({ ...base, listingId: "nope" })).toMatchObject({ ok: false, status: 404 });
    expect(await verifyListingPrice({ ...base, size: "XXL" })).toMatchObject({ ok: false, status: 400 });
    expect(await verifyListingPrice({ ...base, size: "L" })).toMatchObject({ ok: false, status: 409, error: expect.stringMatching(/out of stock/) });
    expect(await verifyListingPrice({ ...base, size: "XL", amount: 0 })).toMatchObject({ ok: false, status: 409 });
  });

  it("fails closed (503) when the price cannot be verified", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));
    expect(await verifyListingPrice(base)).toMatchObject({ ok: false, status: 503 });
    fetchMock.mockImplementation(async () => json({}, 500));
    expect(await verifyListingPrice(base)).toMatchObject({ ok: false, status: 503 });
  });

  it("maps an unknown curator to 404", async () => {
    fetchMock.mockImplementation(async () => json({}, 404));
    expect(await verifyListingPrice(base)).toMatchObject({ ok: false, status: 404 });
  });

  it("tolerates a malformed storefront payload", async () => {
    fetchMock.mockImplementation(async () => json({ listings: "nope" }));
    expect(await verifyListingPrice(base)).toMatchObject({ ok: false, status: 404 });
  });
});
