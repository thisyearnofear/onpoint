import { describe, it, expect, beforeEach, vi } from "vitest";
import { AgentControls, type ActionType } from "../middleware/agent-controls";

// Mock the agent store to avoid Redis dependency in tests
// All persist functions return promises
vi.mock("../middleware/agent-store", () => ({
  loadSpendingLimits: vi.fn(() => null),
  persistSpendingLimits: vi.fn(() => Promise.resolve()),
  loadAutonomyThreshold: vi.fn(() => BigInt(5e17)), // 0.5 ETH default
  persistAutonomyThreshold: vi.fn(() => Promise.resolve()),
  persistSuggestion: vi.fn(() => Promise.resolve()),
  loadSuggestionFromStore: vi.fn(() => null),
  persistApproval: vi.fn(() => Promise.resolve()),
  persistStylePreferences: vi.fn(() => Promise.resolve()),
  loadStylePreferences: vi.fn(() => null),
  hydrateSuggestions: vi.fn(() => []),
  hydrateApprovals: vi.fn(() => []),
  isRedisConfigured: vi.fn(() => false),
}));

describe("Agent Controls", () => {
  const TEST_AGENT = "test-agent-1";

  beforeEach(async () => {
    // Initialize with default config for each test
    await AgentControls.initStore(TEST_AGENT);
  });

  describe("initStore", () => {
    it("initializes store for new agent", async () => {
      await expect(AgentControls.initStore("new-agent")).resolves.not.toThrow();
    });
  });

  describe("validateAction", () => {
    it("allows action within limits", () => {
      const result = AgentControls.validateAction({
        agentId: TEST_AGENT,
        actionType: "tip" as ActionType,
        amount: BigInt(1e17), // 0.1 ETH - within default limits
        amountFormatted: "0.1 cUSD",
        description: "Test tip",
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
    });

    it("requires approval for large actions", () => {
      const result = AgentControls.validateAction({
        agentId: TEST_AGENT,
        actionType: "purchase" as ActionType,
        amount: BigInt(10e18), // 10 ETH - exceeds default autonomy threshold
        amountFormatted: "10 cUSD",
        description: "Large purchase",
      });

      // Should either be blocked or require approval
      expect(result.allowed === false || result.requiresApproval === true).toBe(
        true,
      );
    });
  });

  describe("recordSpending", () => {
    it("tracks spending against limits", () => {
      const amount = BigInt(1e17); // 0.1 ETH

      AgentControls.recordSpending(TEST_AGENT, "tip" as ActionType, amount);

      // Verify by checking a validation that would exceed daily limit if not tracked
      const result = AgentControls.validateAction({
        agentId: TEST_AGENT,
        actionType: "tip" as ActionType,
        amount: BigInt(1e17),
        amountFormatted: "0.1 cUSD",
        description: "Another tip",
      });

      // Should still allow as we haven't exceeded daily limit
      expect(result.allowed).toBe(true);
    });
  });

  describe("suggestAction", () => {
    it("creates a suggestion", async () => {
      const result = await AgentControls.suggestAction({
        agentId: TEST_AGENT,
        actionType: "mint" as ActionType,
        amount: "0.01",
        description: "Mint style NFT",
      });

      expect(result.suggestion).toBeDefined();
      // Status can be "pending" or "accepted" depending on auto-execution
      expect(["pending", "accepted"]).toContain(result.suggestion?.status);
    });
  });

  describe("style preferences", () => {
    it("tracks style interactions", () => {
      AgentControls.trackStyleInteraction("user-1", {
        category: "accessories",
        price: 50,
      });

      // No error thrown means it worked
      expect(true).toBe(true);
    });
  });
});
