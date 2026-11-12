import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export const maxDuration = 180;

/**
 * Web proxy for the human-facing try-on rails — forwards the same request
 * shape agents use: {curatorSlug, listingId, photoData} → 402 quote, then a
 * payment proof → 200 render. The API rate-limits this endpoint per IP, so
 * the visitor's address is forwarded; without it every visitor shares the
 * web host's allowance.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const clientIp =
    req.headers.get("fly-client-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const upstream = await fetch(`${getApiBase()}/api/agent/try-on`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(170_000),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
