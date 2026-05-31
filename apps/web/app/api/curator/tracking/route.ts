import { NextRequest, NextResponse } from "next/server";
import { readPayments } from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

/**
 * GET /api/curator/tracking?id=<paymentId>&curatorSlug=<slug>
 *
 * Customer-facing tracking endpoint.
 * Returns payment details, delivery info, and fulfilment status
 * so the tracking page can display a complete timeline.
 * No auth required — only returns data for a single payment by ID.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const paymentId = searchParams.get("id");
  const curatorSlug = searchParams.get("curatorSlug");

  if (!paymentId || !curatorSlug) {
    return NextResponse.json(
      { error: "id and curatorSlug are required" },
      { status: 400 },
    );
  }

  try {
    const payments = await readPayments(curatorSlug);
    const match = payments.find((p) => p.id === paymentId);

    if (!match) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    const orderNumber = `ONP-${String(paymentId).slice(-8).toUpperCase()}`;

    return NextResponse.json({
      found: true,
      orderNumber,
      payment: {
        id: match.id,
        status: match.status || "pending_verification",
        fulfilmentStatus: match.fulfilmentStatus || null,
        amount: match.amount || 0,
        currency: match.currency || "KES",
        itemName: match.itemName || "",
        size: match.size || "",
        mpesaCode: match.mpesaCode || null,
        provider: match.provider || "",
        createdAt: match.createdAt || null,
        deliverySubmittedAt: match.deliverySubmittedAt || null,
      },
      delivery: match.recipientName
        ? {
            recipientName: match.recipientName,
            recipientPhone: match.recipientPhone,
            deliveryAddress: match.deliveryAddress,
            deliveryNotes: match.deliveryNotes || null,
            pickupLocation: match.pickupLocation || null,
            courierMethod: match.courierMethod || "Bolt Send",
          }
        : null,
      curator: {
        name: match.curatorName || curatorSlug,
        slug: curatorSlug,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch tracking data" },
      { status: 500 },
    );
  }
}
