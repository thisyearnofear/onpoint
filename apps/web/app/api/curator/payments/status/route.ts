import { NextRequest, NextResponse } from "next/server";
import { getPaymentById } from "../../../../../lib/utils/notifications";
import { rateLimit, getClientId } from "../../../../../lib/utils/rate-limit";
import { isPaymentId, PAYMENT_LOOKUP_LIMIT } from "../../../../../lib/payments/ids";

export { OPTIONS } from "../../../ai/_utils/http";

/**
 * GET /api/curator/payments/status?id=<paymentId>&curatorSlug=<slug>
 *
 * Customer-facing status endpoint used by STK Push polling.
 * No auth required — only returns status for a single payment by ID.
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

  const rl = await rateLimit(`payment-lookup:${getClientId(request)}`, PAYMENT_LOOKUP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!isPaymentId(paymentId)) {
    // Same answer as "unknown payment" so malformed and unknown IDs look alike.
    return NextResponse.json({ found: false }, { status: 404 });
  }

  try {
    const match = await getPaymentById(curatorSlug, paymentId);

    if (!match) {
      return NextResponse.json({ found: false }, { status: 404 });
    }

    return NextResponse.json({
      found: true,
      status: match.status || "pending_verification",
      fulfilmentStatus: match.fulfilmentStatus || null,
      mpesaCode: match.mpesaCode || null,
      resultCode: match.resultCode || null,
      resultDesc: match.resultDesc || null,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to check payment status" },
      { status: 500 },
    );
  }
}
