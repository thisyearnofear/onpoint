import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { verifyInviteToken } from "@/lib/utils/try-on-invite";
import { getApiBase } from "@/lib/utils/api-base";

/** One successful render per link: the claim is returned if the render fails. */
async function releaseInvite(tokenHash: string) {
  try {
    await fetch(`${getApiBase()}/api/invites/release`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tokenHash }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    /* best effort — the claim expires with the token anyway */
  }
}

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

  // Single-use: sha256(token) is claimed upstream before any render. The API
  // never sees the token, only its hash — and when the claim store is down
  // the consume call answers without a 409 and we let the render through.
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const claim = await fetch(`${getApiBase()}/api/invites/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenHash }),
    signal: AbortSignal.timeout(5000),
  }).catch(() => null);
  if (claim?.status === 409) {
    return NextResponse.json(
      { error: "This invite was already used — ask for a fresh one." },
      { status: 410 },
    );
  }

  const upstream = await fetch(`${getApiBase()}/api/ai/virtual-tryon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.VENICE_API_KEY ? { "x-api-key": process.env.VENICE_API_KEY } : {}),
    },
    body: JSON.stringify({
      ...body,
      listingId: invite.listingId,
      curatorSlug: invite.curatorSlug,
      source: "try-on-invite",
    }),
    signal: AbortSignal.timeout(120_000),
  }).catch(() => null);
  if (!upstream) {
    await releaseInvite(tokenHash);
    return NextResponse.json({ error: "Styling service unavailable" }, { status: 503 });
  }
  const text = await upstream.text();
  if (!upstream.ok) await releaseInvite(tokenHash);
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
