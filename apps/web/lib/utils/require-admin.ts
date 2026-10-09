/**
 * Route-handler guard for admin-only endpoints that are not under `/admin` or
 * `/api/admin` (those are covered by `proxy.ts`). Same policy: a signed-in
 * Auth0 user with a verified email on the `ADMIN_EMAILS` allowlist; fail closed.
 *
 * Usage:
 *   const denied = await requireAdmin();
 *   if (denied) return denied;
 */
import { NextResponse } from "next/server";
import { auth0 } from "../auth0";
import { evaluateAdmin, parseAdminEmails } from "./admin-access";

export async function requireAdmin(): Promise<NextResponse | null> {
  const session = await auth0.getSession();
  const decision = evaluateAdmin({
    user: session?.user,
    allowlist: parseAdminEmails(),
  });

  switch (decision.action) {
    case "allow":
      return null;
    case "login":
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    case "unconfigured":
      return NextResponse.json(
        { error: "Admin access is not configured (set ADMIN_EMAILS)" },
        { status: 503 },
      );
    default:
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
}
