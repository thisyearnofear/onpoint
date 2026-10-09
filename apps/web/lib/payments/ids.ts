/**
 * Payment IDs and the guard for the public endpoints that look payments up by ID.
 *
 * Several customer-facing endpoints (status polling, order tracking, delivery
 * details) are protected only by knowing the payment ID, so the ID is a
 * credential. It used to be `stk_<ms timestamp>_<7 base36 from Math.random()>`:
 * the timestamp is guessable and Math.random() is not cryptographic (its state
 * can be recovered from a few outputs). New IDs carry 96 random bits from the OS
 * CSPRNG. Legacy IDs stay valid so existing receipts and tracking links work.
 */
import { randomBytes } from "node:crypto";

export function newPaymentId(prefix: "stk" | "mpesa"): string {
  return `${prefix}_${Date.now()}_${randomBytes(12).toString("hex")}`;
}

/** Accepts new IDs and legacy ones; rejects anything else before it reaches Redis. */
export function isPaymentId(value: unknown): value is string {
  return typeof value === "string" && /^(stk|mpesa)_\d{10,16}_[a-z0-9]{7,40}$/.test(value);
}

/**
 * Per-client limit for ID-based lookups. Customers poll every 10-15s, and many
 * mobile users share one carrier-NAT address, so this must be generous: the
 * limit only needs to make guessing legacy IDs pointless (a 36-bit random part
 * plus a timestamp), while new IDs (96 random bits) are not guessable at all.
 */
export const PAYMENT_LOOKUP_LIMIT = {
  maxRequests: 300,
  windowMs: 60 * 1000,
  prefix: "payment-lookup",
} as const;
