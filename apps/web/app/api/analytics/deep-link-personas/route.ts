import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
export { OPTIONS } from "../../ai/_utils/http";
import { getDeepLinkPersonaReport } from "../../../../lib/utils/analytics-store";

/**
 * GET /api/analytics/deep-link-personas
 *
 * Returns aggregated deep-link persona funnel metrics from Redis.
 * Tracks the full lifecycle: selection → completion/abandonment by persona and curator.
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  try {
    const report = await getDeepLinkPersonaReport();

    if (!report) {
      return NextResponse.json(
        {
          error: "Analytics store not available",
          hint: "Configure UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN",
        },
        { status: 503, headers: corsHeaders(origin) },
      );
    }

    return NextResponse.json(report, { headers: corsHeaders(origin) });
  } catch (error) {
    console.error("[Analytics] Failed to query deep-link persona report:", error);
    return NextResponse.json(
      { error: "Failed to query deep-link persona report" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
