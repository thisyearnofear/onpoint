import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  middleware: vi.fn(),
  getSession: vi.fn(),
}));

vi.mock("../auth0", () => ({
  auth0: { middleware: mocks.middleware, getSession: mocks.getSession },
}));

import { proxy } from "../../proxy";

const passThrough = () => NextResponse.next();

function req(path: string) {
  return new NextRequest(`https://onpoint.test${path}`);
}

describe("proxy admin gate", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    mocks.middleware.mockReset().mockImplementation(async () => passThrough());
    mocks.getSession.mockReset().mockResolvedValue(null);
    vi.stubEnv("ADMIN_EMAILS", "ops@example.com");
  });

  it("does not consult the session for public paths", async () => {
    const res = await proxy(req("/s/nia"));
    expect(res.status).toBe(200);
    expect(mocks.getSession).not.toHaveBeenCalled();
  });

  it("returns 401 JSON for anonymous admin API calls (no side effects reachable)", async () => {
    const res = await proxy(req("/api/admin/curator/payments"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "Authentication required" });
  });

  it("redirects anonymous admin page visits to login and preserves the target", async () => {
    const res = await proxy(req("/admin/curators/nia?tab=payments"));
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/login");
    expect(location.searchParams.get("returnTo")).toBe("/admin/curators/nia?tab=payments");
  });

  it("returns 403 for a signed-in user who is not an admin", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "x@example.com", email_verified: true } });
    expect((await proxy(req("/api/admin/proxy/curators/x"))).status).toBe(403);
    expect((await proxy(req("/admin"))).status).toBe(403);
  });

  it("lets a verified allowlisted admin through", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "ops@example.com", email_verified: true } });
    expect((await proxy(req("/admin/curators/nia"))).status).toBe(200);
    expect((await proxy(req("/api/admin/curator/payments"))).status).toBe(200);
  });

  it("fails closed with 503 when ADMIN_EMAILS is not configured", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    mocks.getSession.mockResolvedValue({ user: { email: "ops@example.com", email_verified: true } });
    const api = await proxy(req("/api/admin/curator/payments"));
    expect(api.status).toBe(503);
    expect((await api.json()).error).toMatch(/ADMIN_EMAILS/);
    expect((await proxy(req("/admin"))).status).toBe(503);
  });

  it("still returns the Auth0 response untouched for /auth routes", async () => {
    const authResponse = new NextResponse("login page", { status: 200 });
    mocks.middleware.mockResolvedValue(authResponse);
    expect(await proxy(req("/auth/login"))).toBe(authResponse);
  });
});
