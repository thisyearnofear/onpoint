/**
 * Client-side metrics helper — fire-and-forget POST to /api/agent/metrics
 * for recording GoodDollar actions (claim, stream_g$) that happen entirely
 * client-side via wagmi.
 */

type ActionStatus = "attempted" | "succeeded" | "failed";

/**
 * Record a client-side action metric. Fire-and-forget — never throws.
 *
 * @param action  Action type (e.g. "claim", "stream_g$")
 * @param status  Outcome status
 */
export function recordMetric(
  action: string,
  status: ActionStatus,
): void {
  try {
    fetch("/api/agent/metrics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, status }),
    }).catch(() => {
      // Silent — metrics are best-effort
    });
  } catch {
    // Silent
  }
}
