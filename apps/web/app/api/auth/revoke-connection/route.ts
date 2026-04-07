import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

/**
 * POST /api/auth/revoke-connection
 * 
 * Revokes access to an external account by unlinking the identity.
 * Requires Auth0 Management API access.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
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

    // Find the identity to revoke
    const identities = session.user.identities || [];
    const identity = identities.find((id: any) => id.connection === connection);

    if (!identity) {
      return NextResponse.json(
        { error: "Connection not found" },
        { status: 404 }
      );
    }

    // Call Auth0 Management API to unlink identity
    // Note: This requires AUTH0_MANAGEMENT_API_TOKEN in environment
    const managementToken = process.env.AUTH0_MANAGEMENT_API_TOKEN;
    
    if (!managementToken) {
      console.warn("[Revoke] AUTH0_MANAGEMENT_API_TOKEN not configured");
      return NextResponse.json(
        { error: "Management API not configured. Please set AUTH0_MANAGEMENT_API_TOKEN." },
        { status: 500 }
      );
    }

    const response = await fetch(
      `https://${process.env.AUTH0_DOMAIN}/api/v2/users/${session.user.sub}/identities/${identity.provider}/${identity.user_id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${managementToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("[Revoke] Management API error:", error);
      return NextResponse.json(
        { error: "Failed to revoke connection", details: error },
        { status: response.status }
      );
    }

    return NextResponse.json({ 
      success: true,
      message: `Successfully revoked ${connection}` 
    });
  } catch (error: any) {
    console.error("[Revoke] Error:", error);
    return NextResponse.json(
      { error: "Failed to revoke connection", details: error.message },
      { status: 500 }
    );
  }
}
