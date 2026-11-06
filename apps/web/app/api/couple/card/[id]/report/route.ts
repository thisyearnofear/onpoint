import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const upstream = await fetch(
    `${getApiBase()}/api/couple/card/${encodeURIComponent(id)}/report`,
    { method: "POST", signal: AbortSignal.timeout(10_000) },
  ).catch(() => null);
  if (!upstream) return NextResponse.json({ error: "service unavailable" }, { status: 503 });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
  });
}
