import { NextRequest, NextResponse } from "next/server";
import { auth0 } from "../../../../lib/auth0";

export async function GET(request: NextRequest) {
  try {
    const session = await auth0.getSession();

    if (!session?.user) {
      return NextResponse.redirect(new URL("/", request.url));
    }

    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";

    const logoutUrl = await auth0.handleLogout(request, {
      returnTo,
    });

    return NextResponse.redirect(logoutUrl);
  } catch (error) {
    console.error("[Auth0 Logout] Error:", error);
    return NextResponse.redirect(new URL("/", request.url));
  }
}
