import { describe, it, expect, beforeEach } from "vitest";
import { calculateSplit, createCommissionRecord } from "../utils/commissions";

const SELLER = "0x1111111111111111111111111111111111111111" as const;
const AFFILIATE = "0x2222222222222222222222222222222222222222" as const;
const AGENT = "0x3333333333333333333333333333333333333333" as const;

describe("calculateSplit", () => {
  const ONE_CUSD = BigInt(1e18); // 1 cUSD in wei

  it("distributes 100% correctly with no affiliate or agent", () => {
    const total = ONE_CUSD * 100n; // 100 cUSD
    const split = calculateSplit(total, SELLER);

    const totalDistributed = split.recipients.reduce(
      (sum, r) => sum + r.amount,
      0n,
    );
    expect(totalDistributed).toBe(total);

    const seller = split.recipients.find((r) => r.label === "seller");
    const platform = split.recipients.find((r) => r.label === "platform");

    expect(seller!.percentBps).toBe(8500); // 85%
    expect(platform!.percentBps).toBe(1500); // 10% base + 3% affiliate + 2% agent = 15%
    expect(split.recipients).toHaveLength(2);
  });

  it("allocates affiliate share correctly", () => {
    const total = ONE_CUSD * 100n;
    const split = calculateSplit(total, SELLER, {
      affiliateAddress: AFFILIATE,
    });

    const seller = split.recipients.find((r) => r.label === "seller");
    const affiliate = split.recipients.find((r) => r.label === "affiliate");
    const platform = split.recipients.find((r) => r.label === "platform");

    expect(seller!.percentBps).toBe(8500);
    expect(affiliate!.percentBps).toBe(300);
    expect(platform!.percentBps).toBe(1200); // 10% + 2% (no agent)
    expect(split.recipients).toHaveLength(3);
  });

  it("allocates agent share correctly", () => {
    const total = ONE_CUSD * 100n;
    const split = calculateSplit(total, SELLER, { agentAddress: AGENT });

    const agent = split.recipients.find((r) => r.label === "agent");
    const platform = split.recipients.find((r) => r.label === "platform");

    expect(agent!.percentBps).toBe(200);
    expect(platform!.percentBps).toBe(1300); // 10% + 3% (no affiliate)
    expect(split.recipients).toHaveLength(3);
  });

  it("allocates all shares with both affiliate and agent", () => {
    const total = ONE_CUSD * 100n;
    const split = calculateSplit(total, SELLER, {
      affiliateAddress: AFFILIATE,
      agentAddress: AGENT,
    });

    expect(split.recipients).toHaveLength(4);

    const totalDistributed = split.recipients.reduce(
      (sum, r) => sum + r.amount,
      0n,
    );
    expect(totalDistributed).toBe(total);

    const percents = split.recipients.reduce((sum, r) => sum + r.percentBps, 0);
    expect(percents).toBe(10000); // 100%
  });

  it("handles small amounts without dust loss", () => {
    const total = 100n; // tiny amount
    const split = calculateSplit(total, SELLER, {
      affiliateAddress: AFFILIATE,
      agentAddress: AGENT,
    });

    const totalDistributed = split.recipients.reduce(
      (sum, r) => sum + r.amount,
      0n,
    );
    expect(totalDistributed).toBe(total);
  });

  it("handles zero amount", () => {
    const split = calculateSplit(0n, SELLER);
    expect(split.total).toBe(0n);
    const totalDistributed = split.recipients.reduce(
      (sum, r) => sum + r.amount,
      0n,
    );
    expect(totalDistributed).toBe(0n);
  });
});

describe("createCommissionRecord", () => {
  it("creates a valid commission record", () => {
    const total = BigInt(1e18) * 100n;
    const split = calculateSplit(total, SELLER, {
      affiliateAddress: AFFILIATE,
    });

    const record = createCommissionRecord("order_123", split, {
      affiliateId: "aff_456",
      agentId: "stylist-1",
    });

    expect(record.id).toMatch(/^comm_/);
    expect(record.orderId).toBe("order_123");
    expect(record.total).toBe(total.toString());
    expect(record.affiliateId).toBe("aff_456");
    expect(record.agentId).toBe("stylist-1");
    expect(record.recipients.length).toBeGreaterThan(0);
    expect(record.timestamp).toBeGreaterThan(0);
  });
});
