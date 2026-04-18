import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  validateAction: vi.fn(),
  recordSpending: vi.fn(),
  initStore: vi.fn(),
  getApprovalRequest: vi.fn(),
  dispatchExternalAction: vi.fn(),
  getSuggestion: vi.fn(),
  createSuggestion: vi.fn(),
  transfer: vi.fn(),
  getCUSDAddress: vi.fn(),
  getAgentWallet: vi.fn(),
}));

vi.mock("../../../../lib/middleware/agent-controls", () => ({
  AgentControls: {
    initStore: mocks.initStore,
    validateAction: mocks.validateAction,
    recordSpending: mocks.recordSpending,
    getApprovalRequest: mocks.getApprovalRequest,
    dispatchExternalAction: mocks.dispatchExternalAction,
    getSuggestion: mocks.getSuggestion,
    createSuggestion: mocks.createSuggestion,
  },
}));

vi.mock("../../../../lib/utils/erc20", () => ({
  ERC20: { getCUSDAddress: mocks.getCUSDAddress, transfer: mocks.transfer },
}));

vi.mock("../../../../lib/services/agent-wallet", () => ({
  getAgentWallet: mocks.getAgentWallet,
}));

vi.mock("../../../../config/chains", () => ({
  PLATFORM_WALLET: "0xPlatform",
  getExplorerUrl: vi.fn(() => "https://explorer/tx/0xtxhash"),
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "premium", permissions: [] }),
}));

vi.mock("@onpoint/shared-types", () => ({
  CANVAS_ITEMS: [
    { id: "item-1", slug: "test-shirt", name: "Test Shirt", price: 10, category: "tops" },
  ],
}));

// ── Tests ────────────────────────────────────────────────────────────────────

describe("POST /api/agent/purchase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AGENT_PRIVATE_KEY", "0xdeadbeef");
    mocks.validateAction.mockReturnValue({ allowed: true, requiresApproval: false });
    mocks.getCUSDAddress.mockReturnValue("0xcUSD");
    mocks.transfer.mockResolvedValue({ hash: "0xtxhash", amount: "10", symbol: "cUSD" });
    mocks.getAgentWallet.mockResolvedValue({
      getAddresses: async () => ({ celo: "0xAgent" }),
    });
  });

  it("rejects missing productId for internal purchase", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 404 for unknown product", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({ productId: "nonexistent" }),
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 when cUSD unavailable on chain", async () => {
    mocks.getCUSDAddress.mockReturnValue(null);

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({ productId: "test-shirt", chain: "celo" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 402 when approval required", async () => {
    mocks.validateAction.mockReturnValue({
      allowed: false,
      requiresApproval: true,
      approvalRequest: { id: "apr_1", amount: "10 cUSD", description: "test", expiresAt: Date.now() + 60000 },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({ productId: "test-shirt" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(402);
    expect(body.approvalRequired).toBe(true);
  });

  it("returns 403 when action not allowed", async () => {
    mocks.validateAction.mockReturnValue({ allowed: false, requiresApproval: false, reason: "Limit exceeded" });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({ productId: "test-shirt" }),
      }),
    );
    expect(res.status).toBe(403);
  });

  it("completes purchase successfully", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({ productId: "test-shirt" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.purchase.txHash).toBe("0xtxhash");
    expect(mocks.recordSpending).toHaveBeenCalled();
  });

  it("dispatches external search when actionType is external_search", async () => {
    mocks.dispatchExternalAction.mockResolvedValue({ success: false });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/agent/purchase", {
        method: "POST",
        body: JSON.stringify({
          actionType: "external_search",
          query: "red dress",
          suggestionId: "sug_1",
        }),
      }),
    );
    // 404 = no results from bridge
    expect(res.status).toBe(404);
    expect(mocks.dispatchExternalAction).toHaveBeenCalled();
  });
});

describe("GET /api/agent/purchase", () => {
  it("returns product catalog", async () => {
    const { GET } = await import("./route");
    const res = await GET(
      new NextRequest("http://localhost/api/agent/purchase"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.products.length).toBeGreaterThan(0);
  });
});
