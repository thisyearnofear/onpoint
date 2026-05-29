import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

/**
 * GET /api/auth/connect
 * 
 * Compatibility wrapper for the Auth0 SDK v4 connected-account route.
 * The SDK owns /auth/connect and creates the Token Vault ticket/session state.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL('/auth/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const connection = searchParams.get('connection');
    const scopes = [
      ...searchParams.getAll("scopes"),
      ...(searchParams.get("scope")?.split(/\s+/).filter(Boolean) ?? []),
    ];

    if (!connection) {
      return NextResponse.json(
        { error: "Missing 'connection' parameter" },
        { status: 400 }
      );
    }

    const connectUrl = new URL('/auth/connect', request.url);
    connectUrl.searchParams.set('connection', connection);
    connectUrl.searchParams.set('returnTo', searchParams.get('returnTo') || '/');
    for (const scope of scopes) {
      connectUrl.searchParams.append('scopes', scope);
    }

    return NextResponse.redirect(connectUrl);
  } catch (error: any) {
    logger.error("Error", { component: "connect" }, error);
    return NextResponse.json(
      { error: "Failed to initiate connection", details: error.message },
      { status: 500 }
    );
  }
}
