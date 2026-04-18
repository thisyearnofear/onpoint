import { describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/utils/redis-helpers", () => ({
  isRedisConfigured: vi.fn(() => true),
}));

describe("GET /api/health", () => {
  it("returns service status and dependency flags", async () => {
    vi.stubEnv("AUTH0_SECRET", "secret");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    vi.stubEnv("VENICE_API_KEY", "venice-key");

    const { GET } = await import("./route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.status).toBe("ok");
    expect(payload.dependencies.redis).toBe(true);
    expect(payload.dependencies.auth0).toBe(true);
    expect(payload.dependencies.ai).toEqual({
      gemini: true,
      venice: true,
      openai: true,
    });

    vi.unstubAllEnvs();
  });
});
