import { shortHash } from "@/components/surface/FactList";
import type { TraceStep } from "./trace";

export type Rail = "paypal" | "near" | "celo";

export function railFromPolaroidPayment(p: {
  paymentMethod?: string;
  explorerUrl?: string | null;
}): Rail {
  if (p.paymentMethod === "paypal") return "paypal";
  if (p.paymentMethod === "near") return "near";
  if (p.paymentMethod && p.paymentMethod !== "paypal" && p.paymentMethod !== "near") return "celo";
  if (!p.explorerUrl) return "paypal";
  return p.explorerUrl.includes("near") ? "near" : "celo";
}

export function railFromReceipt(r: {
  chain?: string;
  metadata?: { paymentMethod?: string };
}): Rail {
  const chain = r.chain ?? r.metadata?.paymentMethod ?? "celo";
  if (chain === "paypal") return "paypal";
  if (chain === "near") return "near";
  return "celo";
}

export function sourceKind(x: {
  curatorSlug: string;
  inventoryType?: string;
}): "ai-designer" | "studio" | "curator" {
  if (x.inventoryType === "digital") return "ai-designer";
  if (x.curatorSlug === "onpoint-store") return "studio";
  return "curator";
}

export function fitVerdict(
  fit: { recommendedSize?: string | null } | null | undefined,
): string {
  if (fit?.recommendedSize) {
    return `I'd take the ${fit.recommendedSize}. That's my read of one photo against the size chart — not a tape measure.`;
  }
  if (fit) {
    return "It suits you on screen. I couldn't settle a size from one photo, so I'm not guessing one.";
  }
  return "The render is yours. I couldn't read a fit from this photo, so I'm not guessing a size.";
}

export interface FactRowData {
  label: string;
  value: string;
  href?: string;
  mono?: boolean;
  tone?: "success" | "warning" | "info" | "muted";
}

interface ReceiptMetadata {
  orderId?: string;
  curatorSlug?: string;
  listingId?: string;
  item?: string;
  size?: string;
  totalCusd?: number;
  priceCusd?: number;
  buyerAddress?: string;
  payerAddress?: string;
  payoutTxHash?: string;
  curatorPayout?: string;
  paymentMethod?: string;
  purpose?: string;
  renderProvider?: string;
  splitAddress?: string;
  near?: { accountId?: string; amountYocto?: string; payTo?: string; network?: string };
  paypal?: { orderId?: string; captureId?: string; amountUsd?: number; env?: string };
}

export interface ReceiptLike {
  id: string;
  agentId?: number;
  action?: string;
  sessionId?: string;
  metadata?: ReceiptMetadata;
  txHash?: string;
  chain?: string;
  signature?: string;
}

function nearAmount(amountYocto?: string): string | null {
  if (!amountYocto) return null;
  const n = Number(amountYocto) / 1e24;
  if (!Number.isFinite(n)) return null;
  // Trim to at most 4 decimals, no trailing zeros.
  return String(Number(n.toFixed(4)));
}

