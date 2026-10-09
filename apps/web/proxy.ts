import { NextResponse, type NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";
import {
  decideAdminAccess,
  isAdminApiPath,
  isAdminPath,
  parseAdminEmails,
} from "./lib/utils/admin-access";

export async function proxy(request: NextRequest) {
  // Auth0 handles /auth/* and rolls the session cookie on every other request.
  const response = await auth0.middleware(request);

  const { pathname, search } = request.nextUrl;
  if (!isAdminPath(pathname)) return response;

  // Admin surfaces are never anonymous (see lib/utils/admin-access.ts).
  const session = await auth0.getSession(request);
  const decision = decideAdminAccess({
    pathname,
    user: session?.user,
    allowlist: parseAdminEmails(),
  });

  if (decision.action === "allow") return response;

  if (isAdminApiPath(pathname)) {
    if (decision.action === "login") {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }
    if (decision.action === "unconfigured") {
      return NextResponse.json(
        { error: "Admin access is not configured (set ADMIN_EMAILS)" },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (decision.action === "login") {
    const login = new URL("/auth/login", request.url);
    login.searchParams.set("returnTo", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const unconfigured = decision.action === "unconfigured";
  return new NextResponse(
    unconfigured
      ? "Admin access is not configured. Set ADMIN_EMAILS on the web app."
      : "Forbidden",
    { status: unconfigured ? 503 : 403, headers: { "content-type": "text/plain" } },
  );
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/agent/|api/ai/|api/webhook).*)",
  ],
};
