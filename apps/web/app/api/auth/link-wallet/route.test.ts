import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  linkAuth0ToWallet: vi.fn(),
  verifyAndConsumeNonce: vi.fn(),
  siweVerify: vi.fn(),
}));

vi.mock("../../../../lib/auth0", () => ({
  auth0: {
    getSession: mocks.getSession,
  },
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  linkAuth0ToWallet: mocks.linkAuth0ToWallet,
  verifyAndConsumeNonce: mocks.verifyAndConsumeNonce,
}));

vi.mock("siwe", () => ({
  SiweMessage: class {
    address = "0x1111111111111111111111111111111111111111";
    nonce = "nonce_123";
    expirationTime?: string;

    constructor(message: string) {
      if (message === "expired") {
        this.expirationTime = new Date(Date.now() - 1000).toISOString();
      }
    }

    verify(args: unknown) {
      return mocks.siweVerify(args);
    }
  },
}));

describe("POST /api/auth/link-wallet", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ user: { sub: "auth0|user1" } });
    mocks.siweVerify.mockResolvedValue({ success: true });
    mocks.verifyAndConsumeNonce.mockResolvedValue(true);
  });

  it("links the verified SIWE address to the signed-in Auth0 user", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/auth/link-wallet", {
        method: "POST",
        headers: { host: "localhost" },
        body: JSON.stringify({ message: "message", signature: "0xsig" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.siweVerify).toHaveBeenCalledWith({
      signature: "0xsig",
      domain: "localhost",
    });
    expect(mocks.verifyAndConsumeNonce).toHaveBeenCalledWith("nonce_123");
    expect(mocks.linkAuth0ToWallet).toHaveBeenCalledWith(
      "auth0|user1",
      "0x1111111111111111111111111111111111111111",
    );
  });

  it("rejects unsigned address-only payloads", async () => {
    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/auth/link-wallet", {
        method: "POST",
        body: JSON.stringify({
          walletAddress: "0x1111111111111111111111111111111111111111",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(mocks.linkAuth0ToWallet).not.toHaveBeenCalled();
  });

  it("rejects replayed or expired nonces", async () => {
    mocks.verifyAndConsumeNonce.mockResolvedValue(false);

    const { POST } = await import("./route");
    const response = await POST(
      new NextRequest("http://localhost/api/auth/link-wallet", {
        method: "POST",
        body: JSON.stringify({ message: "message", signature: "0xsig" }),
      }),
    );

    expect(response.status).toBe(401);
    expect(mocks.linkAuth0ToWallet).not.toHaveBeenCalled();
  });
});
