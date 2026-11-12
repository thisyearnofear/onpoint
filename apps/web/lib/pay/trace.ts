import { shortHash } from "@/components/surface/FactList";
import { fitVerdict } from "./rails";

export type PayMethod = "near" | "paypal";

export interface TraceFacts {
  listing?: { title: string; curatorSlug: string } | null;
  quote?: {
    rails: string[];
    ms: number;
    paypal?: { orderId?: string; amountUsd?: number } | null;
    near?: { amountNear?: number; network?: string } | null;
  } | null;
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
  detail?: string;
  href?: string;
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
      label: "I read the offer",
      detail: `${f.listing.title} · from ${f.listing.curatorSlug}`,
      state: "done",
    });
  }

  if (f.phase === "quoting" && !f.quote) {
    steps.push({ id: "quote", label: "I'm asking what it costs", state: "pending" });
  } else if (f.quote) {
    const names = f.quote.rails.map(railName).join(", ");
    steps.push({
      id: "quote",
      label: "I got a quote",
      detail: `HTTP 402 · ${f.quote.rails.length} way${f.quote.rails.length === 1 ? "" : "s"} to pay: ${names} · ${fmtMs(f.quote.ms)}`,
      state: "done",
    });
  }

  const method: PayMethod | undefined =
    f.method ?? (done && f.result?.payment?.paymentMethod === "paypal" ? "paypal" : undefined);
  const wantsApproval = f.phase === "awaiting" || f.phase === "checking" || f.phase === "done";
  if (method && wantsApproval) {
    if (f.phase === "awaiting") {
      const detail =
        method === "paypal"
          ? f.quote?.paypal?.orderId
            ? `PayPal order ${f.quote.paypal.orderId}${f.quote.paypal.amountUsd != null ? ` · $${f.quote.paypal.amountUsd}` : ""} · I can't approve this for you`
            : "PayPal is asking you, not me — I can't approve this for you"
          : f.quote?.near?.amountNear != null
            ? `${f.quote.near.amountNear} NEAR on ${f.quote.near.network ?? "testnet"} · I can't sign for you`
            : "I can't sign the transfer for you";
      steps.push({ id: "approval", label: "I'm waiting for you", detail, state: "pending" });
    } else if (f.phase === "checking") {
      steps.push({
        id: "approval",
        label:
          method === "paypal"
            ? "I'm checking your approval with PayPal"
            : "I'm looking for your payment on NEAR",
        state: "pending",
      });
    } else if (done) {
      const tx = f.result?.payment?.txHash;
      const explorer = f.result?.payment?.explorerUrl;
      steps.push({
        id: "approval",
        label: method === "paypal" ? "PayPal captured it" : "I found your payment",
        detail: tx ? `${method === "paypal" ? "capture" : "tx"} ${shortHash(tx)}` : undefined,
        href: explorer ?? undefined,
        state: "done",
      });
    }
  }

  if (done && f.result) {
    const r = f.result;
    const seconds = (r.requestMs / 1000).toFixed(1);
    steps.push({
      id: "render",
      label: "I rendered the try-on",
      detail: `${r.render?.provider ?? "unknown provider"}${r.render?.imageConditioned ? " · from your actual photo and the actual garment" : ""} · ${seconds}s for payment check, render and fit`,
      state: "done",
    });

    if (r.fitSignal) {
      const parts: string[] = [];
      if (r.fitSignal.score != null) parts.push(`score ${r.fitSignal.score}`);
      if (r.fitSignal.recommendedSize) parts.push(`size ${r.fitSignal.recommendedSize}`);
      if (r.aiCost?.costUsd != null) {
        parts.push(
          `cost me $${Number(r.aiCost.costUsd).toFixed(6)} via ${r.aiCost.provider ?? "the render provider"} — settled, not an estimate`,
        );
      }
      steps.push({
        id: "fit",
        label: "I read the fit",
        detail: parts.join(" · ") || undefined,
        state: "done",
      });
    }

    if (r.receiptId) {
      steps.push({
        id: "receipt",
        label: "I wrote a public receipt",
        detail: `${r.receiptId} · anyone can read it`,
        href: r.receiptUrl ?? undefined,
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
