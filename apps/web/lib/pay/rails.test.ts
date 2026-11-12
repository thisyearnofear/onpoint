import { describe, expect, it } from "vitest";
import {
  buildReceiptView,
  railFromPolaroidPayment,
  railFromReceipt,
  sourceKind,
} from "./rails";

describe("railFromPolaroidPayment", () => {
  it("paymentMethod wins", () => {
    expect(railFromPolaroidPayment({ paymentMethod: "paypal", explorerUrl: "https://celoscan.io/tx/x" })).toBe("paypal");
    expect(railFromPolaroidPayment({ paymentMethod: "near" })).toBe("near");
    expect(railFromPolaroidPayment({ paymentMethod: "cusd" })).toBe("celo");
  });
  it("falls back to explorerUrl", () => {
    expect(railFromPolaroidPayment({ explorerUrl: null })).toBe("paypal");
    expect(railFromPolaroidPayment({ explorerUrl: "" })).toBe("paypal");
    expect(railFromPolaroidPayment({ explorerUrl: "https://testnet.nearblocks.io/txns/abc" })).toBe("near");
    expect(railFromPolaroidPayment({ explorerUrl: "https://celoscan.io/tx/abc" })).toBe("celo");
  });
});

describe("railFromReceipt", () => {
  it("reads chain", () => {
    expect(railFromReceipt({ chain: "paypal" })).toBe("paypal");
    expect(railFromReceipt({ chain: "near" })).toBe("near");
    expect(railFromReceipt({ chain: "celo" })).toBe("celo");
  });
  it("falls back to metadata.paymentMethod then celo", () => {
    expect(railFromReceipt({ metadata: { paymentMethod: "paypal" } })).toBe("paypal");
    expect(railFromReceipt({})).toBe("celo");
  });
});

describe("sourceKind", () => {
  it("classifies the three source kinds", () => {
    expect(sourceKind({ curatorSlug: "nia", inventoryType: "digital" })).toBe("ai-designer");
    expect(sourceKind({ curatorSlug: "onpoint-store" })).toBe("studio");
    expect(sourceKind({ curatorSlug: "zara", inventoryType: "physical" })).toBe("curator");
  });
});

const NEAR_PURCHASE = {
  id: "receipt_mwd8sj41_bcae097c",
  agentId: 42,
  action: "purchase",
  chain: "near",
  txHash: "9xKpQ2AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
  metadata: {
    orderId: "order_ab12cd34ef56",
    curatorSlug: "onpoint-store",
    listingId: "l1",
    item: "NEAR FC Home Kit 26/27",
    totalCusd: 19.23,
    buyerAddress: "buyer.near",
    payoutTxHash: "9xKpQ2AbCdEfGhIjKlMnOpQrStUvWxYz1234567890",
    curatorPayout: "4.9948052 NEAR (direct to curator)",
    near: {
      accountId: "buyer.onpoint.testnet",
      amountYocto: "4994805200000000000000000",
      payTo: "store.onpoint.testnet",
      network: "testnet",
    },
  },
};

describe("buildReceiptView — paypal purchase", () => {
  it("paypal rows: capture without href, payout pending, USD amount", () => {
    const { rail, rows, steps, verdict } = buildReceiptView({
      id: "r1",
      agentId: 7,
      action: "purchase",
      chain: "paypal",
      txHash: "CAPTUREID1234567890abcdef",
      metadata: {
        orderId: "order_zz99",
        curatorSlug: "nia",
        item: "Jersey Dress",
        totalCusd: 16.92,
        buyerAddress: "0x1111",
        curatorPayout: "16.92 USD (platform, pending reconciliation)",
        paypal: { orderId: "ORDER-1", captureId: "CAPTUREID1234567890abcdef", amountUsd: 16.92, env: "sandbox" },
      },
    });
    expect(rail).toBe("paypal");
    const amount = rows.find((r) => r.label === "Amount");
    expect(amount?.value).toBe("$16.92 USD");
    const capture = rows.find((r) => r.label === "PayPal capture");
    expect(capture?.value).toBe("CAPTUREI…abcdef");
    expect(capture?.href).toBeUndefined();
    expect(rows.find((r) => r.label === "PayPal order")?.value).toBe("ORDER-1");
    const payout = rows.find((r) => r.label === "Payout");
    expect(payout?.value).toContain("pending reconciliation");
    expect(payout?.tone).toBe("warning");
    expect(rows.find((r) => r.label === "Verified on Celo")).toBeUndefined();
    expect(verdict).toContain("It's yours.");
    expect(steps.find((s) => s.id === "payout")?.label).toBe("I logged the curator's payout as pending");
  });
});

