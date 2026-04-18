import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateNonceMock = vi.fn();

vi.mock("../../../../middleware/agent-auth", () => ({
  generateNonce: generateNonceMock,
}));

describe("GET /api/auth/nonce", () => {
  beforeEach(() => {
    vi.resetModules();
    generateNonceMock.mockReset();
  });

  it("returns a nonce payload", async () => {
    generateNonceMock.mockResolvedValue("nonce_123");
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/auth/nonce"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ nonce: "nonce_123" });
  });

  it("returns 500 when nonce generation fails", async () => {
    generateNonceMock.mockRejectedValue(new Error("boom"));
    const { GET } = await import("./route");

    const response = await GET(
      new NextRequest("http://localhost/api/auth/nonce"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Failed to generate nonce",
    });
  });
});
