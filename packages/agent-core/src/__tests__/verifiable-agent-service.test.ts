/**
 * Unit Tests — Verifiable Agent Service (TEE attestation wiring)
 *
 * Verifies the receipt envelope accepts and signs a TEE proof from
 * a verifiable compute provider (currently 0G Compute) without
 * breaking the existing agent-signer signature flow.
 *
 * The IPFS upload and the wallet signing layer are mocked — these
 * tests validate the receipt shape and TEE-handling logic only.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── Mock IPFS upload (avoid hitting Lighthouse in tests) ──
vi.mock("@repo/ipfs-client", () => ({
  uploadToIPFS: vi.fn(() =>
    Promise.resolve({
      uri: "ipfs://QmTest123",
      cid: "QmTest123",
      url: "https://example.com/QmTest123",
    }),
  ),
}));

// ── Mock agent-wallet so we don't need a real signer ──
const mockSign = vi.fn((_payload: string) => Promise.resolve("0xmocksignature"));
const mockGetAddresses = vi.fn(() =>
  Promise.resolve({ celo: "0xagent" }),
);

vi.mock("../agent-wallet", () => ({
  getAgentWallet: () => ({
    getAddresses: mockGetAddresses,
    signMessage: mockSign,
  }),
}));

import {
  VerifiableAgentService,
  type AgentReceipt,
  type TEEAttestation,
} from "../verifiable-agent-service";
import type { AgentSuggestion } from "../agent-controls";

function buildSuggestion(overrides: Partial<AgentSuggestion> = {}): AgentSuggestion {
  return {
    id: "sug_test_1",
    agentId: "agent-9177",
    userId: "user_test",
    actionType: "purchase",
    amount: "5000000000000000000", // 5 USDC
    description: "Buy the navy blazer",
    recipient: "0xcurator",
    status: "pending",
    createdAt: 1700000000000,
    metadata: {},
    ...overrides,
  } as AgentSuggestion;
}

describe("VerifiableAgentService — TEE attestation", () => {
  beforeEach(() => {
    mockSign.mockClear();
    mockGetAddresses.mockClear();
  });

  it("creates a receipt without TEE proof when none is provided", async () => {
    const suggestion = buildSuggestion();

    const result = await VerifiableAgentService.createVerifiableLog(
      suggestion,
      "user_test",
    );

    expect(result.cid).toBe("QmTest123");
    expect(result.signature).toBe("0xmocksignature");
    expect(mockSign).toHaveBeenCalledTimes(1);
  });

  it("stamps a TEE proof on the receipt when provided", async () => {
    const suggestion = buildSuggestion();
    const tee: Omit<TEEAttestation, "verifiedAt"> = {
      provider: "0x4415ef5CBb415347bb18493af7cE01f225Fc0868",
      requestId: "574e5c8b-90dc-4d2d-8df8-6796ed4ac16c",
      mode: "TeeTLS",
      teeType: "TDX",
      verifier: "dstack",
      billing: {
        inputCost: "5904000000000",
        outputCost: "24040000000000",
        totalCost: "29944000000000",
      },
    };

    await VerifiableAgentService.createVerifiableLog(suggestion, "user_test", undefined, {
      tee,
    });

    // The signer is called once with a stringified receipt. The receipt
    // must include the TEE block BEFORE signing (so the signature
    // commits to it). Read what was signed.
    const signedPayload = mockSign.mock.calls[0]?.[0] as string;
    expect(signedPayload).toBeTruthy();
    const parsed: AgentReceipt = JSON.parse(signedPayload);
    expect(parsed.attestation.signer).toBe("0xagent");
    expect(parsed.attestation.tee).toBeDefined();
    expect(parsed.attestation.tee?.provider).toBe(tee.provider);
    expect(parsed.attestation.tee?.requestId).toBe(tee.requestId);
    expect(parsed.attestation.tee?.mode).toBe("TeeTLS");
    expect(parsed.attestation.tee?.teeType).toBe("TDX");
    expect(parsed.attestation.tee?.verifier).toBe("dstack");
    // verifiedAt is auto-stamped
    expect(typeof parsed.attestation.tee?.verifiedAt).toBe("number");
    expect(parsed.attestation.tee!.verifiedAt).toBeGreaterThan(0);
  });

  it("TEE proof is included in the signed payload (tamper-evident)", async () => {
    const suggestion = buildSuggestion();
    const tee: Omit<TEEAttestation, "verifiedAt"> = {
      provider: "0x0gprovider",
      requestId: "req-1",
      mode: "TeeML",
      teeType: "TDX",
      verifier: "dstack",
    };

    await VerifiableAgentService.createVerifiableLog(suggestion, "user_test", undefined, {
      tee,
    });

    const signedPayload = mockSign.mock.calls[0]?.[0] as string;
    // The signed string MUST contain the TEE provider address.
    expect(signedPayload).toContain("0x0gprovider");
    expect(signedPayload).toContain("TeeML");
  });

  it("omits TEE block when no proof is provided", async () => {
    const suggestion = buildSuggestion();
    await VerifiableAgentService.createVerifiableLog(suggestion, "user_test");

    const signedPayload = mockSign.mock.calls[0]?.[0] as string;
    const parsed: AgentReceipt = JSON.parse(signedPayload);
    expect(parsed.attestation.tee).toBeUndefined();
  });

  it("does not mutate the caller's suggestion", async () => {
    const suggestion = buildSuggestion();
    const tee: Omit<TEEAttestation, "verifiedAt"> = {
      provider: "0x0g",
      requestId: "req-1",
      mode: "TeeTLS",
      teeType: "TDX",
      verifier: "dstack",
    };

    const before = JSON.stringify(suggestion);
    await VerifiableAgentService.createVerifiableLog(suggestion, "user_test", undefined, {
      tee,
    });
    const after = JSON.stringify(suggestion);
    expect(after).toBe(before);
  });
});
