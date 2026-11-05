import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const photoData = body?.photoData?.toString();
  if (!photoData || !photoData.startsWith("data:image/")) {
    return NextResponse.json({ error: "photoData (data:image/...) required" }, { status: 400 });
  }
  const upstream = await fetch(`${getApiBase()}/api/ai/virtual-tryon`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.VENICE_API_KEY ? { "x-api-key": process.env.VENICE_API_KEY } : {}),
    },
    body: JSON.stringify({ ...body, source: "hero-muse" }),
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
