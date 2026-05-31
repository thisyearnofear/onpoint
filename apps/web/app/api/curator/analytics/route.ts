import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import {
  getCuratorAnalytics,
  getCuratorFunnelOverview,
} from "../../../../lib/utils/curator-analytics-store";

export { OPTIONS } from "../../ai/_utils/http";

function getServiceKey(): string | undefined {
  return process.env.SERVICE_API_KEY;
}

function cleanSlug(value: string | null): string | null {
  if (!value) return null;
  const clean = value.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

/**
 * GET /api/curator/analytics
 *
 * Returns curator funnel analytics. Requires x-service-key header.
 *
 * Query params:
 *   - curatorSlug (optional): if provided, returns per-curator report
 *   - If omitted, returns cross-curator funnel overview
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const serviceKey = getServiceKey();
  const providedKey = request.headers.get("x-service-key");
  if (!serviceKey || providedKey !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const curatorSlug = cleanSlug(
      new URL(request.url).searchParams.get("curatorSlug"),
    );

    if (curatorSlug) {
      const report = await getCuratorAnalytics(curatorSlug);
      if (!report) {
        return NextResponse.json(
          {
            error: "Analytics not available",
            message: "No analytics data found for this curator. UPSTASH_REDIS_REST_URL may not be configured.",
          },
          { status: 503 },
        );
      }
      return NextResponse.json({ report });
    }

    const overview = await getCuratorFunnelOverview();
    if (!overview) {
      return NextResponse.json(
        {
          error: "Analytics not available",
          message: "UPSTASH_REDIS_REST_URL may not be configured.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ overview });
  } catch (error) {
    logger.error(
      "Curator analytics read error",
      { component: "curator-analytics" },
      error,
    );
    return NextResponse.json(
      { error: "Failed to read curator analytics" },
      { status: 500 },
    );
  }
}
