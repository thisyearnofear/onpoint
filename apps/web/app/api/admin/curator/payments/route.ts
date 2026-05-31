import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../../lib/utils/logger";
import {
  updatePaymentInRedis,
} from "../../../../../lib/utils/notifications";
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

    // Handle payment status actions
    if (body.paymentAction === "verify") {
      updates.status = "paid";
      updates.verifiedAt = new Date().toISOString();
      updates.fulfilmentStatus = "awaiting_delivery_details";
    }
    if (body.paymentAction === "reject") {
      updates.status = "rejected";
      updates.rejectedAt = new Date().toISOString();
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

    return NextResponse.json({ success: true, payment: updatedPayment });
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
