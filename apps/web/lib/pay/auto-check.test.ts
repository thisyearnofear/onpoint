import { describe, expect, it } from "vitest";
import { shouldAutoCheck } from "./auto-check";

const ARMED = { orderId: "ORD-1", checks: 1, last: 10_000 };

function base(overrides: Partial<Parameters<typeof shouldAutoCheck>[0]> = {}) {
  return {
    step: "pay",
    method: "paypal",
    armed: { ...ARMED },
    polling: false,
    limited: false,
    now: 30_000,
    currentOrderId: "ORD-1",
    ...overrides,
  };
}

describe("shouldAutoCheck", () => {
  it("happy path → true", () => {
    expect(shouldAutoCheck(base())).toBe(true);
  });

  it("done/verify steps → false (result showing or check in flight)", () => {
    expect(shouldAutoCheck(base({ step: "done" }))).toBe(false);
    expect(shouldAutoCheck(base({ step: "verify" }))).toBe(false);
    expect(shouldAutoCheck(base({ step: "choose" }))).toBe(false);
    expect(shouldAutoCheck(base({ step: "photo" }))).toBe(false);
  });

  it("non-paypal method → false", () => {
    expect(shouldAutoCheck(base({ method: "near" }))).toBe(false);
    expect(shouldAutoCheck(base({ method: null }))).toBe(false);
    expect(shouldAutoCheck(base({ method: "celo" }))).toBe(false);
  });

  it("disarmed / polling / limited → false", () => {
    expect(shouldAutoCheck(base({ armed: null }))).toBe(false);
    expect(shouldAutoCheck(base({ polling: true }))).toBe(false);
    expect(shouldAutoCheck(base({ limited: true }))).toBe(false);
  });

  it("different or missing order id → false", () => {
    expect(shouldAutoCheck(base({ currentOrderId: "ORD-2" }))).toBe(false);
    expect(shouldAutoCheck(base({ currentOrderId: undefined }))).toBe(false);
  });

  it("<8s since last check → false", () => {
    expect(shouldAutoCheck(base({ now: 15_000 }))).toBe(false);
    expect(shouldAutoCheck(base({ now: 18_000 }))).toBe(true); // exactly 8s
  });

  it("≥4 checks → false", () => {
    expect(shouldAutoCheck(base({ armed: { ...ARMED, checks: 4 } }))).toBe(false);
    expect(shouldAutoCheck(base({ armed: { ...ARMED, checks: 3 } }))).toBe(true);
  });
});
