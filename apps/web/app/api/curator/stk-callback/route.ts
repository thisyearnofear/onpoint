import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import {
  parseStkCallback,
} from "../../../../lib/payments/daraja";
import {
  updatePaymentInRedis,
  createStkConfirmedNotification,
} from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

/**
 * POST /api/curator/stk-callback
 *
 * Public callback endpoint called by Safaricom after an STK Push
 * transaction completes (success, failure, or timeout).
 *
 * No authentication required — Safaricom calls this directly.
 * We validate the callback by matching the CheckoutRequestID
 * against stored pending payments.
 */

const PAYMENT_PREFIX = "curator:payments";
const MAX_RECENT_PAYMENTS = 200;

/**
 * Record the confirmed payment as an order in the Postgres ledger
 * (ADR 0001: Hetzner owns state). Idempotent server-side on the M-Pesa
 * receipt, so callback retries are safe. Never blocks the Safaricom ack —
 * a ledger hiccup is logged for reconciliation, not surfaced.
 */
async function recordOrderInLedger(
  payment: Record<string, unknown>,
  mpesaReceipt: string,
  verifiedPhone: string | undefined,
): Promise<void> {
  const apiBase = (
    process.env.NEXT_PUBLIC_AGENT_API_URL ||
    process.env.AGENT_API_URL ||
    "http://localhost:48751"
  ).replace(/\/$/, "");
  const serviceKey = process.env.SERVICE_API_KEY;
  if (!serviceKey) {
    logger.warn("SERVICE_API_KEY not set — M-Pesa order not ledgered", {
      component: "curator-stk-callback",
      mpesaReceipt,
    });
    return;
  }

  try {
    const res = await fetch(`${apiBase}/api/orders/record`, {
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
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      logger.error("Ledger rejected M-Pesa order", {
        component: "curator-stk-callback",
        mpesaReceipt,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
  } catch (err) {
    logger.error(
      "Failed to ledger M-Pesa order — reconcile manually",
      { component: "curator-stk-callback", mpesaReceipt },
      err,
    );
  }
}

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

/**
 * Find a payment by checkout request ID across all curator payment lists.
 * This is O(n) but acceptable for this volume.
 */
async function findPaymentByCheckoutRequestId(
  checkoutRequestId: string,
): Promise<{ curatorSlug: string; payment: Record<string, unknown> } | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  // We need to scan all curator payment keys. Use SCAN + LRANGE.
  // For simplicity with Upstash REST, fetch the recent feed.
  try {
    const recentRes = await fetch(
      `${url}/lrange/${PAYMENT_PREFIX}:recent/0/${MAX_RECENT_PAYMENTS - 1}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!recentRes.ok) return null;

    const data = await recentRes.json();
    const rows = Array.isArray(data?.result) ? data.result : [];

    for (const row of rows) {
      if (typeof row !== "string") continue;
      try {
        const parsed = JSON.parse(row) as Record<string, unknown>;
        if (parsed.checkoutRequestId === checkoutRequestId) {
          return {
            curatorSlug: parsed.curatorSlug as string,
            payment: parsed,
          };
        }
      } catch {
        continue;
      }
    }
  } catch {
    return null;
  }

  return null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Safaricom sends the callback as JSON in the request body
    const rawBody = await request.json().catch(() => null);
    if (!rawBody) {
      return NextResponse.json(
        { error: "Invalid callback payload" },
        { status: 400 },
      );
    }

    const result = parseStkCallback(rawBody);
    if (!result) {
      logger.warn("Invalid STK callback format", {
        component: "curator-stk-callback",
      });
      // Return 200 to Safaricom even on parse failure to prevent retries
      return NextResponse.json({ ResultCode: 1, ResultDesc: "Invalid payload" });
    }

    logger.info("STK callback received", {
      component: "curator-stk-callback",
      checkoutRequestId: result.checkoutRequestId,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
    });

    // Find the matching payment by checkout request ID
    const match = await findPaymentByCheckoutRequestId(
      result.checkoutRequestId,
    );

    if (!match) {
      logger.warn("STK callback for unknown checkout request", {
        component: "curator-stk-callback",
        checkoutRequestId: result.checkoutRequestId,
      });
      // Return 200 to Safaricom — we acknowledge receipt
      return NextResponse.json({
        ResultCode: 0,
        ResultDesc: "Received (payment not found — may have been cleaned up)",
      });
    }

    // Update payment based on result
    const updates: Record<string, unknown> = {
      callbackReceivedAt: new Date().toISOString(),
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
    };

    if (result.success) {
      updates.status = "paid";
      updates.verifiedAt = new Date().toISOString();
      updates.fulfilmentStatus = "awaiting_delivery_details";
      if (result.mpesaReceiptNumber) {
        updates.mpesaCode = result.mpesaReceiptNumber;
      }
      if (result.phoneNumber) {
        updates.verifiedPhone = String(result.phoneNumber);
      }
      if (result.amount) {
        updates.verifiedAmount = result.amount;
      }
    } else {
      updates.status = "rejected";
      updates.rejectedAt = new Date().toISOString();
      updates.rejectionReason = result.resultDesc;
    }

    const updatedPayment = await updatePaymentInRedis(
      match.curatorSlug,
      match.payment.id as string,
      updates,
    );

    if (result.success && updatedPayment) {
      await createStkConfirmedNotification(updatedPayment);
    }

    if (result.success && result.mpesaReceiptNumber) {
      await recordOrderInLedger(
        match.payment,
        result.mpesaReceiptNumber,
        result.phoneNumber ? String(result.phoneNumber) : undefined,
      );
    }

    logger.info("STK callback processed", {
      component: "curator-stk-callback",
      checkoutRequestId: result.checkoutRequestId,
      success: result.success,
      mpesaReceiptNumber: result.mpesaReceiptNumber,
      updated: Boolean(updatedPayment),
    });

    // Return success to Safaricom (they expect ResultCode 0)
    return NextResponse.json({
      ResultCode: 0,
      ResultDesc: "Success",
    });
  } catch (error) {
    logger.error(
      "STK callback processing error",
      { component: "curator-stk-callback" },
      error,
    );
    // Return 200 to prevent Safaricom retries on our internal error
    return NextResponse.json({
      ResultCode: 1,
      ResultDesc: "Internal error",
    });
  }
}