describe("buildReceiptView — near direct purchase", () => {
  it("one hash row, NEAR amount, direct payout, no custodial line", () => {
    const { rail, rows, steps, verdict } = buildReceiptView(NEAR_PURCHASE);
    expect(rail).toBe("near");
    const amount = rows.find((r) => r.label === "Amount");
    expect(amount?.value).toBe("4.9948 NEAR (≈ $19.23)");
    // payoutTxHash === txHash → exactly one hash-bearing row
    const hashRows = rows.filter((r) => r.mono && (r.label.includes("NEAR") || r.label.includes("tx")));
    expect(hashRows).toHaveLength(1);
    expect(rows.find((r) => r.label === "Curator payout tx")).toBeUndefined();
    const payout = rows.find((r) => r.label === "Payout");
    expect(payout?.value).toContain("store.onpoint.testnet");
    expect(payout?.value).not.toContain("Custodial");
    expect(payout?.tone).toBe("success");
    const proof = rows.find((r) => r.label === "Verified on NEAR");
    expect(proof?.href).toBe("https://testnet.nearblocks.io/txns/9xKpQ2AbCdEfGhIjKlMnOpQrStUvWxYz1234567890");
    expect(rows.find((r) => r.label === "Buyer")?.value).toBe("buyer.near");
    expect(verdict).toContain("It's yours.");
    expect(steps.find((s) => s.id === "payout")?.label).toBe("The curator was paid in the same transfer");
  });
});

describe("buildReceiptView — paypal try-on", () => {
  it("render step + try-on verdict", () => {
    const { rows, steps, verdict } = buildReceiptView({
      id: "r2",
      action: "analyze_outfit",
      sessionId: "tryon_014bf843",
      chain: "paypal",
      txHash: "CAPTUREXYZ111111aaaaabbb",
      metadata: {
        purpose: "try_on",
        curatorSlug: "nia",
        item: "Jersey Dress",
        priceCusd: 0.03,
        payerAddress: "0xabc",
        renderProvider: "otari",
        paymentMethod: "paypal",
        paypal: { orderId: "O-9", amountUsd: 0.03 },
      },
    });
    expect(rows.find((r) => r.label === "Amount")?.value).toBe("$0.03 USD");
    expect(rows.find((r) => r.label === "PayPal capture")).toBeTruthy();
    expect(steps.find((s) => s.id === "render")?.detail).toBe("otari");
    expect(verdict).toContain("Rendered and paid for.");
  });
});

describe("buildReceiptView — celo fallback", () => {
  it("celoscan link, cUSD amount, 0xSplits payout", () => {
    const { rail, rows, lede } = buildReceiptView({
      id: "r3",
      action: "purchase",
      chain: "celo",
      txHash: "0xdeadbeefcafe1234567890abcd",
      metadata: {
        item: "Cream coat",
        totalCusd: 42,
        curatorSlug: "zara",
        splitAddress: "0xsplit",
        buyerAddress: "0x0000000000000000000000000000000000000000",
      },
    });
    expect(rail).toBe("celo");
    expect(lede).toContain("cUSD");
    expect(rows.find((r) => r.label === "Amount")?.value).toBe("42 cUSD");
    const proof = rows.find((r) => r.label === "Verified on Celo");
    expect(proof?.href).toContain("celoscan.io");
    expect(rows.find((r) => r.label === "Payout")?.value).toContain("0xSplits");
    expect(rows.find((r) => r.label === "Buyer")).toBeUndefined();
  });
});

describe("buildReceiptView — paypal payout sent", () => {
  it("shows the Payouts batch instead of pending reconciliation", () => {
    const { rows } = buildReceiptView(
      {
        id: "r1",
        action: "purchase",
        chain: "paypal",
        txHash: "CAPTURE1",
        metadata: {
          paymentMethod: "paypal",
          curatorPayout: "0.05 USD via PayPal Payouts (batch BATCH123)",
          paypal: { captureId: "CAPTURE1", amountUsd: 0.05, payoutBatchId: "BATCH123" },
        },
      },
      "Nia",
    );
    const payout = rows.find((r) => r.label === "Payout");
    expect(payout?.value).toBe("Sent via PayPal Payouts — batch BATCH123");
    expect(payout?.tone).toBe("success");
  });

  it("shows the payout row on a paypal try-on receipt when the batch exists", () => {
    const { rows } = buildReceiptView(
      {
        id: "r2",
        action: "analyze_outfit",
        chain: "paypal",
        txHash: "CAPTURE2",
        metadata: {
          paymentMethod: "paypal",
          purpose: "try_on",
          paypal: { captureId: "CAPTURE2", amountUsd: 0.03, payoutBatchId: "BATCH999" },
        },
      },
      "Nia",
    );
    expect(rows.find((r) => r.label === "Payout")?.value).toContain("PayPal Payouts");
  });
});
