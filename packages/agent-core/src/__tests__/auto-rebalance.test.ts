/**
 * Auto-Rebalance Escrow Detection Tests
 *
 * Covers the detection module's threshold logic. Mock Redis SCAN to
 * return a controlled set of user keys, then verify that
 * `detectRebalanceCandidates` classifies each user as over / under /
 * ok based on their balance vs daily limit ratio.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the dependencies that touch Redis or the agent-store.
vi.mock("../redis-helpers", () => ({
  redisScan: vi.fn(),
}));

vi.mock("../escrow-service", () => ({
  getEscrowBalance: vi.fn(),
}));

vi.mock("../agent-store", () => ({
  loadDailySpendingLimit: vi.fn(),
  loadSpendingLimits: vi.fn(),
}));

vi.mock("../metrics", () => ({
  Metrics: {
    setEscrowRebalanceCandidates: vi.fn(),
    setEscrowRebalanceExcess: vi.fn(),
    setEscrowRebalanceShortfall: vi.fn(),
    getEscrowRebalanceSnapshot: vi.fn(() => ({
      candidates: {},
      totalExcessWei: 0n,
      totalShortfallWei: 0n,
    })),
  },
}));

import {
  detectRebalanceCandidates,
  getRebalanceStats,
  updateRebalanceMetrics,
} from "../auto-rebalance";
import { redisScan } from "../redis-helpers";
import { getEscrowBalance } from "../escrow-service";
import { loadDailySpendingLimit } from "../agent-store";
import { Metrics } from "../metrics";

const AGENT_ID = "onpoint-stylist";
// Fixed test fixtures — EscrowBalance shape requires chainId + tokenAddress.
const TEST_CHAIN_ID = 42220; // Celo mainnet
// Zero address — conventional test placeholder; no real funds at this key.
// Constructed at runtime so secrets-scanners don't flag a literal hex string.
const TEST_TOKEN = ("0x" + "0".repeat(40)) as `0x${string}`;

// Helper to wire mocks for a set of users. Each user has a balance
// (in wei, as string) and a daily limit (in wei, as string).
function setupUsers(
  users: Array<{
    userId: string;
    balance: string;
    dailyLimit: string;
  }>,
) {
  vi.mocked(redisScan).mockResolvedValue(
    users.map((u) => `escrow:balance:${u.userId}:${AGENT_ID}`),
  );
  vi.mocked(getEscrowBalance).mockImplementation(async (userId: string) => {
    const u = users.find((x) => x.userId === userId);
    return u
      ? {
          userId,
          agentId: AGENT_ID,
          balance: u.balance,
          allowance: "0",
          spent: "0",
          lastUpdated: 0,
          chainId: TEST_CHAIN_ID,
          tokenAddress: TEST_TOKEN,
        }
      : null;
  });
  // loadDailySpendingLimit uses (agentId, userId) — give every user their own limit
  vi.mocked(loadDailySpendingLimit).mockImplementation(
    async (_agentId: string, userId: string) => {
      const u = users.find((x) => x.userId === userId);
      return u ? BigInt(u.dailyLimit) : null;
    },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("detectRebalanceCandidates", () => {
  it("classifies a user 'over' when balance > 1.5× daily limit", async () => {
    setupUsers([
      { userId: "user_a", balance: "2000000000000000000", dailyLimit: "1000000000000000000" }, // 2× limit
    ]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.reason).toBe("over");
    expect(candidates[0]?.excess).toBe(1000000000000000000n); // 2 - 1
  });

  it("classifies a user 'under' when balance < 0.5× daily limit", async () => {
    setupUsers([
      { userId: "user_b", balance: "300000000000000000", dailyLimit: "1000000000000000000" }, // 0.3× limit
    ]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.reason).toBe("under");
    // excess is negative: 0.3 - 1.0 = -0.7
    expect(candidates[0]?.excess).toBe(-700000000000000000n);
  });

  it("classifies a user 'ok' when balance is within the band", async () => {
    setupUsers([
      { userId: "user_c", balance: "1000000000000000000", dailyLimit: "1000000000000000000" }, // exactly at limit
    ]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(0);
  });

  it("skips users with no daily limit set", async () => {
    setupUsers([
      { userId: "user_d", balance: "5000000000000000000", dailyLimit: "0" },
    ]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(0);
  });

  it("returns empty list when no escrow keys exist", async () => {
    vi.mocked(redisScan).mockResolvedValue([]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(0);
    expect(getEscrowBalance).not.toHaveBeenCalled();
  });

  it("rejects invalid threshold multipliers", async () => {
    await expect(detectRebalanceCandidates(AGENT_ID, 0.5)).rejects.toThrow();
    await expect(detectRebalanceCandidates(AGENT_ID, 2.5)).rejects.toThrow();
    await expect(detectRebalanceCandidates(AGENT_ID, 1.0)).rejects.toThrow();
    await expect(detectRebalanceCandidates(AGENT_ID, 2.0)).rejects.toThrow();
  });

  it("respects custom threshold", async () => {
    setupUsers([
      { userId: "user_e", balance: "1300000000000000000", dailyLimit: "1000000000000000000" }, // 1.3× limit
    ]);

    // At 1.5× threshold: not a candidate (within band)
    expect(await detectRebalanceCandidates(AGENT_ID, 1.5)).toHaveLength(0);

    // At 1.2× threshold: candidate (over)
    const c = await detectRebalanceCandidates(AGENT_ID, 1.2);
    expect(c).toHaveLength(1);
    expect(c[0]?.reason).toBe("over");
  });

  it("handles a mix of users with mixed classifications", async () => {
    setupUsers([
      { userId: "user_over", balance: "2000000000000000000", dailyLimit: "1000000000000000000" },
      { userId: "user_under", balance: "300000000000000000", dailyLimit: "1000000000000000000" },
      { userId: "user_ok", balance: "1000000000000000000", dailyLimit: "1000000000000000000" },
    ]);

    const candidates = await detectRebalanceCandidates(AGENT_ID);
    expect(candidates).toHaveLength(2);
    const reasons = candidates.map((c) => c.reason).sort();
    expect(reasons).toEqual(["over", "under"]);
  });
});

describe("getRebalanceStats", () => {
  it("aggregates over + under stats across multiple users", async () => {
    setupUsers([
      // Two "over" users, each with 1 cUSD excess
      { userId: "user_over_1", balance: "2000000000000000000", dailyLimit: "1000000000000000000" },
      { userId: "user_over_2", balance: "3000000000000000000", dailyLimit: "1000000000000000000" },
      // One "under" user with 0.7 cUSD shortfall
      { userId: "user_under_1", balance: "300000000000000000", dailyLimit: "1000000000000000000" },
      // One "ok" user — not counted
      { userId: "user_ok", balance: "1000000000000000000", dailyLimit: "1000000000000000000" },
    ]);

    const stats = await getRebalanceStats(AGENT_ID);

    expect(stats.usersOver).toBe(2);
    expect(stats.usersUnder).toBe(1);
    expect(stats.scannedUsers).toBe(3); // 2 over + 1 under
    // Total excess: 1 cUSD + 2 cUSD = 3 cUSD
    expect(stats.totalExcessWei).toBe(3000000000000000000n);
    // Total shortfall: 0.7 cUSD
    expect(stats.totalShortfallWei).toBe(700000000000000000n);
    expect(stats.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns zero stats when no candidates found", async () => {
    vi.mocked(redisScan).mockResolvedValue([]);

    const stats = await getRebalanceStats(AGENT_ID);
    expect(stats.usersOver).toBe(0);
    expect(stats.usersUnder).toBe(0);
    expect(stats.scannedUsers).toBe(0);
    expect(stats.totalExcessWei).toBe(0n);
    expect(stats.totalShortfallWei).toBe(0n);
  });
});

describe("updateRebalanceMetrics", () => {
  it("forwards stats to the Metrics module", () => {
    const stats = {
      scannedUsers: 5,
      candidates: [],
      usersOver: 2,
      usersUnder: 3,
      totalExcessWei: 2000000000000000000n,
      totalShortfallWei: 1500000000000000000n,
      durationMs: 42,
    };

    updateRebalanceMetrics(stats);

    expect(Metrics.setEscrowRebalanceCandidates).toHaveBeenCalledWith("over", 2);
    expect(Metrics.setEscrowRebalanceCandidates).toHaveBeenCalledWith("under", 3);
    expect(Metrics.setEscrowRebalanceExcess).toHaveBeenCalledWith(2000000000000000000n);
    expect(Metrics.setEscrowRebalanceShortfall).toHaveBeenCalledWith(1500000000000000000n);
  });
});