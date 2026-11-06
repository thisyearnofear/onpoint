import { NextRequest, NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export const maxDuration = 180;

/**
 * Web proxy for the human-facing NEAR try-on rail — forwards the same
 * request shape agents use: {curatorSlug, listingId, photoData} → 402
 * quote, then {nearAccountId, nearTxHash} → 200 render.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const upstream = await fetch(`${getApiBase()}/api/agent/try-on`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(170_000),
  });
  const data = await upstream.json().catch(() => ({}));
  return NextResponse.json(data, { status: upstream.status });
}
