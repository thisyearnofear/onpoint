/**
 * Etherfuse webhook signature verification.
 *
 * Etherfuse signs webhooks with an HMAC-SHA256 over the raw request body,
 * using the secret configured at https://app.etherfuse.com/ramp/manage-api.
 * The signature is delivered in `X-Etherfuse-Signature`.
 *
 * We use `crypto.timingSafeEqual` to prevent timing side-channels.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type { EtherfuseWebhookPayload } from "./types.js";

export const ETHERFUSE_SIGNATURE_HEADER = "x-etherfuse-signature";

export function computeSignature(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Verify a webhook signature. Returns `true` only when:
 *   - the secret is configured
 *   - the header is present and well-formed
 *   - the recomputed signature matches in constant time
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): boolean {
  if (!secret) return false;
  if (!signature) return false;

  const expected = computeSignature(rawBody, secret);
  const a = Buffer.from(expected, "hex");
  let b: Buffer;
  try {
    b = Buffer.from(signature, "hex");
  } catch {
    return false;
  }
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Parse + verify a webhook. Throws when the signature is invalid so the
 * route handler can return 401. The body MUST be the raw text — Next.js
 * and Express can both give you the raw text, but you need to opt-in.
 */
export function parseVerifiedWebhook(
  rawBody: string,
  signature: string | null | undefined,
  secret: string | undefined,
): EtherfuseWebhookPayload {
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    throw new Error("Invalid Etherfuse webhook signature");
  }
  const parsed = JSON.parse(rawBody) as EtherfuseWebhookPayload;
  if (!parsed.event || !parsed.orderId) {
    throw new Error("Malformed Etherfuse webhook payload");
  }
  return parsed;
}

/** True when the event represents a terminal state we should credit. */
export function isCreditableEvent(event: string): boolean {
  return event === "order.completed";
}
