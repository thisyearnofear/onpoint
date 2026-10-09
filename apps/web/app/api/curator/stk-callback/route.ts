import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import {
  parseStkCallback,
  verifyCallbackToken,
} from "../../../../lib/payments/daraja";
import {
  getPaymentByCheckoutRequestId,
  updateCheckoutIndex,
} from "../../../../lib/payments/checkout-store";
import { recordOrderInLedger } from "../../../../lib/payments/ledger";
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
 * Safaricom cannot send credentials, so authenticity rests on:
 *   1. a shared secret in the registered callback URL (`?s=`), enforced when
 *      DARAJA_CALLBACK_SECRET is set (the CheckoutRequestID alone is not proof:
 *      it is also returned to the paying browser);
 *   2. matching the CheckoutRequestID against a stored pending payment;
 *   3. checking the paid amount against the amount we asked for.
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
 * Legacy lookup: scan the shared "recent" list. Only a fallback now, for
 * payments created before the direct checkout index existed.
 */
async function findPaymentInRecentList(
  checkoutRequestId: string,
): Promise<{ curatorSlug: string; payment: Record<string, unknown> } | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  try {
    const recentRes = await fetch(
      `${url}/lrange/${PAYMENT_PREFIX}:recent/0/${MAX_RECENT_PAYMENTS - 1}`,
      { headers: { Authorization: `Bearer ${token}` } },
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
    const auth = verifyCallbackToken(request.nextUrl.searchParams.get("s"));
    if (!auth.ok) {
      logger.warn("STK callback rejected: missing or invalid token", {
        component: "curator-stk-callback",
      });
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!auth.enforced) {
      logger.warn(
        "DARAJA_CALLBACK_SECRET not set — STK callbacks are unauthenticated",
        { component: "curator-stk-callback" },
      );
    }

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

    // Direct lookup first; the recent-list scan only covers older payments.
    const match =
      (await getPaymentByCheckoutRequestId(result.checkoutRequestId)) ??
      (await findPaymentInRecentList(result.checkoutRequestId));

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

    // Replay guard: a retried or replayed success must not notify or ledger twice.
    if (result.success && match.payment.status === "paid") {
      logger.info("STK callback replay ignored (already paid)", {
        component: "curator-stk-callback",
        checkoutRequestId: result.checkoutRequestId,
      });
      return NextResponse.json({ ResultCode: 0, ResultDesc: "Already processed" });
    }

    const expectedAmount = Number(match.payment.amount);
    const paidAmount =
      result.amount === undefined ? undefined : Number(result.amount);
    const amountMismatch =
      result.success &&
      paidAmount !== undefined &&
      Number.isFinite(expectedAmount) &&
      paidAmount !== expectedAmount;

    if (amountMismatch) {
      logger.error("STK callback amount does not match the payment", {
        component: "curator-stk-callback",
        checkoutRequestId: result.checkoutRequestId,
        expectedAmount,
        paidAmount,
      });
    }

    // Update payment based on result
    const updates: Record<string, unknown> = {
      callbackReceivedAt: new Date().toISOString(),
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
    };

    const confirmed = result.success && !amountMismatch;

    if (confirmed) {
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
      updates.rejectionReason = amountMismatch
        ? `amount_mismatch: paid ${paidAmount}, expected ${expectedAmount}`
        : result.resultDesc;
    }

    const updatedPayment = await updatePaymentInRedis(
      match.curatorSlug,
      match.payment.id as string,
      updates,
    );
    await updateCheckoutIndex(match.payment, updates).catch(() => false);

    if (confirmed && updatedPayment) {
      await createStkConfirmedNotification(updatedPayment);
    }

    if (confirmed && result.mpesaReceiptNumber) {
      const ledger = await recordOrderInLedger(
        { ...match.payment, ...updates },
        result.mpesaReceiptNumber,
        result.phoneNumber ? String(result.phoneNumber) : undefined,
      );
      const ledgerUpdates = {
        ledgerStatus: ledger.outcome,
        ...(ledger.orderId ? { orderId: ledger.orderId } : {}),
      };
      await updatePaymentInRedis(
        match.curatorSlug,
        match.payment.id as string,
        ledgerUpdates,
      ).catch(() => null);
      await updateCheckoutIndex({ ...match.payment, ...updates }, ledgerUpdates).catch(
        () => false,
      );
    }

    logger.info("STK callback processed", {
      component: "curator-stk-callback",
      checkoutRequestId: result.checkoutRequestId,
      success: confirmed,
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
