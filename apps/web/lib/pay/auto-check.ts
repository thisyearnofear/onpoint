/**
 * Whether a focus/visibility return to this tab should fire an automatic
 * PayPal check. Every call to /api/pay/try-on counts against the API's
 * per-IP cap, so the gate is strict: only while the PayPal pay panel is
 * actually showing, only for the order this quote created, at most four
 * checks, eight seconds apart — and never once a result is showing.
 */
export function shouldAutoCheck({
  step,
  method,
  armed,
  polling,
  limited,
  now,
  currentOrderId,
}: {
  step: string;
  method: string | null;
  armed: { orderId: string; checks: number; last: number } | null;
  polling: boolean;
  /** A 429 notice is showing — an automatic check would just spend another request. */
  limited: boolean;
  now: number;
  currentOrderId: string | undefined;
}): boolean {
  if (step !== "pay" || method !== "paypal") return false;
  if (!armed || polling || limited) return false;
  if (!currentOrderId || armed.orderId !== currentOrderId) return false;
  if (armed.checks >= 4 || now - armed.last < 8000) return false;
  return true;
}
