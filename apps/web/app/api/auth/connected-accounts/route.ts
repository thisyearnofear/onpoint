import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import type { SupportedProvider } from "../../../../lib/services/token-vault";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

/**
 * GET /api/auth/connected-accounts
 * 
 * Returns list of connected external accounts for Token Vault.
 * Checks Auth0 user identities to determine which providers are linked.
 */
export async function GET(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const connectionTokenSets = session.connectionTokenSets || [];

    const supportedProviders: SupportedProvider[] = [
      "google-oauth2",
      "discord",
      "amazon",
      "paypal",
      "custom-shop",
      "custom-klarna",
    ];

    const accounts = supportedProviders.map((provider) => {
      const tokenSet = connectionTokenSets.find(
        (token) => token.connection === provider,
      );

      return {
        connection: provider,
        connected: !!tokenSet,
        scopes: tokenSet?.scope?.split(" ").filter(Boolean) || [],
        connectedAt: null,
      };
    });

    return NextResponse.json({ accounts });
  } catch (error: unknown) {
    logger.error(
      "Failed to fetch connected accounts",
      { component: "connected-accounts" },
      error,
    );
    return NextResponse.json(
      {
        error: "Failed to fetch connected accounts",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
