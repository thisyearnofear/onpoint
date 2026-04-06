import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const auth0Id = session.user.sub;
    const scopes = session.tokenSet.scope?.split(" ") || [];

    const retailers = [
      { id: "zara", name: "Zara", scopes: ["zara:read", "zara:write"] },
      { id: "ssense", name: "SSENSE", scopes: ["ssense:read", "ssense:write"] },
      {
        id: "farfetch",
        name: "FARFETCH",
        scopes: ["farfetch:read", "farfetch:write"],
      },
    ];

    const authorizations = retailers.map((retailer) => {
      const authorized = retailer.scopes.every((scope) =>
        scopes.includes(scope),
      );
      return {
        id: retailer.id,
        name: retailer.name,
        authorized,
        scopes: retailer.scopes,
      };
    });

    return NextResponse.json({
      auth0Id,
      hasAuth0Session: true,
      scopes,
      authorizations,
    });
  } catch (error) {
    console.error("[Auth0 Authorization] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch authorization status" },
      { status: 500 },
    );
  }
}
