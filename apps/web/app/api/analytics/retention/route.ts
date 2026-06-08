import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../../ai/_utils/http";
import { getRetentionReport } from "../../../../lib/utils/analytics-store";

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (_req, _ctx) => {
    const origin = "*";

    try {
      const report = await getRetentionReport();

      if (!report) {
        return NextResponse.json(
          {
            totalSaves: 0,
            totalCardOpens: 0,
            totalShares: 0,
            shareRate: "—",
            byShareMethod: {},
            bySaveSource: {},
            bySavePersona: {},
            bySharePersona: {},
            last7Days: [],
          },
          { headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(report, { headers: corsHeaders(origin) });
    } catch (error) {
      return NextResponse.json(
        { error: "Failed to load retention report" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
