import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(async () => ({ allowed: true, remaining: 59, resetAt: Date.now() + 60000, limit: 60 })),
  getClientId: vi.fn(() => "test-client"),
  requireAuthWithRateLimit: vi.fn(),
  getVeniceClient: vi.fn(),
  recordReceipt: vi.fn(async () => ({ id: "receipt_1", agentId: 35962, action: "analyze_outfit", sessionId: "s1", timestamp: new Date().toISOString() })),
  getSessionReceipts: vi.fn(async () => []),
  initStore: vi.fn(),
  suggestAction: vi.fn(() => ({ suggestion: { id: "sug_1" }, autoExecuted: false })),
  getAgentWallet: vi.fn(async () => ({ getAddresses: async () => ({ celo: "0xAgent" }) })),
}));

vi.mock("../../../../lib/utils/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  RateLimits: { veniceFree: { maxRequests: 60, windowMs: 60000, prefix: "test" } },
  rateLimitHeaders: vi.fn(() => ({})),
  getClientId: mocks.getClientId,
}));

vi.mock("../../../../middleware/agent-auth", () => ({
  requireAuthWithRateLimit:
    (handler: Function) => (req: NextRequest) =>
      handler(req, { userId: "user1", agentId: "onpoint-stylist", tier: "free", permissions: [] }),
}));

vi.mock("../_utils/providers", () => ({
  getVeniceClient: mocks.getVeniceClient,
}));

vi.mock("../../../../lib/services/agent-registry", () => ({
  recordReceipt: mocks.recordReceipt,
  getSessionReceipts: mocks.getSessionReceipts,
}));

vi.mock("../../../../lib/middleware/agent-controls", () => ({
  AgentControls: {
    initStore: mocks.initStore,
    suggestAction: mocks.suggestAction,
    trackStyleInteraction: vi.fn(),
  },
}));

vi.mock("../../../../lib/services/agent-wallet", () => ({
  getAgentWallet: mocks.getAgentWallet,
}));

vi.mock("@onpoint/shared-types", () => ({
  CANVAS_ITEMS: [
    { id: "1", slug: "test-shirt", name: "Test Shirt", price: 10, category: "tops", description: "A test shirt" },
  ],
}));

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({ getBalance: vi.fn(async () => 0n) })),
  http: vi.fn(),
  formatEther: vi.fn(() => "0"),
}));

vi.mock("viem/chains", () => ({
  celo: { id: 42220 },
  base: { id: 8453 },
  mainnet: { id: 1 },
  polygon: { id: 137 },
}));

vi.mock("../../../../config/chains", () => ({
  RPC_URLS: { celo: "https://rpc.celo.org" },
}));

describe("POST /api/ai/agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid request body", async () => {
    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/agent", {
        method: "POST",
        body: JSON.stringify({ goal: "invalid_goal" }),
      }),
    );
    expect(res.status).toBe(400);
  });

  it("returns fallback trace when Venice is not configured", async () => {
    mocks.getVeniceClient.mockImplementation(() => {
      throw new Error("No VENICE_API_KEY");
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/agent", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", message: "Analyze my outfit" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.model).toBe("fallback");
    expect(body.steps.length).toBeGreaterThan(0);
  });

  it("runs agent loop when Venice is configured", async () => {
    // Mock Venice client that returns a text response (no tool calls = loop ends)
    const mockCreate = vi.fn(async () => ({
      choices: [{
        message: {
          role: "assistant",
          content: "This is a great casual outfit. Score: 7/10.",
          tool_calls: undefined,
        },
        finish_reason: "stop",
      }],
    }));

    mocks.getVeniceClient.mockReturnValue({
      chat: { completions: { create: mockCreate } },
    });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/agent", {
        method: "POST",
        body: JSON.stringify({ goal: "daily", message: "Analyze my outfit" }),
      }),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.model).toBe("mistral-31-24b");
    expect(body.provider).toBe("venice");
    expect(body.reasoning).toContain("great casual outfit");
    expect(mockCreate).toHaveBeenCalled();
  });

  it("returns 429 when rate limited", async () => {
    mocks.rateLimit.mockResolvedValue({ allowed: false, remaining: 0, resetAt: Date.now() + 5000, limit: 60 });

    const { POST } = await import("./route");
    const res = await POST(
      new NextRequest("http://localhost/api/ai/agent", {
        method: "POST",
        body: JSON.stringify({ goal: "daily" }),
      }),
    );
    expect(res.status).toBe(429);
  });
});
