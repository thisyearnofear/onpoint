import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export async function POST(request: NextRequest) {
  const body = await request.text();
  let listId: string | undefined;
  try { listId = JSON.parse(body)?.listId; } catch { /* create path */ }
  const url = listId
    ? `${getApiBase()}/api/wishlist/${encodeURIComponent(listId)}/items`
    : `${getApiBase()}/api/wishlist`;
  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
