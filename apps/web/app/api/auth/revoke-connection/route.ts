import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { TokenVaultService } from "../../../../lib/services/token-vault";
import type { SupportedProvider } from "../../../../lib/services/token-vault";

/**
 * POST /api/auth/revoke-connection
 * 
 * Revokes access to a connected account.
 * Removes tokens from Auth0 Token Vault.
 * 
 * Body:
 * - connection: The provider to revoke (google-oauth2, github, etc.)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { connection } = body;

    if (!connection) {
      return NextResponse.json(
        { error: "Missing 'connection' parameter" },
        { status: 400 }
      );
    }

    const auth0Id = session.user.sub;
    await TokenVaultService.revokeConnection(auth0Id, connection as SupportedProvider);

    return NextResponse.json({
      success: true,
      message: `Successfully revoked ${connection}`,
      connection
    });
  } catch (error: any) {
    console.error("[RevokeConnection] Error:", error);
    return NextResponse.json(
      { error: "Failed to revoke connection", details: error.message },
      { status: 500 }
    );
  }
}
