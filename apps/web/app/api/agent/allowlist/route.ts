import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import {
  redisSmembers,
  redisSadd,
  redisSrem,
  isRedisConfigured,
} from "../../../../lib/utils/redis-helpers";
export { OPTIONS } from "../../ai/_utils/http";

const ALLOWLIST_KEY = (userId: string) => `agent:allowlist:${userId}`;

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { merchants: [], available: false },
        { headers: corsHeaders(origin) },
      );
    }

    try {
      const merchants = await redisSmembers(ALLOWLIST_KEY(ctx.userId));
      return NextResponse.json(
        { merchants, available: true },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Allowlist GET failed", { component: "allowlist" }, error);
      return NextResponse.json(
        { error: "Failed to fetch allowlist" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const body = await req.json();
      const { merchant } = body;

      if (!merchant || typeof merchant !== "string" || merchant.length > 200) {
        return NextResponse.json(
          { error: "merchant is required (max 200 chars)" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      await redisSadd(ALLOWLIST_KEY(ctx.userId), merchant.trim().toLowerCase());

      const merchants = await redisSmembers(ALLOWLIST_KEY(ctx.userId));
      return NextResponse.json(
        { success: true, merchants },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Allowlist POST failed", { component: "allowlist" }, error);
      return NextResponse.json(
        { error: "Failed to add merchant" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function DELETE(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const url = new URL(req.url);
      const merchant = url.searchParams.get("merchant");

      if (!merchant) {
        return NextResponse.json(
          { error: "merchant query param required" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      await redisSrem(ALLOWLIST_KEY(ctx.userId), merchant);

      const merchants = await redisSmembers(ALLOWLIST_KEY(ctx.userId));
      return NextResponse.json(
        { success: true, merchants },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Allowlist DELETE failed", { component: "allowlist" }, error);
      return NextResponse.json(
        { error: "Failed to remove merchant" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
