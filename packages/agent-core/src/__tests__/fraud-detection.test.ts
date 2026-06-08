/**
 * Unit Tests — Fraud Detection
 *
 * Tests Dead Man's Switch heartbeat, anomaly detection,
 * agent freezing, multi-signature requirements, and alert management.
 *
 * All Redis dependencies are mocked — these tests validate
 * business logic only.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock redis-helpers ──
const mockRedisStore = new Map<string, unknown>();

vi.mock("../redis-helpers", () => ({
  redisGet: vi.fn(async (key: string) => {
    return mockRedisStore.get(key) ?? null;
  }),
  redisSetEx: vi.fn(
    async (key: string, value: unknown, _ttl: number) => {
      mockRedisStore.set(key, value);
    },
  ),
  redisSet: vi.fn(async (key: string, value: unknown) => {
    mockRedisStore.set(key, value);
  }),
  redisDel: vi.fn(async (key: string) => {
    mockRedisStore.delete(key);
  }),
  isRedisConfigured: vi.fn(() => true),
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

// Must import AFTER mocks
const {
  recordHeartbeat,
  checkAgentHealth,
  analyzeTransactionPattern,
  updateAnomalyScore,
  freezeAgent,
  unfreezeAgent,
  isAgentFrozen,
  requiresMultiSig,
  createMultiSigRequirement,
  addMultiSigSignature,
  getMultiSigRequirement,
  createAlert,
  getAlert,
  resolveAlert,
} = await import("../fraud-detection");

const AGENT_ID = "test-agent-1";
const USER_ID = "test-user-1";

describe("Fraud Detection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedisStore.clear();
  });

  // ==========================================
  // Heartbeat / Dead Man's Switch
  // ==========================================
  describe("recordHeartbeat", () => {
    it("records a healthy heartbeat for a new agent", async () => {
      const health = await recordHeartbeat(AGENT_ID, USER_ID);
      expect(health.agentId).toBe(AGENT_ID);
      expect(health.userId).toBe(USER_ID);
      expect(health.status).toBe("healthy");
      expect(health.consecutiveFailures).toBe(0);
      expect(health.anomalyScore).toBe(0);
      expect(health.lastHeartbeat).toBeGreaterThan(0);
    });

    it("resets consecutive failures on heartbeat", async () => {
      // Simulate a failing state
      const initialHealth = await recordHeartbeat(AGENT_ID, USER_ID);
      initialHealth.consecutiveFailures = 3;
      initialHealth.status = "warning";

      // Record heartbeat should reset
      const health = await recordHeartbeat(AGENT_ID, USER_ID);
      expect(health.consecutiveFailures).toBe(0);
      expect(health.status).toBe("healthy");
    });
  });

  describe("checkAgentHealth", () => {
    it("returns healthy for just-recorded heartbeat", async () => {
      await recordHeartbeat(AGENT_ID, USER_ID);
      const health = await checkAgentHealth(AGENT_ID, USER_ID);
      expect(health.status).toBe("healthy");
    });

    it("returns warning when heartbeat is missing for >15 min", async () => {
      // Record heartbeat with old timestamp
      const health = await recordHeartbeat(AGENT_ID, USER_ID);
      health.lastHeartbeat = Date.now() - 16 * 60 * 1000; // 16 min ago
      health.consecutiveFailures = 0;

      const result = await checkAgentHealth(AGENT_ID, USER_ID);
      expect(result.status).toBe("warning");
      expect(result.consecutiveFailures).toBe(1);
    });

    it("freezes agent after 3 consecutive missed heartbeats", async () => {
      // Simulate 3 failed health checks
      const health = await recordHeartbeat(AGENT_ID, USER_ID);

      for (let i = 0; i < 3; i++) {
        health.lastHeartbeat = Date.now() - 16 * 60 * 1000;
        health.consecutiveFailures = i;
        await checkAgentHealth(AGENT_ID, USER_ID);
      }

      // The 4th check should freeze
      health.lastHeartbeat = Date.now() - 16 * 60 * 1000;
      health.consecutiveFailures = 3;
      const result = await checkAgentHealth(AGENT_ID, USER_ID);
      expect(result.status).toBe("frozen");

      // Verify freeze was persisted
      const frozen = await isAgentFrozen(AGENT_ID, USER_ID);
      expect(frozen.frozen).toBe(true);
    });
  });

  // ==========================================
  // Anomaly Detection
  // ==========================================
  describe("analyzeTransactionPattern", () => {
    it("returns clean score for first transaction", async () => {
      const result = await analyzeTransactionPattern(
        USER_ID,
        AGENT_ID,
        BigInt("1000000000000000000"), // 1 token
        "0xrecipient",
      );
      expect(result.anomalyScore).toBe(0);
      expect(result.flags).toEqual([]);
    });

    it("flags high velocity transactions", async () => {
      // Simulate 20+ transactions in an hour
      const now = Date.now();

      // We can't easily simulate time, but we can check the pattern logic
      // by directly testing the threshold check
      for (let i = 0; i < 25; i++) {
        const result = await analyzeTransactionPattern(
          USER_ID,
          AGENT_ID,
          BigInt("1000000000000000000"),
          `0xrecipient${i}`,
        );
        if (i >= 20) {
          // High velocity should be flagged
          expect(result.flags).toContain("high_velocity");
          break; // Found it
        }
      }
    });

    it("flags unusual amounts deviating from average", async () => {
      // Build up a pattern with small transactions
      for (let i = 0; i < 5; i++) {
        await analyzeTransactionPattern(
          USER_ID,
          AGENT_ID,
          BigInt("1000000000000000000"), // 1 token
          "0xrecipient",
        );
      }

      // Now send a much larger transaction
      const result = await analyzeTransactionPattern(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"), // 500 tokens (50x average)
        "0xrecipient",
      );

      expect(result.flags.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("updateAnomalyScore", () => {
    it("accumulates anomaly score", async () => {
      await recordHeartbeat(AGENT_ID, USER_ID);

      const health1 = await updateAnomalyScore(AGENT_ID, USER_ID, 20);
      expect(health1.anomalyScore).toBe(20);

      const health2 = await updateAnomalyScore(AGENT_ID, USER_ID, 30);
      expect(health2.anomalyScore).toBe(50);
    });

    it("clamps score to 0-100 range", async () => {
      await recordHeartbeat(AGENT_ID, USER_ID);

      const health1 = await updateAnomalyScore(AGENT_ID, USER_ID, -50);
      expect(health1.anomalyScore).toBe(0);

      const health2 = await updateAnomalyScore(AGENT_ID, USER_ID, 200);
      expect(health2.anomalyScore).toBe(100);
    });

    it("freezes agent when score exceeds 75", async () => {
      await recordHeartbeat(AGENT_ID, USER_ID);
      await updateAnomalyScore(AGENT_ID, USER_ID, 80);

      const frozen = await isAgentFrozen(AGENT_ID, USER_ID);
      expect(frozen.frozen).toBe(true);
    });
  });

  // ==========================================
  // Freeze / Unfreeze
  // ==========================================
  describe("freezeAgent / unfreezeAgent", () => {
    it("freezes an agent with a reason", async () => {
      await freezeAgent(AGENT_ID, USER_ID, "Test freeze");
      const frozen = await isAgentFrozen(AGENT_ID, USER_ID);
      expect(frozen.frozen).toBe(true);
      expect(frozen.reason).toBe("Test freeze");
    });

    it("unfreezes an agent and resets health", async () => {
      await freezeAgent(AGENT_ID, USER_ID, "Test freeze");
      expect((await isAgentFrozen(AGENT_ID, USER_ID)).frozen).toBe(true);

      await unfreezeAgent(AGENT_ID, USER_ID);
      expect((await isAgentFrozen(AGENT_ID, USER_ID)).frozen).toBe(false);
    });

    it("reports not frozen for unknown agent", async () => {
      const result = await isAgentFrozen("unknown-agent", "unknown-user");
      expect(result.frozen).toBe(false);
    });
  });

  // ==========================================
  // Multi-Signature
  // ==========================================
  describe("requiresMultiSig", () => {
    it("requires multi-sig for $500+ transactions", () => {
      expect(requiresMultiSig(BigInt("500000000000000000000"))).toBe(true); // $500
    });

    it("does not require multi-sig for sub-$500 transactions", () => {
      expect(requiresMultiSig(BigInt("100000000000000000000"))).toBe(false); // $100
    });
  });

  describe("createMultiSigRequirement / addMultiSigSignature", () => {
    it("creates a pending multi-sig requirement", async () => {
      const req = await createMultiSigRequirement(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"),
        "0xrecipient",
        "Large transfer",
      );

      expect(req.transactionId).toMatch(/^multisig_/);
      expect(req.status).toBe("pending");
      expect(req.requiredSignatures).toBe(2);
      expect(req.signatures).toEqual([]);
    });

    it("adds signatures and approves when threshold met", async () => {
      const req = await createMultiSigRequirement(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"),
        "0xrecipient",
        "Large transfer",
      );

      const req1 = await addMultiSigSignature(
        req.transactionId,
        "0xsigner1",
        "sig1",
      );
      expect(req1!.signatures.length).toBe(1);
      expect(req1!.status).toBe("pending");

      const req2 = await addMultiSigSignature(
        req.transactionId,
        "0xsigner2",
        "sig2",
      );
      expect(req2!.signatures.length).toBe(2);
      expect(req2!.status).toBe("approved");
    });

    it("prevents duplicate signatures", async () => {
      const req = await createMultiSigRequirement(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"),
        "0xrecipient",
        "Large transfer",
      );

      await addMultiSigSignature(
        req.transactionId,
        "0xsigner1",
        "sig1",
      );

      // Same signer tries again
      const req2 = await addMultiSigSignature(
        req.transactionId,
        "0xsigner1",
        "sig2",
      );
      expect(req2!.signatures.length).toBe(1);
    });

    it("returns null for unknown transaction", async () => {
      const req = await getMultiSigRequirement("nonexistent");
      expect(req).toBeNull();
    });
  });

  // ==========================================
  // Alert Management
  // ==========================================
  describe("alerts", () => {
    it("creates a fraud alert", async () => {
      const alert = await createAlert({
        userId: USER_ID,
        agentId: AGENT_ID,
        type: "heartbeat",
        severity: "critical",
        description: "Agent missed heartbeat",
      });

      expect(alert.id).toMatch(/^alert_/);
      expect(alert.type).toBe("heartbeat");
      expect(alert.severity).toBe("critical");
      expect(alert.resolved).toBe(false);
    });

    it("retrieves an alert by ID", async () => {
      const alert = await createAlert({
        userId: USER_ID,
        agentId: AGENT_ID,
        type: "velocity",
        severity: "high",
        description: "High velocity detected",
      });

      const found = await getAlert(alert.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(alert.id);
      expect(found!.description).toBe("High velocity detected");
    });

    it("resolves an alert", async () => {
      const alert = await createAlert({
        userId: USER_ID,
        agentId: AGENT_ID,
        type: "pattern",
        severity: "medium",
        description: "Suspicious pattern",
      });

      const resolved = await resolveAlert(alert.id);
      expect(resolved!.resolved).toBe(true);

      const found = await getAlert(alert.id);
      expect(found!.resolved).toBe(true);
    });

    it("returns null for non-existent alert", async () => {
      const alert = await getAlert("nonexistent-alert-id");
      expect(alert).toBeNull();
    });

    it("appends metadata when provided", async () => {
      const alert = await createAlert({
        userId: USER_ID,
        agentId: AGENT_ID,
        type: "multisig_required",
        severity: "high",
        description: "Multi-sig needed",
        metadata: { transactionId: "tx_123" },
      });

      expect(alert.metadata?.transactionId).toBe("tx_123");
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================
  describe("edge cases", () => {
    it("handles agent with no prior heartbeat", async () => {
      const health = await checkAgentHealth("new-agent", "new-user");
      expect(health.status).toBe("healthy");
      expect(health.consecutiveFailures).toBe(0);
    });

    it("handles zero-value transactions", async () => {
      const result = await analyzeTransactionPattern(
        USER_ID,
        AGENT_ID,
        0n,
        "0xrecipient",
      );
      expect(result.anomalyScore).toBe(0);
      expect(result.flags).toEqual([]);
    });

    it("requires 2 signatures by default for multi-sig", async () => {
      const req = await createMultiSigRequirement(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"),
        "0xrecipient",
        "Default multi-sig",
      );
      expect(req.requiredSignatures).toBe(2);
    });

    it("multi-sig expires after 1 hour", async () => {
      const req = await createMultiSigRequirement(
        USER_ID,
        AGENT_ID,
        BigInt("500000000000000000000"),
        "0xrecipient",
        "Expiring multi-sig",
      );
      const oneHourFromNow = req.createdAt + 60 * 60 * 1000;
      expect(req.expiresAt).toBe(oneHourFromNow);
    });
  });
});
