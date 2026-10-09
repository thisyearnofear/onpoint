/**
 * Index of STK Push payments by Safaricom's CheckoutRequestID.
 *
 * Why: the callback only knows the CheckoutRequestID. It used to find the
 * payment by scanning the 200 most recent payments, so a late callback on a
 * busy day could be "not found" and the order never ledgered. This is a direct
 * key lookup with a TTL, and it holds a current copy of the payment so a replayed
 * callback can be recognised.
 *
 * The per-curator payment list (what dashboards read) is still updated by
 * `updatePaymentInRedis`; this index is an additional, callback-facing view.
 */

const KEY_PREFIX = "curator:payments:checkout";
/** Long enough for any realistic late callback and manual reconciliation. */
const TTL_SECONDS = 7 * 24 * 60 * 60;

function redis(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

function keyFor(checkoutRequestId: string): string {
  return `${KEY_PREFIX}:${checkoutRequestId}`;
}

/** Valid Daraja ids look like `ws_CO_...`; reject anything that could shape a key or path. */
export function isValidCheckoutRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{6,128}$/.test(value);
}

export async function saveCheckoutIndex(
  payment: Record<string, unknown>,
): Promise<boolean> {
  const conn = redis();
  const id = payment.checkoutRequestId;
  if (!conn || !isValidCheckoutRequestId(id)) return false;

  const response = await fetch(`${conn.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${conn.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["SET", keyFor(id), JSON.stringify(payment), "EX", String(TTL_SECONDS)],
    ]),
  });
  return response.ok;
}

export async function getPaymentByCheckoutRequestId(
  checkoutRequestId: string,
): Promise<{ curatorSlug: string; payment: Record<string, unknown> } | null> {
  const conn = redis();
  if (!conn || !isValidCheckoutRequestId(checkoutRequestId)) return null;

  const response = await fetch(
    `${conn.url}/get/${encodeURIComponent(keyFor(checkoutRequestId))}`,
    { headers: { Authorization: `Bearer ${conn.token}` } },
  );
  if (!response.ok) return null;

  const data = await response.json().catch(() => null);
  const raw = data?.result;
  if (typeof raw !== "string") return null;
  try {
    const payment = JSON.parse(raw) as Record<string, unknown>;
    return typeof payment.curatorSlug === "string"
      ? { curatorSlug: payment.curatorSlug, payment }
      : null;
  } catch {
    return null;
  }
}

/** Merge updates into the indexed copy (keeps the TTL fresh). */
export async function updateCheckoutIndex(
  current: Record<string, unknown>,
  updates: Record<string, unknown>,
): Promise<boolean> {
  return saveCheckoutIndex({ ...current, ...updates });
}
