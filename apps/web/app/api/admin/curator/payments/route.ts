import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../../lib/utils/logger";
import {
  getPaymentById,
  updatePaymentInRedis,
} from "../../../../../lib/utils/notifications";
import { recordOrderInLedger } from "../../../../../lib/payments/ledger";
import { sendFulfilmentUpdate } from "../../../../../lib/payments/send-receipt";
import { sendPushNotification } from "../../../../../lib/payments/push-notify";

export { OPTIONS } from "../../../ai/_utils/http";

/**
 * Admin payment update proxy
 *
 * The browser cannot send SERVICE_API_KEY, so this proxy directly
 * updates payment records in Redis via the shared utility.
 *
 * POST /api/admin/curator/payments
 */

function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function cleanSlug(value: unknown): string | null {
  const clean = cleanText(value, 64)?.toLowerCase() || null;
  if (!clean || !/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const curatorSlug = cleanSlug(body.curatorSlug);
    const paymentId = cleanText(body.paymentId as string, 80);

    if (!curatorSlug || !paymentId) {
      return NextResponse.json(
        { error: "curatorSlug and paymentId are required" },
        { status: 400 },
      );
    }

    const updates: Record<string, unknown> = {};
    let ledgerOutcome: string | undefined;

    // Handle payment status actions
    if (body.paymentAction === "verify" || body.paymentAction === "reject") {
      const existing = await getPaymentById(curatorSlug, paymentId);
      if (!existing) {
        return NextResponse.json({ error: "Payment not found" }, { status: 404 });
      }
      const isManual = existing.provider === "mpesa_manual";
      const alreadyLedgered =
        existing.ledgerStatus === "recorded" ||
        (existing.status === "paid" && !isManual); // STK callbacks ledger themselves

      if (body.paymentAction === "reject") {
        // A confirmed sale is already in the orders ledger; rejecting here would
        // desynchronise the two. Cancellation belongs in the order tools.
        if (existing.status === "paid" && alreadyLedgered) {
          return NextResponse.json(
            { error: "This payment is already recorded as an order and cannot be rejected here", payment: existing },
            { status: 409 },
          );
        }
        updates.status = "rejected";
        updates.rejectedAt = new Date().toISOString();
      } else if (alreadyLedgered) {
        // Idempotent: verifying twice must not create a second order.
        return NextResponse.json({ success: true, payment: existing, ledger: { outcome: "recorded" } });
      } else {
        // Manual payment: record the order BEFORE marking it paid, so a payment
        // is never "paid" without a ledger entry unless we say so explicitly.
        const receipt = typeof existing.mpesaCode === "string" ? existing.mpesaCode : "";
        const ledger = receipt
          ? await recordOrderInLedger(existing, receipt)
          : { outcome: "skipped" as const, orderId: undefined };

        // A receipt that is already on another order means the same M-Pesa code
        // is being reused (or double-submitted). Do not count it twice. Exception:
        // after an earlier failed attempt, our own insert may have landed.
        if (ledger.outcome === "already_recorded" && existing.ledgerStatus !== "failed") {
          const flagged = await updatePaymentInRedis(curatorSlug, paymentId, {
            ledgerStatus: "duplicate_receipt",
          });
          logger.warn("Manual payment reuses an already-ledgered M-Pesa code", {
            component: "admin-curator-payments",
            curatorSlug,
            paymentId,
          });
          return NextResponse.json(
            {
              error: "This M-Pesa code is already recorded on another order. Check the code before verifying.",
              payment: flagged ?? existing,
            },
            { status: 409 },
          );
        }

        ledgerOutcome = ledger.outcome === "already_recorded" ? "recorded" : ledger.outcome;
        updates.status = "paid";
        updates.verifiedAt = new Date().toISOString();
        updates.fulfilmentStatus = "awaiting_delivery_details";
        updates.ledgerStatus = ledgerOutcome;
        if (ledger.orderId) updates.orderId = ledger.orderId;
      }
    }

    // Handle fulfilment actions
    if (body.fulfilmentAction === "ready_for_pickup") {
      updates.fulfilmentStatus = "ready_for_pickup";
      updates.pickupReadyAt = new Date().toISOString();
    }
    if (body.fulfilmentAction === "rider_assigned") {
      updates.fulfilmentStatus = "rider_assigned";
      updates.riderAssignedAt = new Date().toISOString();
    }
    if (body.fulfilmentAction === "delivered") {
      updates.fulfilmentStatus = "delivered";
      updates.deliveredAt = new Date().toISOString();
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 },
      );
    }

    const updatedPayment = await updatePaymentInRedis(
      curatorSlug,
      paymentId,
      updates,
    );

    if (!updatedPayment) {
      return NextResponse.json(
        { error: "Payment not found" },
        { status: 404 },
      );
    }

    // Send WhatsApp notification for fulfilment status changes (non-blocking)
    const action = body.fulfilmentAction as string | undefined;
    if (action === "ready_for_pickup" || action === "rider_assigned" || action === "delivered") {
      const prev = updatedPayment as Record<string, unknown>;
      const orderNumber = `ONP-${String(paymentId).slice(-8).toUpperCase()}`;

      // Send push notification (non-blocking)
      const pushLabel =
        action === "ready_for_pickup"
          ? "Ready for courier pickup"
          : action === "rider_assigned"
            ? "Rider is on the way"
            : "Delivered! 🎉";
      sendPushNotification({
        paymentId,
        orderNumber,
        statusLabel: pushLabel,
        curatorSlug,
      }).catch(() => {});

      sendFulfilmentUpdate(
        {
          orderNumber,
          paymentId,
          curatorSlug,
          curatorName: String(prev.curatorName || curatorSlug || ""),
          itemName: String(prev.itemName || "Item"),
          customerPhone: String(prev.customerPhone || ""),
        },
        action as "ready_for_pickup" | "rider_assigned" | "delivered",
      ).catch((err) => {
        logger.warn("Fulfilment WhatsApp notification failed", {
          component: "admin-curator-payments",
          curatorSlug,
          paymentId,
          action,
        }, err);
      });
    }

    logger.info("Admin curator payment updated", {
      component: "admin-curator-payments",
      curatorSlug,
      paymentId,
      updates: Object.keys(updates),
    });

    return NextResponse.json({
      success: true,
      payment: updatedPayment,
      ...(ledgerOutcome ? { ledger: { outcome: ledgerOutcome } } : {}),
    });
  } catch (error) {
    logger.error(
      "Admin curator payment update error",
      { component: "admin-curator-payments" },
      error,
    );
    return NextResponse.json(
      { error: "Failed to update payment" },
      { status: 500 },
    );
  }
}
