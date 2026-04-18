import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEscrowBalance: vi.fn(),
  depositToEscrow: vi.fn(),
  updateAllowance: vi.fn(),
  withdrawFromEscrow: vi.fn(),
  initializeEscrow: vi.fn(),
}));

vi.mock("../../../../lib/services/escrow-service", () => ({
  getEscrowBalance: mocks.getEscrowBalance,
  initializeEscrow: mocks.initializeEscrow,
  depositToEscrow: mocks.depositToEscrow,
  updateAllowance: mocks.updateAllowance,
  withdrawFromEscrow: mocks.withdrawFromEscrow,
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "premium", permissions: [] }),
}));

describe("GET /api/agent/escrow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when no escrow exists", async () => {
    mocks.getEscrowBalance.mockResolvedValue(null);

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/escrow"));
    expect(res.status).toBe(404);
  });

  it("returns escrow balance with formatted values", async () => {
    mocks.getEscrowBalance.mockResolvedValue({
      balance: (10n * 10n ** 18n).toString(),
      allowance: (5n * 10n ** 18n).toString(),
      spent: (2n * 10n ** 18n).toString(),
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/escrow"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.balance.balanceFormatted).toContain("cUSD");
  });
});

describe("POST /api/agent/escrow", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deposits to escrow", async () => {
    mocks.depositToEscrow.mockResolvedValue({ balance: "10000000000000000000" });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/escrow", {
        method: "POST",
        body: JSON.stringify({ action: "deposit", amount: "10", txHash: "0x" + "a".repeat(64) }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("updates allowance", async () => {
    mocks.updateAllowance.mockResolvedValue({ allowance: "5000000000000000000" });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/escrow", {
        method: "POST",
        body: JSON.stringify({ action: "updateAllowance", allowance: "5" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("withdraws from escrow", async () => {
    mocks.withdrawFromEscrow.mockResolvedValue({
      withdrawal: { amount: "3000000000000000000" },
      balance: { balance: "7000000000000000000" },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/escrow", {
        method: "POST",
        body: JSON.stringify({ action: "withdraw", amount: "3", recipient: "0x" + "b".repeat(40) }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("rejects invalid action", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/escrow", {
        method: "POST",
        body: JSON.stringify({ action: "invalid" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("rejects deposit with invalid txHash", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/escrow", {
        method: "POST",
        body: JSON.stringify({ action: "deposit", amount: "10", txHash: "not-a-hash" }),
      }),
    );
    expect(res.status).toBe(400);
  });
});
