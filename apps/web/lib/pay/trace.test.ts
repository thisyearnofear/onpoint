import { describe, expect, it } from "vitest";
import { buildTrace, type TraceFacts } from "./trace";

const LISTING = { title: "Linen shirt", curatorSlug: "nia" };
const PAYPAL_QUOTE = {
  rails: ["celo_cusd", "paypal"],
  ms: 412,
  priceUsd: 0.05,
  paypal: { orderId: "ORDER-7XK", amountUsd: 0.05 },
};
const NEAR_QUOTE = {
  rails: ["celo_cusd", "near"],
  ms: 300,
  priceUsd: 0.03,
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
  it("quoting phase: offer done, quote pending on me, nothing else", () => {
    const { steps, verdict } = buildTrace({ listing: LISTING, phase: "quoting" });
    expect(steps.map((s) => s.id)).toEqual(["offer", "quote"]);
    expect(steps[1]?.state).toBe("pending");
    expect(steps[1]?.label).toBe("I'm getting the price");
    expect(steps[1]?.waitingOn).toBe("me");
    expect(verdict).toBeNull();
  });

  it("awaiting with no method chosen: 'waiting for you to choose', waitingOn you", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: PAYPAL_QUOTE,
      phase: "awaiting",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.state).toBe("pending");
    expect(approval?.label).toBe("I'm waiting for you to choose how to pay");
    expect(approval?.waitingOn).toBe("you");
  });

  it("awaiting with paypal: 'waiting for your OK' with plain detail + order id in tech", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: PAYPAL_QUOTE,
      method: "paypal",
      phase: "awaiting",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.state).toBe("pending");
    expect(approval?.label).toBe("I'm waiting for your OK");
    expect(approval?.waitingOn).toBe("you");
    expect(approval?.detail).toContain("Approve at PayPal");
    expect(approval?.detail).toContain("I can't do that part for you");
    expect(approval?.tech).toContain("PayPal order ORDER-7XK");
    expect(approval?.tech).toContain("$0.05");
  });

  it("awaiting with near: wallet detail + network in tech", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: NEAR_QUOTE,
      method: "near",
      phase: "awaiting",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I'm waiting for your OK");
    expect(approval?.detail).toContain("Send it from your wallet");
    expect(approval?.tech).toContain("0.5 NEAR on testnet");
  });

  it("checking phase: pending check line, waitingOn me", () => {
    const { steps } = buildTrace({
      listing: LISTING,
      quote: PAYPAL_QUOTE,
      method: "paypal",
      phase: "checking",
    });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I'm checking with PayPal");
    expect(approval?.state).toBe("pending");
    expect(approval?.waitingOn).toBe("me");
  });

  it("done phase: full chain, tech lines carry the developer detail", () => {
    const { steps, verdict } = buildTrace(doneFacts());
    expect(steps.map((s) => s.id)).toEqual(["offer", "quote", "approval", "render", "fit", "receipt"]);
    const quote = steps[steps.findIndex((s) => s.id === "quote")]!;
    expect(quote.label).toBe("I got the price");
    expect(quote.detail).toBe("$0.05 · pay with PayPal or cUSD");
    expect(quote.tech).toContain("HTTP 402");
    expect(quote.tech).toContain("rails: cUSD, PayPal");
    expect(quote.tech).toContain("412 ms");
    const approval = steps[steps.findIndex((s) => s.id === "approval")]!;
    expect(approval.label).toBe("PayPal captured it");
    expect(approval.tech).toContain("capture CAPTUREI…abcdef");
    const render = steps[steps.findIndex((s) => s.id === "render")]!;
    expect(render.label).toBe("I rendered you in the piece");
    expect(render.detail).toBe("42.3s");
    expect(render.tech).toContain("otari");
    expect(render.tech).toContain("image-conditioned");
    expect(render.tech).toContain("payment check, render and fit in one request");
    const fit = steps[steps.findIndex((s) => s.id === "fit")]!;
    expect(fit.detail).toBe("78/10 · size M");
    expect(fit.tech).toContain("cost $0.000281 via otari — settled, not an estimate");
    const receipt = steps[steps.findIndex((s) => s.id === "receipt")]!;
    expect(receipt.detail).toBe("Anyone with the link can check it");
    expect(receipt.tech).toBe("rcpt_abc");
    expect(receipt.href).toBe("https://onpoint.trustfall.xyz/receipt/rcpt_abc");
    expect(verdict).toContain("I'd take the M.");
  });
});

