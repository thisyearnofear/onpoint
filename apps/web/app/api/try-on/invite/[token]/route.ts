import { NextRequest, NextResponse } from "next/server";
import { verifyInviteToken } from "@/lib/utils/try-on-invite";
import { getApiBase } from "@/lib/utils/api-base";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = verifyInviteToken(token);
  if (!invite) {
    return NextResponse.json({ error: "Invalid or expired invite" }, { status: 410 });
  }
  const body = await request.json().catch(() => null);
  const photoData = body?.photoData?.toString();
  if (!photoData || !photoData.startsWith("data:image/")) {
    return NextResponse.json({ error: "photoData (data:image/...) required" }, { status: 400 });
  }
  const upstream = await fetch(`${getApiBase()}/api/ai/virtual-tryon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      listingId: invite.listingId,
      curatorSlug: invite.curatorSlug,
      source: "try-on-invite",
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  if (!upstream) {
    return NextResponse.json({ error: "Styling service unavailable" }, { status: 503 });
  }
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
