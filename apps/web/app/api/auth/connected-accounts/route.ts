import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";
import { TokenVaultService } from "../../../../lib/services/token-vault";

/**
 * GET /api/auth/connected-accounts
 * 
 * Returns the list of connected accounts for the current user.
 * Shows which OAuth providers are authorized and what scopes they have.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const auth0Id = session.user.sub;
    const accounts = await TokenVaultService.getConnectedAccounts(auth0Id);

    return NextResponse.json({
      success: true,
      accounts,
      userId: auth0Id
    });
  } catch (error: any) {
    console.error("[ConnectedAccounts] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch connected accounts", details: error.message },
      { status: 500 }
    );
  }
}
