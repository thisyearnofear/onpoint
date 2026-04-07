import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

/**
 * GET /api/auth/connect
 * 
 * Initiates OAuth flow to connect external accounts for Token Vault.
 * Uses Auth0 SDK's authorize endpoint with connection parameter.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL('/api/auth/login', request.url));
    }

    const { searchParams } = new URL(request.url);
    const connection = searchParams.get('connection');
    const scope = searchParams.get('scope');
    const redirectUri = searchParams.get('redirect_uri') || `${process.env.AUTH0_BASE_URL}/api/auth/callback`;

    if (!connection) {
      return NextResponse.json(
        { error: "Missing 'connection' parameter" },
        { status: 400 }
      );
    }

    const params = new URLSearchParams({
      connection,
      redirect_uri: redirectUri,
      prompt: 'consent',
      response_type: 'code',
      client_id: process.env.AUTH0_CLIENT_ID!,
      ...(scope && { scope })
    });

    const authUrl = `${process.env.AUTH0_ISSUER_BASE_URL}/authorize?${params.toString()}`;
    
    return NextResponse.redirect(authUrl);
  } catch (error: any) {
    console.error("[Connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection", details: error.message },
      { status: 500 }
    );
  }
}
