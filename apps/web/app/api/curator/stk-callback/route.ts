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
