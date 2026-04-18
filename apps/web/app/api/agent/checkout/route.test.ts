import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  validateAction: vi.fn(),
  recordSpending: vi.fn(),
  initStore: vi.fn(),
  transfer: vi.fn(),
  getCUSDAddress: vi.fn(),
  getAgentWallet: vi.fn(),
  calculateSplit: vi.fn(),
  createCommissionRecord: vi.fn(),
  persistCommission: vi.fn(),
  buildPaymentRequirements: vi.fn(),
  getPaymentHeader: vi.fn(),
  verify: vi.fn(),
  settle: vi.fn(),
}));

vi.mock("../../../../lib/middleware/agent-controls", () => ({
  AgentControls: {
    initStore: mocks.initStore,
    validateAction: mocks.validateAction,
    recordSpending: mocks.recordSpending,
  },
}));

vi.mock("../../../../lib/utils/erc20", () => ({
  ERC20: { getCUSDAddress: mocks.getCUSDAddress, transfer: mocks.transfer },
}));

vi.mock("../../../../lib/utils/commissions", () => ({
  calculateSplit: mocks.calculateSplit,
  createCommissionRecord: mocks.createCommissionRecord,
}));

vi.mock("../../../../lib/middleware/agent-store", () => ({
  persistCommission: mocks.persistCommission,
}));

vi.mock("../../../../lib/services/agent-wallet", () => ({
  getAgentWallet: mocks.getAgentWallet,
}));

vi.mock("../../../../config/chains", () => ({
  PLATFORM_WALLET: "0xPlatform",
  AGENT_WALLET: "0xAgent",
  getExplorerUrl: vi.fn(() => "https://explorer/tx/0xtxhash"),
}));

vi.mock("../../../../lib/utils/x402", () => ({
  buildPaymentRequirements: mocks.buildPaymentRequirements,
  getPaymentHeader: mocks.getPaymentHeader,
}));

vi.mock("x402/verify", () => ({
  verify: mocks.verify,
  settle: mocks.settle,
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "premium", permissions: [] }),
}));

vi.mock("@onpoint/shared-types", () => ({
  CANVAS_ITEMS: [
    { id: "item-1", slug: "item-1", name: "Test Shirt", price: 10, category: "tops" },
  ],
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/agent/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AGENT_PRIVATE_KEY", "0xdeadbeef");
    mocks.validateAction.mockReturnValue({ allowed: true, requiresApproval: false });
    mocks.getCUSDAddress.mockReturnValue("0xcUSD");
    mocks.transfer.mockResolvedValue({ hash: "0xtxhash", amount: "10", symbol: "cUSD" });
    mocks.getAgentWallet.mockResolvedValue({
      getAddresses: async () => ({ celo: "0xAgent" }),
    });
    mocks.calculateSplit.mockReturnValue({
      recipients: [{ label: "platform", percentBps: 10000, amount: 10n * 10n ** 18n, address: "0xPlatform" }],
    });
    mocks.createCommissionRecord.mockReturnValue({ id: "comm_1" });
    mocks.persistCommission.mockResolvedValue(undefined);
    mocks.buildPaymentRequirements.mockReturnValue({});
    mocks.getPaymentHeader.mockReturnValue(
      Buffer.from(JSON.stringify({ paid: true })).toString("base64"),
    );
    mocks.verify.mockResolvedValue({ isValid: true });
    mocks.settle.mockResolvedValue(undefined);
  });

  it("rejects invalid body", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/checkout", {
        method: "POST",
        body: JSON.stringify({ items: [] }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown product", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/checkout", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: "nope", quantity: 1 }] }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 402 when approval is required", async () => {
    mocks.validateAction.mockReturnValue({
      allowed: false,
      requiresApproval: true,
      approvalRequest: { id: "apr_1", amount: "10 cUSD", description: "test", expiresAt: Date.now() + 60000 },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/checkout", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: "item-1", quantity: 1 }] }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body.approvalRequired).toBe(true);
  });

  it("returns 503 when AGENT_PRIVATE_KEY is missing", async () => {
    vi.stubEnv("AGENT_PRIVATE_KEY", "");

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/checkout", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: "item-1", quantity: 1 }] }),
      }),
    );
    expect(res.status).toBe(503);
  });

  it("completes checkout and records spending", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/checkout", {
        method: "POST",
        body: JSON.stringify({ items: [{ productId: "item-1", quantity: 1 }] }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.order.txHash).toBe("0xtxhash");
    expect(mocks.recordSpending).toHaveBeenCalled();
  });
});
