import { describe, expect, it } from "vitest";
import { buildTrace, type TraceFacts } from "./trace";

const LISTING = { title: "Linen shirt", curatorSlug: "nia" };
const PAYPAL_QUOTE = {
  rails: ["celo_cusd", "paypal"],
  ms: 412,
  paypal: { orderId: "ORDER-7XK", amountUsd: 0.05 },
};
const NEAR_QUOTE = {
  rails: ["celo_cusd", "near"],
  ms: 300,
  near: { amountNear: 0.5, network: "testnet" },
};

function doneFacts(overrides: Partial<TraceFacts> = {}): TraceFacts {
  return {
    listing: LISTING,
    quote: PAYPAL_QUOTE,
    method: "paypal",
    phase: "done",
    result: {
      requestMs: 42300,
      payment: { txHash: "CAPTUREID1234567890abcdef", explorerUrl: null, paymentMethod: "paypal" },
      render: { provider: "otari", imageConditioned: true },
      fitSignal: { score: 78, confidence: "medium", recommendedSize: "M" },
      aiCost: { provider: "otari", model: "tryon-v1", costUsd: 0.000281 },
      receiptId: "rcpt_abc",
      receiptUrl: "https://onpoint.trustfall.xyz/receipt/rcpt_abc",
    },
    ...overrides,
  };
}

describe("buildTrace — paypal", () => {
  it("quoting phase: offer done, quote pending, nothing else", () => {
    const { steps, verdict } = buildTrace({ listing: LISTING, phase: "quoting" });
    expect(steps.map((s) => s.id)).toEqual(["offer", "quote"]);
    expect(steps[1]?.state).toBe("pending");
    expect(steps[1]?.label).toBe("I'm asking what it costs");
    expect(verdict).toBeNull();
  });

  it("awaiting phase: pending 'waiting for you' with the order id", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: PAYPAL_QUOTE,
      method: "paypal",
      phase: "awaiting",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.state).toBe("pending");
    expect(approval?.label).toBe("I'm waiting for you");
    expect(approval?.detail).toContain("PayPal order ORDER-7XK");
    expect(approval?.detail).toContain("$0.05");
    expect(approval?.detail).toContain("I can't approve this for you");
  });

  it("checking phase: pending approval-check line", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: PAYPAL_QUOTE,
      method: "paypal",
      phase: "checking",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I'm checking your approval with PayPal");
    expect(approval?.state).toBe("pending");
  });

  it("done phase: full chain with capture short hash and verdict", () => {
    const { steps, verdict } = buildTrace(doneFacts());
    expect(steps.map((s) => s.id)).toEqual(["offer", "quote", "approval", "render", "fit", "receipt"]);
    const quote = steps[steps.findIndex((s) => s.id === "quote")]!;
    expect(quote.detail).toContain("HTTP 402");
    expect(quote.detail).toContain("2 ways to pay: cUSD, PayPal");
    expect(quote.detail).toContain("412 ms");
    const approval = steps[steps.findIndex((s) => s.id === "approval")]!;
    expect(approval.label).toBe("PayPal captured it");
    expect(approval.detail).toContain("capture CAPTUREI…abcdef");
    const render = steps[steps.findIndex((s) => s.id === "render")]!;
    expect(render.detail).toContain("otari");
    expect(render.detail).toContain("from your actual photo and the actual garment");
    expect(render.detail).toContain("42.3s for payment check, render and fit");
    const fit = steps[steps.findIndex((s) => s.id === "fit")]!;
    expect(fit.detail).toContain("score 78");
    expect(fit.detail).toContain("size M");
    expect(fit.detail).toContain("cost me $0.000281 via otari — settled, not an estimate");
    const receipt = steps[steps.findIndex((s) => s.id === "receipt")]!;
    expect(receipt.href).toBe("https://onpoint.trustfall.xyz/receipt/rcpt_abc");
    expect(verdict).toContain("I'd take the M.");
  });
});

describe("buildTrace — near", () => {
  it("done: approval href is the explorer url", () => {
    const { steps } = buildTrace(
      doneFacts({
        quote: NEAR_QUOTE,
        method: "near",
        result: {
          requestMs: 12000,
          payment: {
            txHash: "9xKpQ2AbCdEfGhIjKlMnOpQrStUv",
            explorerUrl: "https://testnet.nearblocks.io/txns/9xKpQ2",
            paymentMethod: "near",
          },
          render: { provider: "otari", imageConditioned: false },
          fitSignal: null,
          aiCost: null,
          receiptId: null,
          receiptUrl: null,
        },
      }),
    );
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I found your payment");
    expect(approval?.detail).toContain("tx 9xKpQ2Ab…QrStUv");
    expect(approval?.href).toBe("https://testnet.nearblocks.io/txns/9xKpQ2");
  });
});

describe("buildTrace — omissions", () => {
  it("omits fit step when fitSignal is null and aiCost clause when absent", () => {
    const f = doneFacts();
    f.result!.fitSignal = null;
    const { steps, verdict } = buildTrace(f);
    expect(steps.find((s) => s.id === "fit")).toBeUndefined();
    expect(verdict).toBe("The render is yours. I couldn't read a fit from this photo, so I'm not guessing a size.");
  });

  it("fit step without aiCost has no cost clause", () => {
    const f = doneFacts();
    f.result!.aiCost = null;
    const { steps } = buildTrace(f);
    const fit = steps.find((s) => s.id === "fit");
    expect(fit?.detail).toBe("score 78 · size M");
  });

  it("quote ms formats as seconds at >= 1000", () => {
    const f = doneFacts({ quote: { rails: ["paypal"], ms: 12988 } });
    const { steps } = buildTrace(f);
    expect(steps[1]?.detail).toContain("13.0 s");
    const f2 = doneFacts({ quote: { rails: ["paypal"], ms: 412 } });
    expect(buildTrace(f2).steps[1]?.detail).toContain("412 ms");
  });

  it("unknown rails pass through as-is", () => {
    const f = doneFacts({ quote: { rails: ["celo_cusd", "magic_rail"], ms: 10 } });
    const { steps } = buildTrace(f);
    expect(steps[1]?.detail).toContain("cUSD, magic_rail");
  });
});

describe("buildTrace — verdicts", () => {
  it("fitSignal without size", () => {
    const f = doneFacts();
    f.result!.fitSignal = { score: 60, confidence: "low", recommendedSize: null };
    const { verdict } = buildTrace(f);
    expect(verdict).toBe("It suits you on screen. I couldn't settle a size from one photo, so I'm not guessing one.");
  });
});
