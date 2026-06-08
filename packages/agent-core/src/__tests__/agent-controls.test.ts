/**
 * Unit Tests — Agent Controls
 *
 * Tests spending limits, autonomy thresholds, suggestion lifecycle,
 * style memory, and the full validation chain.
 *
 * All Redis/escrow/fraud dependencies are mocked — these tests
 * validate business logic only.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseEther } from "viem";
import type { ActionType } from "../agent-controls";

// ── Mock agent-store ──
vi.mock("../agent-store", () => ({
  loadSpendingLimits: vi.fn(() => null),
  persistSpendingLimits: vi.fn(() => Promise.resolve()),
  loadAutonomyThreshold: vi.fn(() => Promise.resolve(null)),
  persistAutonomyThreshold: vi.fn(() => Promise.resolve()),
  persistSuggestion: vi.fn(() => Promise.resolve()),
  loadSuggestion: vi.fn(() => null),
  persistApproval: vi.fn(() => Promise.resolve()),
  persistStylePreferences: vi.fn(() => Promise.resolve()),
  loadStylePreferences: vi.fn(() => Promise.resolve(null)),
  hydrateSuggestions: vi.fn(() => undefined),
  hydrateApprovals: vi.fn(() => undefined),
  isRedisConfigured: vi.fn(() => false),
}));

// ── Mock escrow-service ──
vi.mock("../escrow-service", () => ({
  canSpendFromEscrow: vi.fn(() =>
    Promise.resolve({ allowed: true, balance: { balance: "100000000000000000000" } }),
  ),
  deductFromEscrow: vi.fn(() => Promise.resolve()),
}));

// ── Mock fraud-detection ──
vi.mock("../fraud-detection", () => ({
  checkAgentHealth: vi.fn(() =>
    Promise.resolve({ status: "healthy", anomalyScore: 0 }),
  ),
  recordHeartbeat: vi.fn(() => Promise.resolve()),
  isAgentFrozen: vi.fn(() => Promise.resolve({ frozen: false })),
  analyzeTransactionPattern: vi.fn(() =>
    Promise.resolve({ anomalyScore: 0, flags: [] }),
  ),
  updateAnomalyScore: vi.fn(() => Promise.resolve()),
  requiresMultiSig: vi.fn(() => false),
  createMultiSigRequirement: vi.fn(() =>
    Promise.resolve({
      transactionId: "multisig_test",
      status: "pending",
    }),
  ),
}));

// ── Mock logger ──
vi.mock("../logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Must import AFTER mocks are set up
const {
  AgentControls,
  initializeAgentLimits,
  checkSpendingLimit,
  recordSpending,
  getRemainingLimit,
  setAutonomyThreshold,
  getAutonomyThreshold,
  isBelowAutonomyThreshold,
  createSuggestion,
  getSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  markSuggestionExecuted,
  getPendingSuggestions,
  getStylePreferences,
  updateStylePreferences,
  trackStyleInteraction,
  validateAction,
  suggestAction,
  createApprovalRequest,
  getApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
} = await import("../agent-controls");

const AGENT_ID = "test-agent-1";
const USER_ID = "test-user-1";

describe("Agent Controls", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // Reset internal state by reinitializing
    await AgentControls.initStore(AGENT_ID, USER_ID);
  });

  // ==========================================
  // Spending Limits
  // ==========================================
  describe("initializeAgentLimits", () => {
    it("creates default spending limits for all action types", () => {
      const limits = initializeAgentLimits(AGENT_ID, USER_ID);
      const types = limits.map((l) => l.actionType);
      expect(types).toContain("tip");
      expect(types).toContain("purchase");
      expect(types).toContain("mint");
      expect(types).toContain("premium");
      expect(types).toContain("agent_to_agent");
      expect(types).toContain("external_search");
      expect(types).toContain("external_purchase");
    });

    it("respects custom daily tip limit override", () => {
      const customConfig = { dailyTipLimit: parseEther("50") };
      const limits = initializeAgentLimits(AGENT_ID, USER_ID, customConfig);
      const tipLimit = limits.find((l) => l.actionType === "tip");
      expect(tipLimit?.dailyLimit).toBe(parseEther("50"));
    });

    it("starts with zero spent today", () => {
      const limits = initializeAgentLimits(AGENT_ID, USER_ID);
      limits.forEach((limit) => {
        expect(limit.spentToday).toBe(0n);
      });
    });
  });

  describe("checkSpendingLimit", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("allows tip under per-action limit", () => {
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", parseEther("5"));
      expect(result.allowed).toBe(true);
    });

    it("blocks tip exceeding per-action limit", () => {
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", parseEther("20"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("per-action limit");
    });

    it("blocks action exceeding daily limit", () => {
      // First spend most of the daily limit
      recordSpending(AGENT_ID, USER_ID, "tip", parseEther("99"));
      // Then try to spend remaining + more
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", parseEther("5"));
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Daily limit exceeded");
    });

    it("resets daily spending after 24 hours", () => {
      // Force spend to daily limit
      recordSpending(AGENT_ID, USER_ID, "tip", parseEther("99"));
      expect(checkSpendingLimit(AGENT_ID, USER_ID, "tip", parseEther("5")).allowed).toBe(false);

      // Simulate time passing by manipulating the limit directly
      // We can't fast-forward easily, so verify the reset logic works via
      // the lastResetTimestamp check by using a different mechanism
      const limits = AgentControls.getAgentLimits(AGENT_ID, USER_ID);
      const tipLimit = limits.find((l) => l.actionType === "tip")!;
      tipLimit.lastResetTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      // Now the limit should reset on the next check
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", parseEther("5"));
      expect(result.allowed).toBe(true);
    });

    it("handles all valid action types", () => {
      // Note: premium and external_search have lower per-action limits
      const types: { type: ActionType; amount: bigint }[] = [
        { type: "tip", amount: parseEther("1") },
        { type: "purchase", amount: parseEther("1") },
        { type: "mint", amount: parseEther("1") },
        { type: "agent_to_agent", amount: parseEther("1") },
        { type: "external_search", amount: parseEther("0.01") }, // perAction = 0.1
        { type: "external_purchase", amount: parseEther("1") },
        { type: "premium", amount: parseEther("0.1") }, // perAction = 0.5
      ];
      for (const { type, amount } of types) {
        const result = checkSpendingLimit(AGENT_ID, USER_ID, type, amount);
        expect(result.allowed).toBe(true);
      }
    });
  });

  describe("recordSpending", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("accumulates spent amount", () => {
      recordSpending(AGENT_ID, USER_ID, "tip", parseEther("10"));
      const limits = AgentControls.getAgentLimits(AGENT_ID, USER_ID);
      const tipLimit = limits.find((l) => l.actionType === "tip")!;
      expect(tipLimit.spentToday).toBe(parseEther("10"));
    });

    it("accumulates multiple records", () => {
      recordSpending(AGENT_ID, USER_ID, "tip", parseEther("10"));
      recordSpending(AGENT_ID, USER_ID, "tip", parseEther("20"));
      const limits = AgentControls.getAgentLimits(AGENT_ID, USER_ID);
      const tipLimit = limits.find((l) => l.actionType === "tip")!;
      expect(tipLimit.spentToday).toBe(parseEther("30"));
    });
  });

  describe("getRemainingLimit", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("returns full daily limit when nothing spent", () => {
      const remaining = getRemainingLimit(AGENT_ID, USER_ID, "purchase");
      expect(remaining.daily).toBe(parseEther("500"));
      expect(remaining.remaining).toBe(parseEther("500"));
      expect(remaining.perAction).toBe(parseEther("100"));
    });

    it("returns reduced remaining after spending", () => {
      recordSpending(AGENT_ID, USER_ID, "purchase", parseEther("100"));
      const remaining = getRemainingLimit(AGENT_ID, USER_ID, "purchase");
      expect(remaining.remaining).toBe(parseEther("400"));
    });

    it("returns zero when daily limit exhausted", () => {
      recordSpending(AGENT_ID, USER_ID, "purchase", parseEther("600"));
      const remaining = getRemainingLimit(AGENT_ID, USER_ID, "purchase");
      expect(remaining.remaining).toBe(0n);
    });
  });

  // ==========================================
  // Autonomy Threshold
  // ==========================================
  describe("autonomy threshold", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("defaults to $5 cUSD", () => {
      const threshold = getAutonomyThreshold(AGENT_ID, USER_ID);
      expect(threshold).toBe(parseEther("5"));
    });

    it("can be updated", () => {
      setAutonomyThreshold(AGENT_ID, USER_ID, parseEther("10"));
      expect(getAutonomyThreshold(AGENT_ID, USER_ID)).toBe(parseEther("10"));
    });

    it("identifies amounts below threshold", () => {
      expect(isBelowAutonomyThreshold(AGENT_ID, USER_ID, parseEther("1"))).toBe(true);
      expect(isBelowAutonomyThreshold(AGENT_ID, USER_ID, parseEther("5"))).toBe(true);
    });

    it("identifies amounts above threshold", () => {
      // Set threshold to a small value for this test
      setAutonomyThreshold(AGENT_ID, USER_ID, parseEther("5"));
      expect(isBelowAutonomyThreshold(AGENT_ID, USER_ID, parseEther("6"))).toBe(false);
    });
  });

  // ==========================================
  // Suggestions
  // ==========================================
  describe("createSuggestion", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("creates a suggestion with auto-approve for sub-threshold amounts", () => {
      const suggestion = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Small tip",
      });

      expect(suggestion.autoApprovable).toBe(true);
      expect(suggestion.status).toBe("accepted");
    });

    it("creates a pending suggestion for above-threshold amounts", () => {
      const suggestion = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "50",
        description: "Large purchase",
      });

      expect(suggestion.autoApprovable).toBe(false);
      expect(suggestion.status).toBe("pending");
    });

    it("generates a unique ID", () => {
      const s1 = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Test",
      });
      const s2 = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Test",
      });
      expect(s1.id).not.toBe(s2.id);
    });

    it("sets expiration with default 10 minutes", () => {
      const suggestion = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Test",
      });

      const expectedExpiry = suggestion.createdAt + 10 * 60 * 1000;
      expect(suggestion.expiresAt).toBe(expectedExpiry);
    });
  });

  describe("suggestion lifecycle", () => {
    let suggestionId: string;

    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
      // Create a manual suggestion with pending status (above threshold)
      const s = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "50",
        description: "Large purchase",
      });
      suggestionId = s.id;
    });

    it("retrieves a suggestion by ID", () => {
      const s = getSuggestion(suggestionId);
      expect(s).not.toBeNull();
      expect(s!.id).toBe(suggestionId);
    });

    it("accepts a pending suggestion", () => {
      const accepted = acceptSuggestion(suggestionId, USER_ID);
      expect(accepted).toBe(true);

      const s = getSuggestion(suggestionId);
      expect(s!.status).toBe("accepted");
    });

    it("rejects a pending suggestion", () => {
      const rejected = rejectSuggestion(suggestionId, USER_ID);
      expect(rejected).toBe(true);

      const s = getSuggestion(suggestionId);
      expect(s!.status).toBe("rejected");
    });

    it("marks an accepted suggestion as executed", () => {
      acceptSuggestion(suggestionId, USER_ID);
      const executed = markSuggestionExecuted(suggestionId, USER_ID);
      expect(executed).toBe(true);

      const s = getSuggestion(suggestionId);
      expect(s!.status).toBe("executed");
    });

    it("rejects double-accept", () => {
      acceptSuggestion(suggestionId, USER_ID);
      const second = acceptSuggestion(suggestionId, USER_ID);
      expect(second).toBe(false);
    });

    it("expires old suggestions", () => {
      const s = getSuggestion(suggestionId);
      if (s) {
        // Manually set expiry to past
        (s as any).expiresAt = Date.now() - 1000;
      }
      const expired = getSuggestion(suggestionId);
      if (expired) {
        expect(expired.status).toBe("expired");
      } else {
        expect(expired).toBeNull();
      }
    });

    it("lists pending suggestions", () => {
      const pending = getPendingSuggestions(AGENT_ID);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.every((s) => s.status === "pending" || s.status === "accepted")).toBe(true);
    });
  });

  // ==========================================
  // validateAction
  // ==========================================
  describe("validateAction", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("allows tip without approval (default config)", () => {
      // Tip action type has requiresApproval = false by default
      const result = validateAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: parseEther("1"),
        amountFormatted: "1",
        description: "Test tip",
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      // Tips don't require approval, so autoApproved is false (no approval needed)
      expect(result.autoApproved).toBe(false);
    });

    it("requires approval for large purchases", () => {
      const result = validateAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: parseEther("50"),
        amountFormatted: "50",
        description: "Large purchase",
      });

      expect(result.allowed).toBe(false);
      expect(result.requiresApproval).toBe(true);
      expect(result.approvalRequest).toBeDefined();
    });

    it("auto-approves purchase below autonomy threshold", () => {
      // Purchase requires approval, but is below autonomy threshold
      setAutonomyThreshold(AGENT_ID, USER_ID, parseEther("10"));
      const result = validateAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: parseEther("5"),
        amountFormatted: "5",
        description: "Small purchase",
      });

      expect(result.allowed).toBe(true);
      expect(result.requiresApproval).toBe(false);
      expect(result.autoApproved).toBe(true);
    });

    it("blocks action exceeding per-action limit", () => {
      // Purchase per-action limit is 100 cUSD
      const result = validateAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: parseEther("200"),
        amountFormatted: "200",
        description: "Too large",
      });

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("per-action limit");
    });
  });

  describe("suggestAction", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("auto-executes sub-threshold actions", () => {
      const result = suggestAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Test",
      });

      expect(result.autoExecuted).toBe(true);
      expect(result.suggestion.status).toBe("accepted");
    });

    it("returns pending suggestion for above-threshold actions", () => {
      const result = suggestAction({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "50",
        description: "Large purchase",
      });

      expect(result.autoExecuted).toBe(false);
      expect(result.suggestion.status).toBe("pending");
    });
  });

  // ==========================================
  // Style Memory
  // ==========================================
  describe("style preferences", () => {
    const STYLE_USER = "style-test-user";

    it("returns default preferences for new user", () => {
      const prefs = getStylePreferences(STYLE_USER);
      expect(prefs.colors).toEqual([]);
      expect(prefs.categories).toEqual([]);
      expect(prefs.brands).toEqual([]);
      expect(prefs.priceRange).toEqual({ min: 0, max: 500 });
    });

    it("updates categories", () => {
      updateStylePreferences(STYLE_USER, {
        categories: ["shirts", "pants"],
      });
      const prefs = getStylePreferences(STYLE_USER);
      expect(prefs.categories).toContain("shirts");
      expect(prefs.categories).toContain("pants");
    });

    it("merges new categories with existing", () => {
      updateStylePreferences(STYLE_USER, { categories: ["shirts"] });
      updateStylePreferences(STYLE_USER, { categories: ["pants"] });
      const prefs = getStylePreferences(STYLE_USER);
      expect(prefs.categories).toContain("shirts");
      expect(prefs.categories).toContain("pants");
    });

    it("sets auto-buy max price", () => {
      updateStylePreferences(STYLE_USER, { autoBuyMaxPrice: 25 });
      const prefs = getStylePreferences(STYLE_USER);
      expect(prefs.autoBuyMaxPrice).toBe(25);
    });

    it("disables auto-buy with zero price", () => {
      updateStylePreferences(STYLE_USER, { autoBuyMaxPrice: 0 });
      const prefs = getStylePreferences(STYLE_USER);
      expect(prefs.autoBuyMaxPrice).toBe(0);
    });

    it("updates lastUpdated on change", () => {
      const before = getStylePreferences(STYLE_USER);
      const beforeTime = before.lastUpdated;
      updateStylePreferences(STYLE_USER, { categories: ["shoes"] });
      const after = getStylePreferences(STYLE_USER);
      expect(after.lastUpdated).toBeGreaterThanOrEqual(beforeTime);
    });
  });

  describe("trackStyleInteraction", () => {
    const INTERACT_USER = "interact-test-user";

    it("records product interaction as preference", () => {
      trackStyleInteraction(INTERACT_USER, { category: "accessories", price: 75 });
      const prefs = getStylePreferences(INTERACT_USER);
      expect(prefs.categories).toContain("accessories");
      expect(prefs.priceRange.max).toBeGreaterThanOrEqual(112); // 75 * 1.5
    });
  });

  // ==========================================
  // Approval Requests
  // ==========================================
  describe("approval requests", () => {
    it("creates a pending approval request", () => {
      const request = createApprovalRequest({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "100",
        description: "Approve purchase",
      });

      expect(request.status).toBe("pending");
      expect(request.actionType).toBe("purchase");
    });

    it("approves a pending request", () => {
      const request = createApprovalRequest({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "100",
        description: "Approve purchase",
      });

      const approved = approveRequest(request.id, USER_ID);
      expect(approved).toBe(true);
      expect(getApprovalRequest(request.id)!.status).toBe("approved");
    });

    it("rejects a pending request", () => {
      const request = createApprovalRequest({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "purchase",
        amount: "100",
        description: "Reject purchase",
      });

      const rejected = rejectRequest(request.id, USER_ID);
      expect(rejected).toBe(true);
      expect(getApprovalRequest(request.id)!.status).toBe("rejected");
    });

    it("lists pending approvals", () => {
      createApprovalRequest({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "50",
        description: "Pending approval",
      });

      const pending = getPendingApprovals(AGENT_ID);
      expect(pending.length).toBeGreaterThanOrEqual(1);
      expect(pending.every((r) => r.status === "pending")).toBe(true);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================
  describe("edge cases", () => {
    beforeEach(() => {
      initializeAgentLimits(AGENT_ID, USER_ID);
    });

    it("handles zero amount gracefully", () => {
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", 0n);
      expect(result.allowed).toBe(true);
    });

    it("handles very large amounts", () => {
      const hugeAmount = parseEther("1000000");
      const result = checkSpendingLimit(AGENT_ID, USER_ID, "tip", hugeAmount);
      expect(result.allowed).toBe(false);
    });

    it("accepts suggestion with custom expiration", () => {
      const suggestion = createSuggestion({
        agentId: AGENT_ID,
        userId: USER_ID,
        actionType: "tip",
        amount: "1",
        description: "Short-lived",
        expiresInMinutes: 1,
      });

      expect(suggestion.expiresAt - suggestion.createdAt).toBe(60 * 1000);
    });

    it("handles non-existent suggestion gracefully", () => {
      const s = getSuggestion("nonexistent-id");
      expect(s).toBeNull();
    });

    it("handles non-existent approval gracefully", () => {
      const r = getApprovalRequest("nonexistent-id");
      expect(r).toBeNull();
    });
  });
});
