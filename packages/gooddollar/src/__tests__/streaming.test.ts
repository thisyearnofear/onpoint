/**
 * Tests for @repo/gooddollar streaming helpers.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReadContract = vi.fn();
const mockSimulateContract = vi.fn();
const mockWriteContract = vi.fn();

vi.mock("viem", () => ({}));

const {
  createGStream,
  updateGStream,
  deleteGStream,
  getFlowRate,
  getTotalFlowRate,
  monthlyToFlowRate,
  flowRateToMonthly,
} = await import("../streaming.js");

const SENDER = "0x000000000000000000000000000000000000000A" as `0x${string}`;
const RECEIVER = "0x000000000000000000000000000000000000000B" as `0x${string}`;
const celoChain = { id: 42220, name: "Celo" } as any;

function publicClient() {
  return {
    chain: celoChain,
    readContract: mockReadContract,
    simulateContract: mockSimulateContract,
  } as any;
}

function walletClient() {
  return {
    chain: celoChain,
    writeContract: mockWriteContract,
  } as any;
}

describe("createGStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a stream with a valid flow rate", async () => {
    const fakeHash =
      "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as `0x${string}`;
    mockSimulateContract.mockResolvedValue({});
    mockWriteContract.mockResolvedValue(fakeHash);

    const hash = await createGStream(walletClient(), publicClient(), {
      sender: SENDER,
      receiver: RECEIVER,
      ratePerSecond: 1000000000000000n, // 0.001 G$/s
    });

    expect(hash).toBe(fakeHash);
    expect(mockSimulateContract).toHaveBeenCalledOnce();
    expect(mockWriteContract).toHaveBeenCalledOnce();
  });

  it("rejects a zero flow rate", async () => {
    await expect(
      createGStream(walletClient(), publicClient(), {
        sender: SENDER,
        receiver: RECEIVER,
        ratePerSecond: 0n,
      }),
    ).rejects.toThrow(/must be > 0/);
  });

  it("rejects a flow rate below the minimum threshold", async () => {
    await expect(
      createGStream(walletClient(), publicClient(), {
        sender: SENDER,
        receiver: RECEIVER,
        ratePerSecond: 1n,
      }),
    ).rejects.toThrow(/minimum threshold/);
  });

  it("throws on unsupported chain", async () => {
    const baseChain = { id: 8453, name: "Base" } as any;
    await expect(
      createGStream(walletClient(), { chain: baseChain } as any, {
        sender: SENDER,
        receiver: RECEIVER,
        ratePerSecond: 1000000000000000n,
      }),
    ).rejects.toThrow(/not deployed/);
  });
});

describe("updateGStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("updates an existing stream", async () => {
    const fakeHash =
      "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc" as `0x${string}`;
    mockSimulateContract.mockResolvedValue({});
    mockWriteContract.mockResolvedValue(fakeHash);

    const hash = await updateGStream(walletClient(), publicClient(), {
      sender: SENDER,
      receiver: RECEIVER,
      ratePerSecond: 2000000000000000n,
    });

    expect(hash).toBe(fakeHash);
    expect(mockWriteContract).toHaveBeenCalledOnce();
  });
});

describe("deleteGStream", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an existing stream", async () => {
    const fakeHash =
      "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd" as `0x${string}`;
    mockSimulateContract.mockResolvedValue({});
    mockWriteContract.mockResolvedValue(fakeHash);

    const hash = await deleteGStream(
      walletClient(),
      publicClient(),
      SENDER,
      RECEIVER,
    );

    expect(hash).toBe(fakeHash);
    expect(mockWriteContract).toHaveBeenCalledOnce();
  });
});

describe("getFlowRate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the flow rate between two addresses", async () => {
    mockReadContract.mockResolvedValue(500000000000000n);

    const rate = await getFlowRate(publicClient(), SENDER, RECEIVER);

    expect(rate.ratePerSecond).toBe(500000000000000n);
    expect(rate.sender).toBe(SENDER);
    expect(rate.receiver).toBe(RECEIVER);
    expect(rate.lastUpdated).toBeGreaterThan(0);
  });

  it("returns 0 when no stream exists", async () => {
    mockReadContract.mockResolvedValue(0n);

    const rate = await getFlowRate(publicClient(), SENDER, RECEIVER);
    expect(rate.ratePerSecond).toBe(0n);
  });
});

describe("getTotalFlowRate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the total outgoing flow rate for an account", async () => {
    mockReadContract.mockResolvedValue(1500000000000000n);

    const total = await getTotalFlowRate(publicClient(), SENDER);
    expect(total).toBe(1500000000000000n);
  });
});

describe("monthlyToFlowRate / flowRateToMonthly", () => {
  it("converts 10 G$/month to a per-second flow rate", () => {
    const rate = monthlyToFlowRate(10);
    // 10 G$ = 10e18 wei, / 2,592,000 seconds
    expect(rate).toBe(BigInt(Math.round(10 * 1e18)) / 2592000n);
    expect(rate).toBeGreaterThan(0n);
  });

  it("round-trips monthly → flowRate → monthly", () => {
    const original = 25.5;
    const rate = monthlyToFlowRate(original);
    const back = flowRateToMonthly(rate);
    // Should be close to the original (integer division may lose precision)
    expect(Math.abs(back - original)).toBeLessThan(0.01);
  });

  it("handles zero monthly amount", () => {
    expect(monthlyToFlowRate(0)).toBe(0n);
  });
});
