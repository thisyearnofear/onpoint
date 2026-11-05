import { NextRequest, NextResponse } from "next/server";
import { createInviteToken } from "@/lib/utils/try-on-invite";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const curatorSlug = body?.curatorSlug?.toString().slice(0, 80);
  const listingId = body?.listingId?.toString().slice(0, 80);
  if (!curatorSlug || !listingId) {
    return NextResponse.json({ error: "curatorSlug and listingId required" }, { status: 400 });
  }
  const token = createInviteToken({
    curatorSlug,
    listingId,
    note: body?.note?.toString().slice(0, 280),
    senderName: body?.senderName?.toString().slice(0, 60),
  });
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  return NextResponse.json({ token, inviteUrl: `${base}/try/${token}` });
}
