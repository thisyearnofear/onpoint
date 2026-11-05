import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

async function proxy(request: NextRequest, token: string) {
  const upstream = await fetch(`${getApiBase()}/api/gift/${encodeURIComponent(token)}`, {
    method: request.method,
    headers: request.method === "POST" ? { "Content-Type": "application/json" } : undefined,
    body: request.method === "POST" ? await request.text() : undefined,
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return proxy(_request, (await params).token);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  return proxy(request, (await params).token);
}
