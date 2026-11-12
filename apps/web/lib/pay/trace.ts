import { shortHash } from "@/components/surface/FactList";
import { fitVerdict } from "./rails";

export type PayMethod = "near" | "paypal" | "celo";

export interface TraceFacts {
  listing?: { title: string; curatorSlug: string } | null;
  quote?: {
    rails: string[];
    ms: number;
    priceUsd?: number;
    paypal?: { orderId?: string; amountUsd?: number } | null;
    near?: { amountNear?: number; network?: string } | null;
    celo?: { amountCusd: number; payTo: string; chainId?: number } | null;
  } | null;
  /** May be undefined while awaiting — the user hasn't chosen a rail yet. */
  method?: PayMethod;
  phase: "idle" | "quoting" | "awaiting" | "checking" | "done";
  result?: {
    requestMs: number;
    payment?: { txHash?: string | null; explorerUrl?: string | null; paymentMethod?: string };
    render?: { provider?: string; imageConditioned?: boolean };
    fitSignal?: {
      score?: number | null;
      confidence?: number | string | null;
      recommendedSize?: string | null;
    } | null;
    aiCost?: { provider?: string; model?: string | null; costUsd?: number | string | null } | null;
    receiptId?: string | null;
    receiptUrl?: string | null;
  } | null;
}

export interface TraceStep {
  id: string;
  label: string;
  /** The plain sentence — what anyone needs. */
  detail?: string;
  href?: string;
  /** Developer-grade detail, shown behind the "Show the details" toggle. */
  tech?: string;
  /** Pending rows only: who the wait belongs to. "you" rows never spin. */
  waitingOn?: "you" | "me";
  state: "done" | "pending";
}

const RAIL_NAMES: Record<string, string> = {
  celo_cusd: "cUSD",
  near: "NEAR",
  paypal: "PayPal",
};

function fmtMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

function railName(rail: string): string {
  return RAIL_NAMES[rail] ?? rail;
}

/**
 * The agent's work, in the first person — every line is emitted only once
 * the fact backing it actually exists (a quote that landed, a capture id,
 * a render). Nothing here advances on a timer.
 */
