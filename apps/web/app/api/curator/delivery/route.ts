import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import {
  updatePaymentInRedis,
  createDeliveryNotification,
} from "../../../../lib/utils/notifications";
import { sendReceipt } from "../../../../lib/payments/send-receipt";

export { OPTIONS } from "../../ai/_utils/http";

/**
 * Customer-facing delivery details endpoint.
 * No x-service-key required — customers submit delivery info from the storefront.
 *
 * POST /api/curator/delivery
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
  const body = (await request.json()) as Record<string, unknown>;

  const paymentId = cleanText(body.paymentId as string, 80);
  const curatorSlug = cleanSlug(body.curatorSlug);
  const recipientName = cleanText(body.recipientName as string, 120);
  const recipientPhone = cleanText(body.recipientPhone as string, 40);
  const deliveryAddress = cleanText(body.deliveryAddress as string, 300);
  const deliveryNotes = cleanText(body.deliveryNotes as string, 500);
  const pickupLocation = cleanText(body.pickupLocation as string, 200);
  const courierMethod =
    cleanText(body.courierMethod as string, 60) || "Bolt Send";

  if (!curatorSlug || !paymentId) {
    return NextResponse.json(
      { error: "paymentId and curatorSlug are required" },
      { status: 400 },
    );
  }

  if (!recipientName || !recipientPhone || !deliveryAddress) {
    return NextResponse.json(
      {
        error:
          "recipientName, recipientPhone, and deliveryAddress are required",
      },
      { status: 400 },
    );
  }

  try {
    const updates: Record<string, unknown> = {
      recipientName,
      recipientPhone,
      deliveryAddress,
      courierMethod,
      deliverySubmittedAt: new Date().toISOString(),
    };
    if (deliveryNotes) updates.deliveryNotes = deliveryNotes;
    if (pickupLocation) updates.pickupLocation = pickupLocation;

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

    // Create notification for delivery submission
    await createDeliveryNotification(updatedPayment);

    // Send receipt to customer (non-blocking — don't await)
    const orderNumber = `ONP-${String(paymentId).slice(-8).toUpperCase()}`;
    const prevPayment = updatedPayment as Record<string, unknown>;
    sendReceipt({
      orderNumber,
      paymentId,
      curatorSlug,
      curatorName: String(prevPayment.curatorName || curatorSlug || ""),
      itemName: String(prevPayment.itemName || "Item"),
      size: String(prevPayment.size || ""),
      amount: Number(prevPayment.amount) || 0,
      currency: String(prevPayment.currency || "KES"),
      mpesaCode: String(prevPayment.mpesaCode || "") || null,
      paymentMethod: String(prevPayment.provider || "").includes("stk") ? "stk" : "manual",
      recipientName: recipientName || "",
      recipientPhone: recipientPhone || "",
      deliveryAddress: deliveryAddress || "",
      courierMethod: courierMethod || "Bolt Send",
      customerPhone: String(prevPayment.customerPhone || ""),
      customerEmail: body.customerEmail as string | undefined || null,
    }).catch((err) => {
      logger.warn("Receipt send failed (non-blocking)", {
        component: "curator-delivery",
        curatorSlug,
        paymentId,
      }, err);
    });

    logger.info("Delivery details submitted", {
      component: "curator-delivery",
      curatorSlug,
      paymentId,
    });

    return NextResponse.json({ success: true, payment: updatedPayment });
  } catch (error) {
    logger.error(
      "Delivery submission error",
      { component: "curator-delivery", curatorSlug },
      error,
    );
    return NextResponse.json(
      { error: "Failed to submit delivery details" },
      { status: 500 },
    );
  }
}
