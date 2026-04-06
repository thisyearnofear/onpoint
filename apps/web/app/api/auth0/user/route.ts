import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.json({
        isAuthenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      isAuthenticated: true,
      user: {
        sub: session.user.sub,
        name: session.user.name,
        nickname: session.user.nickname,
        picture: session.user.picture,
        email: session.user.email,
      },
      scopes: session.tokenSet.scope?.split(" ") || [],
    });
  } catch (error) {
    console.error("[Auth0 User] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user" },
      { status: 500 },
    );
  }
}
