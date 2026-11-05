import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export async function POST(request: NextRequest) {
  const upstream = await fetch(`${getApiBase()}/api/magazine`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: await request.text(),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const text = await upstream.text();
  return new NextResponse(text, { status: upstream.status, headers: { "Content-Type": "application/json" } });
}
