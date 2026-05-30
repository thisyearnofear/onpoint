import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
export { OPTIONS } from "../../ai/_utils/http";
import { getProviderOutcomeReport } from "../../../../lib/utils/analytics-store";

/**
 * GET /api/analytics/provider-outcomes
 *
 * Returns aggregated provider outcome metrics from the Redis-backed analytics store.
 * All data is aggregate — no PII, no individual events.
 *
 * Response shape:
 * {
 *   total: number;
 *   byProvider: Record<string, number>;
 *   imageConditioned: { yes: number; no: number };
 *   fallbackReasons: Record<string, number>;
 *   errorClasses: Record<string, number>;
 *   avgLatencyMs: number | null;
 *   garmentSources: Record<string, number>;
 *   garmentCategories: Record<string, number>;
 *   last7Days: { date: string; total: number }[];
 * }
 */
export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";

  try {
    const report = await getProviderOutcomeReport();

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
    console.error("[Analytics] Failed to query provider outcomes:", error);
    return NextResponse.json(
      { error: "Failed to query provider outcomes" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