export function buildReceiptView(
  receipt: ReceiptLike,
  curatorName?: string,
): { rail: Rail; lede: string; rows: FactRowData[]; steps: TraceStep[]; verdict: string | null } {
  const rail = railFromReceipt(receipt);
  const meta = receipt.metadata ?? {};
  const isPurchase = receipt.action === "purchase";
  const isTryOn = receipt.action === "analyze_outfit" || meta.purpose === "try_on";

  const txHash = (meta as { txHash?: string }).txHash ?? receipt.txHash;
  const amount = meta.totalCusd ?? meta.priceCusd;

  const lede =
    rail === "paypal"
      ? `Paid through PayPal${curatorName ? ` to ${curatorName}` : ""} — captured and recorded by OnPoint's agent.`
      : rail === "near"
        ? "Paid on NEAR — verified against the chain."
        : "Paid in cUSD — verified on Celo.";

  const rows: FactRowData[] = [];

  if (meta.item) {
    rows.push({ label: "Item", value: `${meta.item}${meta.size ? ` (${meta.size})` : ""}` });
  }

  if (amount != null || meta.paypal?.amountUsd != null || meta.near?.amountYocto) {
    if (rail === "paypal") {
      const usd = meta.paypal?.amountUsd ?? amount;
      rows.push({ label: "Amount", value: `$${usd} USD` });
    } else if (rail === "near") {
      const nearAmt = nearAmount(meta.near?.amountYocto);
      if (nearAmt) {
        rows.push({
          label: "Amount",
          value: `${nearAmt} NEAR${amount != null ? ` (≈ $${amount})` : ""}`,
        });
      } else {
        rows.push({ label: "Amount", value: `≈ $${amount} in NEAR` });
      }
    } else {
      rows.push({ label: "Amount", value: `${amount} cUSD` });
    }
  }

  if (isPurchase) {
    if (rail === "paypal") {
      rows.push({
        label: "Payout",
        value: "Held by OnPoint — the curator's payout is pending reconciliation",
        tone: "warning",
      });
    } else if (rail === "near") {
      if (meta.curatorPayout?.includes("direct to curator")) {
        rows.push({
          label: "Payout",
          value: `Straight to ${meta.near?.payTo ?? "the curator"} — the payment was the payout`,
          tone: "success",
        });
      } else {
        rows.push({ label: "Payout", value: "Held by OnPoint — payout pending reconciliation", tone: "warning" });
      }
    } else if (meta.splitAddress) {
      rows.push({ label: "Payout", value: "0xSplits — distributed automatically" });
    } else if (meta.curatorPayout) {
      rows.push({ label: "Payout", value: meta.curatorPayout });
    }
  }

  if (txHash) {
    if (rail === "paypal") {
      rows.push({ label: "PayPal capture", value: shortHash(txHash), mono: true });
      if (meta.paypal?.orderId) {
        rows.push({ label: "PayPal order", value: meta.paypal.orderId, mono: true });
      }
    } else if (rail === "near") {
      const sub = meta.near?.network === "mainnet" ? "" : "testnet.";
      rows.push({
        label: "Verified on NEAR",
        value: shortHash(txHash),
        href: `https://${sub}nearblocks.io/txns/${txHash}`,
        mono: true,
      });
    } else {
      rows.push({
        label: "Verified on Celo",
        value: shortHash(txHash),
        href: `https://celoscan.io/tx/${txHash}`,
        mono: true,
      });
    }
  }

  if (meta.payoutTxHash && meta.payoutTxHash !== txHash) {
    rows.push({ label: "Curator payout tx", value: shortHash(meta.payoutTxHash), mono: true });
  }

  const buyer = meta.buyerAddress ?? meta.payerAddress;
  if (buyer && buyer !== "0x0000000000000000000000000000000000000000") {
    rows.push({
      label: "Buyer",
      value: rail === "near" && buyer.length <= 28 ? buyer : shortHash(buyer),
      mono: true,
    });
  }

  if (receipt.signature && receipt.agentId != null) {
    rows.push({ label: "Signed by", value: `agent #${receipt.agentId}` });
  }

  const steps: TraceStep[] = [];
  if (meta.item) {
    steps.push({
      id: "offer",
      label: "I read the offer",
      detail: `${meta.item} · from ${meta.curatorSlug ?? "the storefront"}`,
      state: "done",
    });
  }
  if (txHash) {
    const hashDetail = txHash ? shortHash(txHash) : undefined;
    if (rail === "paypal") {
      steps.push({
        id: "payment",
        label: "PayPal captured it",
        detail: hashDetail ? `capture ${hashDetail}` : undefined,
        state: "done",
      });
    } else if (rail === "near") {
      const sub = meta.near?.network === "mainnet" ? "" : "testnet.";
      steps.push({
        id: "payment",
        label: "I found the payment on NEAR",
        detail: hashDetail ? `tx ${hashDetail}` : undefined,
        href: `https://${sub}nearblocks.io/txns/${txHash}`,
        state: "done",
      });
    } else {
      steps.push({
        id: "payment",
        label: "I verified the payment on Celo",
        detail: hashDetail ? `tx ${hashDetail}` : undefined,
        href: `https://celoscan.io/tx/${txHash}`,
        state: "done",
      });
    }
  }
  if (isTryOn && meta.renderProvider) {
    steps.push({ id: "render", label: "I rendered the try-on", detail: meta.renderProvider, state: "done" });
  }
  if (isPurchase) {
    if (meta.orderId) {
      steps.push({
        id: "order",
        label: "I recorded the order",
        detail: `order ${meta.orderId.slice(0, 8)}`,
        state: "done",
      });
    }
    if (rail === "near" && meta.curatorPayout?.includes("direct to curator")) {
      steps.push({
        id: "payout",
        label: "The curator was paid in the same transfer",
        detail: meta.near?.payTo,
        state: "done",
      });
    } else if (rail === "paypal") {
      steps.push({
        id: "payout",
        label: "I logged the curator's payout as pending",
        detail: meta.curatorPayout,
        state: "done",
      });
    }
  }
  if (receipt.signature && receipt.agentId != null) {
    steps.push({
      id: "signed",
      label: "I signed this receipt",
      detail: `agent #${receipt.agentId} · ${shortHash(receipt.signature)}`,
      state: "done",
    });
  }

  const verdict = isPurchase
    ? "It's yours. This page is the proof — send it to anyone and they can check it."
    : isTryOn
      ? "Rendered and paid for. This page is the proof — send it to anyone and they can check it."
      : null;

  return { rail, lede, rows, steps, verdict };
}
