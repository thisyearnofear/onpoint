/**
 * Health Check Endpoint
 *
 * Used by Cloud Run, Netlify, and load balancers to verify the service is alive.
 * Returns dependency status (Redis, AI providers) for observability.
 *
 * Add ?deep=true to test actual Redis connectivity (SET/GET/DEL roundtrip).
 * This verifies the Upstash credentials work, not just that they're set.
 */

import { NextRequest, NextResponse } from "next/server";
import { isRedisConfigured, redisGet, redisSetEx, redisDel } from "../../../lib/utils/redis-helpers";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const deep = new URL(req.url).searchParams.get("deep") === "true";

  const status = {
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      redis: isRedisConfigured(),
      ai: {
        gemini: !!(
          process.env.GEMINI_API_KEY &&
          process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
        ),
        venice: !!process.env.VENICE_API_KEY,
        openai: !!(
          process.env.OPENAI_API_KEY &&
          process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
        ),
      },
      auth0: !!process.env.AUTH0_SECRET,
    },
  };

  // Deep test: actual Redis SET/GET/DEL roundtrip
  if (deep) {
    const testKey = "onpoint:health:deep-test";
    const testValue = { ts: Date.now() };
    let redisRoundtrip: "ok" | "failed" | "not_configured" = "not_configured";

    if (isRedisConfigured()) {
      try {
        await redisSetEx(testKey, testValue, 10);
        const result = await redisGet<typeof testValue>(testKey);
        if (result && result.ts === testValue.ts) {
          redisRoundtrip = "ok";
        } else {
          redisRoundtrip = "failed";
        }
        await redisDel(testKey);
      } catch {
        redisRoundtrip = "failed";
      }
    }

    (status as any).dependencies.redisDeepTest = redisRoundtrip;
  }

  return NextResponse.json(status, { status: 200 });
}
