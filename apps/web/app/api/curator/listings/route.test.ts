import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  query: vi.fn(),
}));

vi.mock("../../../../lib/auth0", () => ({ auth0: { getSession: mocks.getSession } }));
vi.mock("../../../../lib/utils/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  getClientId: () => "test-client",
  RateLimits: { general: {} },
}));
// The route builds a tagged-template SQL client at first use.
vi.mock("@neondatabase/serverless", () => ({
  neon: () => (strings: TemplateStringsArray, ...values: unknown[]) => mocks.query(strings.join("?"), values),
}));

const body = {
  curatorSlug: "wanja",
  club: "Arsenal",
  kitType: "home",
  season: "2024/25",
  sizes: [{ size: "M", stock: 5, price: 1 }],
};

async function post(payload: unknown = body) {
  vi.stubEnv("NEON_DATABASE_URL", "postgres://test");
  const { POST } = await import("./route");
  return POST(
    new Request("https://onpoint.test/api/curator/listings", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/curator/listings is admin-only", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("ADMIN_EMAILS", "ops@example.com");
    mocks.getSession.mockReset().mockResolvedValue(null);
    mocks.query.mockReset().mockResolvedValue([]);
  });

  it("rejects anonymous callers and never touches the database (no price/stock overwrite)", async () => {
    const res = await post();
    expect(res.status).toBe(401);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects a signed-in user who is not an admin", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "curator@example.com", email_verified: true } });
    expect((await post()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("rejects an allowlisted but unverified email", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "ops@example.com", email_verified: false } });
    expect((await post()).status).toBe(403);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("fails closed when no allowlist is configured", async () => {
    vi.stubEnv("ADMIN_EMAILS", "");
    vi.stubEnv("ADMIN_EMAIL", "");
    mocks.getSession.mockResolvedValue({ user: { email: "ops@example.com", email_verified: true } });
    expect((await post()).status).toBe(503);
    expect(mocks.query).not.toHaveBeenCalled();
  });

  it("lets a verified admin through to the normal validation and lookup", async () => {
    mocks.getSession.mockResolvedValue({ user: { email: "Ops@Example.com", email_verified: true } });
    const res = await post(); // empty curator lookup -> 404 proves the gate passed
    expect(res.status).toBe(404);
    expect(mocks.query).toHaveBeenCalled();
  });
});
