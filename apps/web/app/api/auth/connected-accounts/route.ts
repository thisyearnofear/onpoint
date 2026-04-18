import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import type { SupportedProvider } from "../../../../lib/services/token-vault";
import { logger } from "../../../../lib/utils/logger";

/**
 * GET /api/auth/connected-accounts
 * 
 * Returns list of connected external accounts for Token Vault.
 * Checks Auth0 user identities to determine which providers are linked.
 */
export async function GET() {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get user's linked identities from Auth0
    const identities = session.user.identities || [];

    const supportedProviders: SupportedProvider[] = [
      "google-oauth2",
      "discord",
      "amazon",
      "paypal",
      "custom-shop",
      "custom-klarna",
    ];

    const accounts = supportedProviders.map((provider) => {
      const identity = identities.find((id: any) => id.connection === provider);

      return {
        connection: provider,
        connected: !!identity,
        scopes: identity?.scopes || [],
        connectedAt: identity?.connectedAt || null,
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
