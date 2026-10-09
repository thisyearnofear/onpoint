import { describe, expect, it } from "vitest";
import { isPaymentId, newPaymentId } from "../ids";

describe("newPaymentId", () => {
  it("has the expected shape and passes its own validator", () => {
    for (const prefix of ["stk", "mpesa"] as const) {
      const id = newPaymentId(prefix);
      expect(id).toMatch(new RegExp(`^${prefix}_\\d{13}_[0-9a-f]{24}$`));
      expect(isPaymentId(id)).toBe(true);
    }
  });

  it("carries 96 random bits: no collisions across many ids", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => newPaymentId("stk")));
    expect(ids.size).toBe(5000);
  });

  it("keeps an order-number suffix that is safe to uppercase", () => {
    const suffix = newPaymentId("stk").slice(-8).toUpperCase();
    expect(suffix).toMatch(/^[0-9A-F]{8}$/);
  });
});

describe("isPaymentId", () => {
  it("accepts legacy ids so existing receipts and tracking links keep working", () => {
    expect(isPaymentId("stk_1760000000000_k3j9x2a")).toBe(true);
    expect(isPaymentId("mpesa_1760000000000_abc1234")).toBe(true);
  });

  it.each(["", "stk_", "stk_abc_def", "x_1760000000000_k3j9x2a", "stk_1760000000000_K3J9X2A", "stk_1760000000000_a/b", "../etc/passwd", "stk_1760000000000_" + "a".repeat(60), null, undefined, 42, {}])(
    "rejects %j",
    (v) => expect(isPaymentId(v)).toBe(false),
  );
});
