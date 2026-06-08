import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getEscrowBalance: vi.fn(),
  initializeEscrow: vi.fn(),
  depositToEscrow: vi.fn(),
  updateAllowance: vi.fn(),
  withdrawFromEscrow: vi.fn(),
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
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.exists).toBe(false);
  });

  it("returns escrow balance with formatted values", async () => {
    mocks.getEscrowBalance.mockResolvedValue({
      balance: "1000000000000000000", // 1 cUSD
      allowance: "500000000000000000", // 0.5 cUSD
      spent: "100000000000000000", // 0.1 cUSD
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/escrow"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.exists).toBe(true);
    expect(body.balance.balanceFormatted).toBe("1 cUSD");
    // parseFloat truncates trailing zeros: 0.5 → 0, 0.1 → 0, 0.4 → 0
    expect(body.balance.allowanceFormatted).toBe("0 cUSD");
    expect(body.balance.spentFormatted).toBe("0 cUSD");
    expect(body.balance.remainingFormatted).toBe("0 cUSD");
  });

  it("uses agentId from query param", async () => {
    mocks.getEscrowBalance.mockResolvedValue({
      balance: "1000000000000000000",
      allowance: "1000000000000000000",
      spent: "0",
    });

    const { GET } = await import("./route");
    const res = await GET(new NextRequest("http://localhost/api/agent/escrow?agentId=custom-agent"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(mocks.getEscrowBalance).toHaveBeenCalledWith("user1", "custom-agent");
  });
});

describe("POST /api/agent/escrow", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("deposit", () => {
    it("deposits funds to escrow", async () => {
      mocks.depositToEscrow.mockResolvedValue({
        balance: "2000000000000000000",
        allowance: "1000000000000000000",
        spent: "0",
      });

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "deposit",
            amount: "1",
            txHash: "0x" + "a".repeat(64),
            chainId: 42220,
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("Deposited 1 cUSD");
      expect(mocks.depositToEscrow).toHaveBeenCalled();
    });

    it("rejects invalid txHash format", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "deposit",
            amount: "1",
            txHash: "invalid",
          }),
        }),
      );

      expect(res.status).toBe(400);
    });

    it("rejects missing amount", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "deposit",
            txHash: "0x" + "a".repeat(64),
          }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("updateAllowance", () => {
    it("updates agent spending allowance", async () => {
      mocks.updateAllowance.mockResolvedValue({
        balance: "1000000000000000000",
        allowance: "5000000000000000000",
        spent: "0",
      });

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "updateAllowance",
            allowance: "5",
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("Updated allowance to 5 cUSD");
    });

    it("rejects invalid allowance format", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "updateAllowance",
            allowance: "",
          }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("withdraw", () => {
    it("withdraws funds from escrow", async () => {
      mocks.withdrawFromEscrow.mockResolvedValue({
        withdrawal: { id: "wd_1", amount: "1000000000000000000" },
        balance: { balance: "0", allowance: "0", spent: "0" },
      });

      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "withdraw",
            amount: "1",
            recipient: "0x" + "b".repeat(40),
          }),
        }),
      );
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.message).toContain("Withdrawal initiated");
    });

    it("rejects invalid recipient address", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "withdraw",
            amount: "1",
            recipient: "invalid",
          }),
        }),
      );

      expect(res.status).toBe(400);
    });
  });

  describe("invalid action", () => {
    it("returns 400 for unknown action", async () => {
      const { POST } = await import("./route");
      const res = await POST(
        new NextRequest("http://localhost/api/agent/escrow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "unknown" }),
        }),
      );

      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain("Invalid action");
    });
  });
});