describe("buildTrace — near", () => {
  it("done: 'View the transfer' links the explorer url, hash stays in tech", () => {
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
    expect(approval?.detail).toBe("View the transfer");
    expect(approval?.href).toBe("https://testnet.nearblocks.io/txns/9xKpQ2");
    expect(approval?.tech).toContain("tx 9xKpQ2Ab…QrStUv");
  });
});

describe("buildTrace — celo", () => {
  const CELO_QUOTE = {
    rails: ["celo_cusd", "near", "paypal"],
    ms: 200,
    priceUsd: 0.03,
    celo: { amountCusd: 0.03, payTo: "0xABCDEF1234567890abcdef1234567890ABCDEF12", chainId: 42220 },
  };

  it("three rails join as 'PayPal, NEAR or cUSD'", () => {
    const { steps } = buildTrace({ listing: LISTING, quote: CELO_QUOTE, phase: "awaiting" });
    expect(steps[1]?.detail).toBe("$0.03 · pay with PayPal, NEAR or cUSD");
  });

  it("awaiting celo: wallet detail + amount/address in tech", () => {
    const { steps } = buildTrace({ listing: LISTING, quote: CELO_QUOTE, method: "celo", phase: "awaiting" });
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I'm waiting for your OK");
    expect(approval?.detail).toBe("Send it from your Celo wallet — I can't sign for you");
    expect(approval?.tech).toContain("0.03 cUSD on Celo mainnet");
    expect(approval?.tech).toContain("to 0xABCDEF…CDEF12");
  });

  it("checking celo: 'looking for your payment on Celo'", () => {
    const { steps } = buildTrace({ listing: LISTING, quote: CELO_QUOTE, method: "celo", phase: "checking" });
    expect(steps.find((s) => s.id === "approval")?.label).toBe("I'm looking for your payment on Celo");
  });

  it("done celo: 'I found your payment' + celoscan href; inferred when method unset", () => {
    const f = doneFacts({
      quote: CELO_QUOTE,
      method: undefined,
      result: {
        requestMs: 9000,
        payment: {
          txHash: "0x9abc1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          explorerUrl: "https://celoscan.io/tx/0x9abc",
          paymentMethod: "cusd",
        },
        render: { provider: "otari" },
        fitSignal: null,
        aiCost: null,
        receiptId: null,
        receiptUrl: null,
      },
    });
    const { steps } = buildTrace(f);
    const approval = steps.find((s) => s.id === "approval");
    expect(approval?.label).toBe("I found your payment");
    expect(approval?.detail).toBe("View the transfer");
    expect(approval?.href).toBe("https://celoscan.io/tx/0x9abc");
    expect(approval?.tech).toContain("tx 0x9abc12…567890");
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

  it("fit step without aiCost has no tech line", () => {
    const f = doneFacts();
    f.result!.aiCost = null;
    const { steps } = buildTrace(f);
    const fit = steps.find((s) => s.id === "fit");
    expect(fit?.detail).toBe("78/10 · size M");
    expect(fit?.tech).toBeUndefined();
  });

  it("quote ms formats as seconds at >= 1000 (in tech)", () => {
    const f = doneFacts({ quote: { rails: ["paypal"], ms: 12988, priceUsd: 0.03 } });
    const { steps } = buildTrace(f);
    expect(steps[1]?.tech).toContain("13.0 s");
    const f2 = doneFacts({ quote: { rails: ["paypal"], ms: 412, priceUsd: 0.03 } });
    expect(buildTrace(f2).steps[1]?.tech).toContain("412 ms");
  });

  it("quote detail names only the payable rails; unknown rails stay in tech", () => {
    const f = doneFacts({ quote: { rails: ["celo_cusd", "magic_rail"], ms: 10, priceUsd: 0.03 } });
    const { steps } = buildTrace(f);
    expect(steps[1]?.detail).toBe("$0.03 · pay with cUSD");
    expect(steps[1]?.tech).toContain("cUSD, magic_rail");
    const both = doneFacts({ quote: { rails: ["paypal", "near"], ms: 10, priceUsd: 0.03 } });
    expect(buildTrace(both).steps[1]?.detail).toBe("$0.03 · pay with PayPal or NEAR");
    // Order is fixed PayPal, NEAR, cUSD regardless of the API's rail order.
    const reversed = doneFacts({ quote: { rails: ["celo_cusd", "near", "paypal"], ms: 10, priceUsd: 0.03 } });
    expect(buildTrace(reversed).steps[1]?.detail).toBe("$0.03 · pay with PayPal, NEAR or cUSD");
  });

  it("quote detail degrades gracefully without a price", () => {
    const f = doneFacts({ quote: { rails: ["paypal"], ms: 10 } });
    expect(buildTrace(f).steps[1]?.detail).toBe("pay with PayPal");
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
