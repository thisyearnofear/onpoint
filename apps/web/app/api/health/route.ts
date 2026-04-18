/**
 * Health Check Endpoint
 *
 * Used by Cloud Run, Netlify, and load balancers to verify the service is alive.
 * Returns dependency status (Redis, AI providers) for observability.
 */

import { NextResponse } from "next/server";
import { isRedisConfigured } from "../../../lib/utils/redis-helpers";

export const dynamic = "force-dynamic";

export async function GET() {
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

  return NextResponse.json(status, { status: 200 });
}
