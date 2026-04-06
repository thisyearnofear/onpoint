import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

/**
 * GET /api/auth/connect
 * 
 * Initiates OAuth flow to connect a new external account.
 * Redirects user to Auth0 which handles the OAuth dance.
 * 
 * Query params:
 * - connection: The provider to connect (google-oauth2, github, slack, etc.)
 * - scope: Space-separated list of OAuth scopes
 * - redirect_uri: Where to redirect after authorization
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

    // Build Auth0 authorization URL for the connection
    const authUrl = new URL(`${process.env.AUTH0_ISSUER_BASE_URL}/authorize`);
    authUrl.searchParams.set('client_id', process.env.AUTH0_CLIENT_ID!);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('connection', connection);
    authUrl.searchParams.set('prompt', 'consent');
    
    if (scope) {
      authUrl.searchParams.set('scope', scope);
    }

    // Add state for CSRF protection
    const state = Buffer.from(JSON.stringify({
      userId: session.user.sub,
      connection,
      timestamp: Date.now()
    })).toString('base64');
    authUrl.searchParams.set('state', state);

    return NextResponse.redirect(authUrl.toString());
  } catch (error: any) {
    console.error("[Connect] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection", details: error.message },
      { status: 500 }
    );
  }
}
