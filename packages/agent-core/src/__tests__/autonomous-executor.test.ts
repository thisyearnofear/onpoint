/**
 * Autonomous Executor Tests
 *
 * Covers the on-chain execution path for agent actions: mint, purchase,
 * tip. These actions are taken below the user's autonomy threshold (or
 * with explicit user approval) and signed remotely by `onpoint-signer`.
 *
 * Strategy:
 *   - Mock `../signer-client` so signer responses are controllable.
 *   - Mock `../agent-wallet` so we don't load the real wallet service
 *     (which has dynamic require()s for native WDK modules).
 *   - Mock `../agent-registry` so we don't touch Redis/persistent state.
 *   - Use the real Metrics module and inspect counters via
 *     `Metrics.getActionCounters()` after each test.
 *   - Mock `../agent-store` so the failure path's `markSuggestionFailed`
 *     doesn't touch storage.
 *
 * Covered paths:
 *   1. Happy path: tip succeeds via signer.
 *   2. Happy path: mint succeeds with tokenId returned.
 *   3. Transient retry: signer fails once with a retryable error, then succeeds.
 *   4. Exhausted retries: signer fails 3x → permanent failure.
 *   5. Non-retryable error: signer fails once with a non-retryable message.
 *   6. No signing method: both signer client and AGENT_PRIVATE_KEY absent.
 *   7. external_search: returns loud error (never silently succeeds).
 *   8. Unknown action: returns "not yet implemented".
 */

import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";

// Mock signer-client BEFORE importing the executor so the singleton is
// replaced. We replace getSignerClient() entirely so we can control what
// each call returns.
vi.mock("../signer-client", () => {
  const signMint = vi.fn();
  const signTransfer = vi.fn();
  return {
    getSignerClient: vi.fn(() => ({
      signMint,
      signTransfer,
    })),
    __mockSignMint: signMint,
    __mockSignTransfer: signTransfer,
  };
});

// Mock agent-wallet so we don't load WDK native modules.
vi.mock("../agent-wallet", () => ({
  getAgentWallet: vi.fn(async () => ({
    getAddresses: vi.fn(async () => ({
      celo: "0xAGENT0000000000000000000000000000000000a1",
    })),
  })),
}));

// Mock agent-registry so we don't touch persistent storage.
vi.mock("../agent-registry", () => ({
  recordReceipt: vi.fn(async () => undefined),
}));

// Mock agent-store so markSuggestionFailed in the retry-exhausted path
// is a no-op (it would otherwise try to load+persist a suggestion).
vi.mock("../agent-store", () => ({
  loadSuggestion: vi.fn(async () => null),
  persistSuggestion: vi.fn(async () => undefined),
}));

import { executeSuggestion } from "../autonomous-executor";
import { Metrics } from "../metrics";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const signerMock = (await import("../signer-client")) as unknown as {
  __mockSignMint: Mock;
  __mockSignTransfer: Mock;
};

// ── Test helpers ───────────────────────────────────────────────────

const BASE_PARAMS = {
  agentId: "onpoint-stylist",
  userId: "user_test_001",
  userAddress: "0xUSER00000000000000000000000000000000abc",
  suggestionId: "sug_test_001",
  description: "Test action",
  metadata: {},
};

const TRANSFER_SUCCESS = {
  success: true as const,
  txHash: "0xdeadbeef00000000000000000000000000000000000000000000000000000001",
  explorerUrl: "https://celoscan.io/tx/0xdeadbeef01",
};

const MINT_SUCCESS = {
  success: true as const,
  txHash: "0xcafebabe00000000000000000000000000000000000000000000000000000002",
  tokenId: "42",
  explorerUrl: "https://celoscan.io/tx/0xcafebabe02",
};

const SIGNER_ERROR = (msg: string) => ({
  success: false as const,
  error: msg,
  code: "SIGNER_ERROR",
});

function getCounter(type: string, status: string): number {
  return Metrics.getActionCounters().find(
    (c) => c.type === type && c.status === status,
  )?.count ?? 0;
}

beforeEach(() => {
  signerMock.__mockSignMint.mockReset();
  signerMock.__mockSignTransfer.mockReset();
  Metrics.resetMetrics();
  // Ensure signer-client returns a client (env vars don't matter because
  // we mocked getSignerClient itself).
  vi.stubEnv("AGENT_PRIVATE_KEY", "");
});

// ── Tests ──────────────────────────────────────────────────────────

describe("executeSuggestion — tip", () => {
  it("happy path: signer returns success → receipt + succeeded counter", async () => {
    signerMock.__mockSignTransfer.mockResolvedValueOnce(TRANSFER_SUCCESS);

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "tip",
      amount: "0.5",
    });

    expect(result.success).toBe(true);
    expect(result.txHash).toBe(TRANSFER_SUCCESS.txHash);
    expect(result.action).toBe("tip");
    expect(result.autoApproved).toBe(true);
    expect(signerMock.__mockSignTransfer).toHaveBeenCalledTimes(1);
    expect(getCounter("tip", "succeeded")).toBe(1);
  });

  it("transient retry: signer fails once with 'nonce' error, then succeeds", async () => {
    signerMock.__mockSignTransfer
      .mockRejectedValueOnce(new Error("nonce too low"))
      .mockResolvedValueOnce(TRANSFER_SUCCESS);

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "tip",
      amount: "0.25",
    });

    expect(result.success).toBe(true);
    expect(signerMock.__mockSignTransfer).toHaveBeenCalledTimes(2);
    expect(getCounter("tip", "succeeded")).toBe(1);
  });

  it("exhausted retries: 3x failure with retryable error → permanent failure", async () => {
    signerMock.__mockSignTransfer.mockRejectedValue(
      new Error("gas estimation failed"),
    );

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "tip",
      amount: "0.1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("gas estimation failed");
    expect(signerMock.__mockSignTransfer).toHaveBeenCalledTimes(3);
    // No success counter, but markSuggestionFailed was attempted
    // (mocked to no-op).
    expect(getCounter("tip", "succeeded")).toBe(0);
  });

  it("non-retryable error: one failure → immediate return (no retry)", async () => {
    // 'agent frozen' is not in the retryable list (nonce/timeout/gas/etc.)
    signerMock.__mockSignTransfer.mockRejectedValue(
      new Error("agent is frozen"),
    );

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "tip",
      amount: "0.1",
    });

    expect(result.success).toBe(false);
    expect(signerMock.__mockSignTransfer).toHaveBeenCalledTimes(1);
  });
});

