import { NextRequest, NextResponse } from "next/server";
import { readPayments } from "../../../../../lib/utils/notifications";

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

  try {
    const payments = await readPayments(curatorSlug);
    const match = payments.find((p) => p.id === paymentId);

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