export function buildTrace(f: TraceFacts): { steps: TraceStep[]; verdict: string | null } {
  const steps: TraceStep[] = [];
  const done = f.phase === "done" && f.result;

  if (f.listing) {
    steps.push({
      id: "offer",
      label: "I found the piece",
      detail: `${f.listing.title} · from ${f.listing.curatorSlug}`,
      state: "done",
    });
  }

  if (f.phase === "quoting" && !f.quote) {
    steps.push({
      id: "quote",
      label: "I'm getting the price",
      state: "pending",
      waitingOn: "me",
    });
  } else if (f.quote) {
    // Of the rails this page supports, name the ones the quote advertises —
    // fixed order PayPal then NEAR, whatever order the API lists them in.
    const rails = f.quote.rails;
    const payables = (["paypal", "near", "celo_cusd"] as const)
      .filter((r) => rails.includes(r))
      .map(railName);
    const payableStr =
      payables.length <= 2
        ? payables.join(" or ")
        : `${payables.slice(0, -1).join(", ")} or ${payables[payables.length - 1]}`;
    const price = f.quote.priceUsd != null ? `$${f.quote.priceUsd.toFixed(2)}` : null;
    const detail = [price ? `${price}` : null, payableStr ? `pay with ${payableStr}` : null]
      .filter(Boolean)
      .join(" · ") || undefined;
    steps.push({
      id: "quote",
      label: "I got the price",
      detail,
      tech: `HTTP 402 · rails: ${f.quote.rails.map(railName).join(", ")} · ${fmtMs(f.quote.ms)}`,
      state: "done",
    });
  }

  const pm = f.result?.payment?.paymentMethod;
  const method: PayMethod | undefined =
    f.method ?? (done ? (pm === "paypal" ? "paypal" : pm === "near" ? "near" : "celo") : undefined);
  const wantsApproval = f.phase === "awaiting" || f.phase === "checking" || f.phase === "done";
  if (wantsApproval) {
    if (f.phase === "awaiting") {
      if (!method) {
        steps.push({
          id: "approval",
          label: "I'm waiting for you to choose how to pay",
          state: "pending",
          waitingOn: "you",
        });
      } else {
        const detail =
          method === "paypal"
            ? "Approve at PayPal — I can't do that part for you"
            : method === "celo"
              ? "Send it from your Celo wallet — I can't sign for you"
              : "Send it from your wallet — I can't sign for you";
        const tech =
          method === "paypal"
            ? f.quote?.paypal?.orderId
              ? `PayPal order ${f.quote.paypal.orderId}${f.quote.paypal.amountUsd != null ? ` · $${f.quote.paypal.amountUsd}` : ""}`
              : "PayPal order pending"
            : method === "celo"
              ? f.quote?.celo
                ? `${f.quote.celo.amountCusd} cUSD on Celo mainnet · to ${shortHash(f.quote.celo.payTo)}`
                : "cUSD on Celo mainnet"
              : f.quote?.near?.amountNear != null
                ? `${f.quote.near.amountNear} NEAR on ${f.quote.near.network ?? "testnet"}`
                : "NEAR transfer";
        steps.push({
          id: "approval",
          label: "I'm waiting for your OK",
          detail,
          tech,
          state: "pending",
          waitingOn: "you",
        });
      }
    } else if (f.phase === "checking") {
      steps.push({
        id: "approval",
        label:
          method === "paypal"
            ? "I'm checking with PayPal"
            : method === "celo"
              ? "I'm looking for your payment on Celo"
              : "I'm looking for your payment on NEAR",
        state: "pending",
        waitingOn: "me",
      });
    } else if (done && method) {
      const tx = f.result?.payment?.txHash;
      const explorer = f.result?.payment?.explorerUrl;
      steps.push({
        id: "approval",
        label: method === "paypal" ? "PayPal captured it" : "I found your payment",
        detail: method !== "paypal" && explorer ? "View the transfer" : undefined,
        href: explorer ?? undefined,
        tech: tx ? `${method === "paypal" ? "capture" : "tx"} ${shortHash(tx)}` : undefined,
        state: "done",
      });
    }
  }

  if (done && f.result) {
    const r = f.result;
    const seconds = (r.requestMs / 1000).toFixed(1);
    steps.push({
      id: "render",
      label: "I rendered you in the piece",
      detail: `${seconds}s`,
      tech: `${r.render?.provider ?? "unknown provider"}${r.render?.imageConditioned ? " · image-conditioned" : ""} · payment check, render and fit in one request`,
      state: "done",
    });

    if (r.fitSignal) {
      const parts: string[] = [];
      if (r.fitSignal.score != null) parts.push(`${r.fitSignal.score}/10`);
      if (r.fitSignal.recommendedSize) parts.push(`size ${r.fitSignal.recommendedSize}`);
      steps.push({
        id: "fit",
        label: "I read the fit",
        detail: parts.join(" · ") || undefined,
        tech:
          r.aiCost?.costUsd != null
            ? `cost $${Number(r.aiCost.costUsd).toFixed(6)} via ${r.aiCost.provider ?? "the render provider"} — settled, not an estimate`
            : undefined,
        state: "done",
      });
    }

    if (r.receiptId) {
      steps.push({
        id: "receipt",
        label: "I wrote a public receipt",
        detail: "Anyone with the link can check it",
        href: r.receiptUrl ?? undefined,
        tech: r.receiptId,
        state: "done",
      });
    }
  }

  let verdict: string | null = null;
  if (f.phase === "done" && f.result) {
    verdict = fitVerdict(f.result.fitSignal);
  }

  return { steps, verdict };
}
