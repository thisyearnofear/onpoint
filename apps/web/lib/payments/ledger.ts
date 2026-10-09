/**
 * Record a confirmed M-Pesa payment as an order in the API's Postgres ledger
 * (ADR 0001: Hetzner owns state).
 *
 * Shared by the STK callback (Safaricom confirmed the payment) and the admin
 * verify action (a curator confirmed a manually submitted M-Pesa code). The API
 * endpoint is idempotent on the M-Pesa receipt, so retries are safe.
 *
 * Never throws: callers must not fail a Safaricom ack or an admin click because
 * of a ledger hiccup. The result says what happened so it can be surfaced.
 */
import { logger } from "../utils/logger";

export type LedgerOutcome =
  /** A new order row was written. */
  | "recorded"
  /** The receipt was already ledgered (a retry, or a reused receipt code). */
  | "already_recorded"
  /** The API rejected or could not be reached; reconcile manually. */
  | "failed"
  /** Not attempted (no service key configured). */
  | "skipped";

export interface LedgerResult {
  outcome: LedgerOutcome;
  orderId?: string;
  status?: number;
}

function apiBase(): string {
  return (
    process.env.NEXT_PUBLIC_AGENT_API_URL ||
    process.env.AGENT_API_URL ||
    "http://localhost:48751"
  ).replace(/\/$/, "");
}

export async function recordOrderInLedger(
  payment: Record<string, unknown>,
  mpesaReceipt: string,
  verifiedPhone?: string,
): Promise<LedgerResult> {
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    logger.warn("SERVICE_API_KEY not set — M-Pesa order not ledgered", {
      component: "payments-ledger",
      mpesaReceipt,
    });
    return { outcome: "skipped" };
  }

  try {
    const res = await fetch(`${apiBase()}/api/orders/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-service-key": serviceKey,
      },
      body: JSON.stringify({
        curatorSlug: payment.curatorSlug,
        listingId: payment.listingId,
        size: payment.size,
        amountKes: payment.amount,
        mpesaReceipt,
        customerPhone: verifiedPhone || payment.customerPhone || undefined,
        source: "site_buy",
        // Attribution captured at checkout (all optional, validated by the API)
        shareId: payment.shareId || undefined,
        lookSlug: payment.lookSlug || undefined,
        referralCode: payment.referralCode || undefined,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Ledger rejected M-Pesa order", {
        component: "payments-ledger",
        mpesaReceipt,
        status: res.status,
        body: body.slice(0, 200),
      });
      return { outcome: "failed", status: res.status };
    }

    const data = (await res.json().catch(() => ({}))) as {
      orderId?: string;
      idempotent?: boolean;
    };
    return {
      outcome: data.idempotent ? "already_recorded" : "recorded",
      orderId: data.orderId,
      status: res.status,
    };
  } catch (err) {
    logger.error(
      "Failed to ledger M-Pesa order — reconcile manually",
      { component: "payments-ledger", mpesaReceipt },
      err,
    );
    return { outcome: "failed" };
  }
}
