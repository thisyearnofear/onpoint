import { NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import type { SupportedProvider } from "../../../../lib/services/token-vault";

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
      'google-oauth2',
      'github',
      'slack',
      'windowslive',
      'notion',
      'custom-shopping'
    ];

    const accounts = supportedProviders.map(provider => {
      const identity = identities.find((id: any) => id.connection === provider);
      
      return {
        connection: provider,
        connected: !!identity,
        scopes: identity?.scopes || [],
        connectedAt: identity?.connectedAt || null
      };
    });

    return NextResponse.json({ accounts });
  } catch (error: any) {
    console.error("[Connected Accounts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch connected accounts", details: error.message },
      { status: 500 }
    );
  }
}
