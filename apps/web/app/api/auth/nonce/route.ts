/**
 * SIWE Nonce Generation API
 * 
 * Generates a cryptographically secure nonce for SIWE authentication.
 * Nonces are single-use and expire after 10 minutes.
 */

import { NextRequest, NextResponse } from "next/server";
import { generateNonce } from "../../../../middleware/agent-auth";
import { corsHeaders } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

export { OPTIONS } from "../../ai/_utils/http";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders(origin) });
  }

  try {
    const nonce = await generateNonce();

    return NextResponse.json(
      { nonce },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Nonce generation failed", { component: "auth-nonce" }, error);
    return NextResponse.json(
      { error: "Failed to generate nonce" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
