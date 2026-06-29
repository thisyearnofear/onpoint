/**
 * Tests for @repo/gooddollar claim + balance helpers.
 *
 * Mocks viem client methods so the logic is tested without a live Celo RPC.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadContract = vi.fn();
const mockSimulateContract = vi.fn();
const mockWriteContract = vi.fn();
const mockWaitForTx = vi.fn();
const mockGetBlock = vi.fn();

vi.mock("viem", () => ({
  formatEther: (wei: bigint) => {
    const str = wei.toString().padStart(19, "0");
    const whole = str.slice(0, -18) || "0";
    const frac = str.slice(-18);
    return `${whole}.${frac}`;
  },
  decodeErrorResult: () => null,
}));

const { getClaimStatus, claimUBI } = await import("../claim.js");
const { getGBalanceSnapshot, formatGAmount } = await import("../balance.js");

const CELO_ADDRESS = "0x0000000000000000000000000000000000000001" as `0x${string}`;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as `0x${string}`;
const ROOT_ADDRESS = "0x0000000000000000000000000000000000000002" as `0x${string}`;

const celoChain = { id: 42220, name: "Celo" } as any;

function publicClient() {
  return {
    chain: celoChain,
    readContract: mockReadContract,
    simulateContract: mockSimulateContract,
    waitForTransactionReceipt: mockWaitForTx,
    getBlock: mockGetBlock,
  } as any;
}

function walletClient() {
  return {
    chain: celoChain,
    writeContract: mockWriteContract,
  } as any;
}

describe("getClaimStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns canClaim=true for a whitelisted user with entitlement", async () => {
    mockReadContract
      .mockResolvedValueOnce(ROOT_ADDRESS) // getWhitelistedRoot → non-zero = whitelisted
      .mockResolvedValueOnce(1500000000000000000n); // checkEntitlement → 1.5 G$

    const status = await getClaimStatus(publicClient(), CELO_ADDRESS);

    expect(status.isWhitelisted).toBe(true);
    expect(status.canClaim).toBe(true);
    expect(status.nextClaimAt).toBe(0);
  });

  it("returns canClaim=false when already claimed (entitlement = 0)", async () => {
    mockReadContract
      .mockResolvedValueOnce(ROOT_ADDRESS) // whitelisted
      .mockResolvedValueOnce(0n); // no entitlement

    const status = await getClaimStatus(publicClient(), CELO_ADDRESS);

    expect(status.isWhitelisted).toBe(true);
    expect(status.canClaim).toBe(false);
    expect(status.nextClaimAt).toBeGreaterThan(0);
  });

  it("returns canClaim=false when not whitelisted (root = zero)", async () => {
    mockReadContract
      .mockResolvedValueOnce(ZERO_ADDRESS) // not whitelisted
      .mockResolvedValueOnce(0n);

    const status = await getClaimStatus(publicClient(), CELO_ADDRESS);

    expect(status.isWhitelisted).toBe(false);
    expect(status.canClaim).toBe(false);
  });

  it("throws when GoodDollar is not deployed on the chain", async () => {
    const baseChain = { id: 8453, name: "Base" } as any;
    await expect(
      getClaimStatus({ chain: baseChain } as any, CELO_ADDRESS),
    ).rejects.toThrow(/not fully deployed/);
  });
});

describe("claimUBI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("simulates, submits, and returns the hash + timestamp", async () => {
    const fakeHash =
      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as `0x${string}`;
    mockSimulateContract.mockResolvedValue({});
    mockWriteContract.mockResolvedValue(fakeHash);
    mockWaitForTx.mockResolvedValue({ blockHash: fakeHash });
    mockGetBlock.mockResolvedValue({ timestamp: 1700000000n });

    const result = await claimUBI(walletClient(), publicClient(), CELO_ADDRESS);

    expect(mockSimulateContract).toHaveBeenCalledOnce();
    expect(mockWriteContract).toHaveBeenCalledOnce();
    expect(result.hash).toBe(fakeHash);
    expect(result.timestamp).toBe(1700000000);
  });

  it("surfaces a decoded revert reason from simulation", async () => {
    const revertErr = { shortMessage: "NotWhitelisted()" };
    mockSimulateContract.mockRejectedValue(revertErr);

    await expect(
      claimUBI(walletClient(), publicClient(), CELO_ADDRESS),
    ).rejects.toThrow(/NotWhitelisted/);
  });
});

describe("formatGAmount", () => {
  it("formats 1 G$ correctly", () => {
    expect(formatGAmount(1000000000000000000n)).toBe("1.00 G$");
  });

  it("handles zero", () => {
    expect(formatGAmount(0n)).toBe("0.00 G$");
  });

  it("appends the G$ suffix", () => {
    const out = formatGAmount(500000000000000000n);
    expect(out.endsWith(" G$")).toBe(true);
  });
});

describe("getGBalanceSnapshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reads balance and outgoing flow rate", async () => {
    mockReadContract
      .mockResolvedValueOnce(2500000000000000000n) // balanceOf
      .mockResolvedValueOnce(1000n); // getAccountFlowrate

    const snap = await getGBalanceSnapshot(publicClient(), CELO_ADDRESS);

    expect(snap.balance).toBe(2500000000000000000n);
    expect(snap.outgoingFlowRate).toBe(1000n);
    expect(snap.fetchedAt).toBeGreaterThan(0);
  });

  it("caches the snapshot for 30 seconds", async () => {
    const uniqueAddr =
      "0x0000000000000000000000000000000000000099" as `0x${string}`;
    mockReadContract
      .mockResolvedValueOnce(1000000000000000000n)
      .mockResolvedValueOnce(0n);

    const first = await getGBalanceSnapshot(publicClient(), uniqueAddr);
    const second = await getGBalanceSnapshot(publicClient(), uniqueAddr);

    expect(mockReadContract).toHaveBeenCalledTimes(2);
    expect(second).toBe(first);
  });
});