describe("executeSuggestion — mint", () => {
  it("happy path: returns tokenId and explorerUrl", async () => {
    signerMock.__mockSignMint.mockResolvedValueOnce(MINT_SUCCESS);

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "mint",
      amount: "0",
      description: "Mint proof-of-style NFT",
    });

    expect(result.success).toBe(true);
    expect(result.tokenId).toBe("42");
    expect(result.explorerUrl).toBe(MINT_SUCCESS.explorerUrl);
    expect(signerMock.__mockSignMint).toHaveBeenCalledTimes(1);
    expect(getCounter("mint", "succeeded")).toBe(1);

    // Verify the signMint payload includes the expected recipients
    // (85% user, 15% platform).
    const call = signerMock.__mockSignMint.mock.calls[0]?.[0];
    expect(call?.recipients).toEqual([
      { address: BASE_PARAMS.userAddress, percentAllocation: 85 },
      { address: expect.stringMatching(/^0x/), percentAllocation: 15 },
    ]);
  });
});

describe("executeSuggestion — purchase", () => {
  it("happy path: routes to signTransfer", async () => {
    signerMock.__mockSignTransfer.mockResolvedValueOnce(TRANSFER_SUCCESS);

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "purchase",
      amount: "1.5",
      recipient: "0xMERCHANT0000000000000000000000000000000bee",
    });

    expect(result.success).toBe(true);
    expect(signerMock.__mockSignTransfer).toHaveBeenCalledTimes(1);
    expect(getCounter("purchase", "succeeded")).toBe(1);
  });
});

describe("executeSuggestion — configuration guards", () => {
  it("returns 'no signing method' when signer is unavailable and no private key", async () => {
    // Re-mock getSignerClient to return null for this case.
    const signerModule = await import("../signer-client");
    (signerModule.getSignerClient as Mock).mockReturnValueOnce(null);

    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "tip",
      amount: "0.1",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/No signing method available/);
    expect(signerMock.__mockSignTransfer).not.toHaveBeenCalled();
  });
});

describe("executeSuggestion — routing guards", () => {
  it("external_search returns a loud routing error (not a silent success)", async () => {
    // Regression guard: a previous version of this code returned
    // success: true for external_search, which silently inflated the
    // success metrics and hid routing mistakes. Call sites must filter
    // external_search out before calling executeSuggestion.
    const result = await executeSuggestion({
      ...BASE_PARAMS,
      actionType: "external_search",
      amount: "0",
      description: "Web search",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/external_search is not executed by the autonomous executor/);
    expect(result.error).toMatch(/tasks\/execute/);
    expect(signerMock.__mockSignTransfer).not.toHaveBeenCalled();
    expect(signerMock.__mockSignMint).not.toHaveBeenCalled();
  });

  it("unknown action type returns 'not yet implemented'", async () => {
    const result = await executeSuggestion({
      ...BASE_PARAMS,
      // Cast to bypass the ActionType union — we're testing the defensive
      // default branch.
      actionType: "future_action" as unknown as "tip",
      amount: "0",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not yet implemented/);
    expect(result.error).toContain("future_action");
  });
});

describe("executeSuggestion — retry classification", () => {
  // Exhaustively verify the retryable error classifier in withRetry().
  // Each entry: [errorMessage, shouldRetry]
  const cases: Array<[string, boolean]> = [
    ["nonce too low", true],
    ["replacement transaction underpriced", true],
    ["tx already processing", true],
    ["gas estimation failed", true],
    ["rate limit exceeded", true],
    ["503 service unavailable", true],
    ["429 too many requests", true],
    ["ECONNREFUSED 127.0.0.1:443", true],
    ["ECONNRESET", true],
    ["network timeout", true],
    ["agent is frozen", false], // not in retryable list
    ["insufficient balance for amount", false],
  ];

  for (const [msg, shouldRetry] of cases) {
    it(`error "${msg}" → ${shouldRetry ? "retried" : "not retried"}`, async () => {
      signerMock.__mockSignTransfer.mockRejectedValue(new Error(msg));

      await executeSuggestion({
        ...BASE_PARAMS,
        actionType: "tip",
        amount: "0.1",
      });

      const calls = signerMock.__mockSignTransfer.mock.calls.length;
      if (shouldRetry) {
        // Retried up to MAX_RETRIES (3) — first failure, then up to 2 more.
        expect(calls).toBeGreaterThanOrEqual(2);
        expect(calls).toBeLessThanOrEqual(3);
      } else {
        expect(calls).toBe(1);
      }
    });
  }
});