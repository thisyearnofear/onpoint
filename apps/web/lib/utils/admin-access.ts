/**
 * Admin access policy for `/admin/*` pages and `/api/admin/*` routes.
 *
 * These surfaces show customer phone numbers and delivery addresses, change
 * payment and fulfilment state, and (via the admin proxy) call the API with the
 * service key, so they must not be reachable anonymously.
 *
 * Policy (enforced in `proxy.ts`):
 *   - a signed-in Auth0 user whose *verified* email is on the allowlist may pass
 *   - the allowlist is `ADMIN_EMAILS` (comma/space separated), falling back to
 *     the single `ADMIN_EMAIL` used for digest mail
 *   - if no allowlist is configured, access is DENIED (fail closed)
 */

export interface AdminUser {
  email?: string | null;
  email_verified?: boolean | null;
}

export type AdminDecision =
  | { action: "allow" }
  | { action: "login" }
  | { action: "forbidden"; reason: "no_email" | "unverified_email" | "not_allowlisted" }
  | { action: "unconfigured" };

/** Parse the admin allowlist from the environment (lowercased, de-duplicated). */
export function parseAdminEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  const raw = env.ADMIN_EMAILS?.trim() ? env.ADMIN_EMAILS : env.ADMIN_EMAIL;
  if (!raw) return [];
  const emails = raw
    .split(/[\s,;]+/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.includes("@"));
  return [...new Set(emails)];
}

/** True for `/admin`, `/admin/...`, `/api/admin`, and `/api/admin/...`. */
export function isAdminPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return (
    p === "/admin" ||
    p.startsWith("/admin/") ||
    p === "/api/admin" ||
    p.startsWith("/api/admin/")
  );
}

export function isAdminApiPath(pathname: string): boolean {
  const p = pathname.toLowerCase();
  return p === "/api/admin" || p.startsWith("/api/admin/");
}

/**
 * Core check, independent of the path: is this user an allowed admin?
 * Shared by the proxy gate and by route handlers that must be admin-only but
 * do not live under /admin or /api/admin.
 */
export function evaluateAdmin(params: {
  user: AdminUser | null | undefined;
  allowlist: string[];
}): AdminDecision {
  const { user, allowlist } = params;
  if (allowlist.length === 0) return { action: "unconfigured" };
  if (!user) return { action: "login" };

  const email = user.email?.trim().toLowerCase();
  if (!email) return { action: "forbidden", reason: "no_email" };
  // An unverified email proves nothing: anyone can self-register one.
  if (user.email_verified !== true) {
    return { action: "forbidden", reason: "unverified_email" };
  }
  if (!allowlist.includes(email)) {
    return { action: "forbidden", reason: "not_allowlisted" };
  }
  return { action: "allow" };
}

export function decideAdminAccess(params: {
  pathname: string;
  user: AdminUser | null | undefined;
  allowlist: string[];
}): AdminDecision {
  if (!isAdminPath(params.pathname)) return { action: "allow" };
  return evaluateAdmin({ user: params.user, allowlist: params.allowlist });
}
