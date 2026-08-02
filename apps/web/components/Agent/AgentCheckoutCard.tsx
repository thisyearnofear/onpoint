"use client";

import { useState, useEffect, useRef } from "react";
import { imageFileToDataUrl } from "@repo/ai-client";
import {
  Camera,
  Shield,
  Check,
  Loader2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  Lock,
  KeyRound,
  ScanFace,
} from "lucide-react";

// ── Types (mirrors orderView from prava-facade.js) ──────────────────
interface OrderData {
  orderId: string;
  state: string;
  merchant: { name: string; url: string; country: string } | null;
  totalAmount: string | null;
  currency: string | null;
  garmentImageUrl: string | null;
  tryOnUrl: string | null;
  orderIdPrava: string | null;
  sandboxOrderId: string | null;
  selfCheckOrderId: string | null;
  paymentUrl: string | null;
  selfCheck: boolean;
  // true when the order uses Prava's REST sandbox rail (hosted card entry
  // + test card) rather than the CLI passkey flow.
  restMode: boolean;
  trust: {
    spendCeilingUsd: string;
    currency: string;
    merchantScope: { merchant: string; url: string; locked: boolean };
    credentialScope: string;
    approvalMethod: string;
    guardrails: string[];
  } | null;
}

interface Props {
  orderId: string;
  onConfirmed?: () => void;
  onReset?: () => void;
}

// A sample person photo for judges who don't want to upload their own.
const SAMPLE_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b1293a.jpg?auto=format&fit=crop&w=600&q=60";

const STATE_LABELS: Record<string, string> = {
  searching: "Finding your fit",
  quoted: "Quote ready",
  awaiting_approval: "Awaiting payment",
  try_on_ready: "Try-on ready",
  approved: "Approved",
  credential_ready: "Test credential ready",
  checking_out: "Placing order",
  confirmed: "✓ Order placed",
  sandbox_completed: "✓ Sandbox completed",
  self_check_completed: "✓ Self-check completed",
  failed: "Checkout failed",
};

const STATE_COLORS: Record<string, string> = {
  searching: "bg-muted text-muted-foreground",
  quoted: "bg-muted text-muted-foreground",
  awaiting_approval: "bg-primary/10 text-primary",
  try_on_ready: "bg-primary/10 text-primary",
  approved: "bg-primary/10 text-primary",
  credential_ready: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  checking_out: "bg-primary/10 text-primary",
  confirmed: "bg-green-500/10 text-green-600 dark:text-green-400",
  sandbox_completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  self_check_completed: "bg-muted text-muted-foreground",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

export function AgentCheckoutCard({ orderId, onConfirmed, onReset }: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll-driven order loop. The client drives the whole payment flow:
  //   1. GET  the order for its current state.
  //   2. While awaiting approval (or try-on ready), POST /poll — for a REST
  //      sandbox order this detects when the cardholder has entered their
  //      test card + device verification on Prava's hosted page; for self-check it
  //      completes instantly.
  //   3. Production CLI approval proceeds to checkout. REST sandbox stops at
  //      credential_ready until a real external processor outcome exists.
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const pollInFlight = useRef(false);
  const checkoutInFlight = useRef(false);
  const confirmedFired = useRef(false);

  useEffect(() => {
    let active = true;
    const doPoll = async () => {
      try {
        const r = await fetch(`/prava/order/${orderId}`);
        if (!r.ok || !active) return;
        const data = await r.json();
        setOrder(data);
        setLoading(false);

        if (data.state === "confirmed") {
          if (!confirmedFired.current) {
            confirmedFired.current = true;
            onConfirmedRef.current?.();
          }
          return;
        }

        // Detect the cardholder's payment completion while waiting.
        if (
          (data.state === "awaiting_approval" || data.state === "try_on_ready") &&
          !pollInFlight.current
        ) {
          pollInFlight.current = true;
          try {
            await fetch(`/prava/order/${orderId}/poll`, { method: "POST" });
          } finally {
            pollInFlight.current = false;
          }
          return; // re-read state next tick
        }

        // Payment approved → place the order automatically.
        if (data.state === "approved" && !checkoutInFlight.current) {
          checkoutInFlight.current = true;
          try {
            const cr = await fetch(`/prava/order/${orderId}/checkout`, { method: "POST" });
            const cdata = await cr.json();
            if (active) setOrder(cdata.order || cdata);
          } catch {
            // transient — retry next tick
          } finally {
            checkoutInFlight.current = false;
          }
        }
      } catch {
        if (active) setLoading(false);
      }
    };
    doPoll();
    const interval = setInterval(doPoll, 3000);
    return () => { active = false; clearInterval(interval); };
  }, [orderId]);

  // ── Try-on: upload photo or use sample ────────────────────────────
  const runTryOn = async (body: Record<string, string>) => {
    setPhotoLoading(true);
    setError(null);
    try {
      const r = await fetch(`/prava/order/${orderId}/try-on`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Try-on failed");
      setOrder(data.order || data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Try-on failed");
    } finally {
      setPhotoLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    try {
      const photoData = await imageFileToDataUrl(file);
      await runTryOn({ photoData });
    } catch {
      setError("Could not read that image. Try a JPG or PNG.");
      setPhotoLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden animate-pulse">
        <div className="h-24 bg-gradient-to-r from-primary/80 to-accent/80" />
        <div className="p-5 space-y-3">
          <div className="h-4 w-1/2 bg-muted rounded" />
          <div className="h-32 bg-muted rounded-lg" />
          <div className="h-4 w-3/4 bg-muted rounded" />
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card p-6 text-center text-muted-foreground">
        Order not found. <button onClick={onReset} className="text-primary underline">Search again</button>
      </div>
    );
  }

  const state = order.state || "searching";
  const showTryOn = !!order.tryOnUrl;
  const canApprove = state === "awaiting_approval" || state === "try_on_ready";
  const isConfirmed = state === "confirmed";
  const isSandboxCompleted = state === "sandbox_completed";
  const isSelfCheckCompleted = state === "self_check_completed";
  const isFailed = state === "failed";
  const isCredentialReady = state === "credential_ready";
  const isProcessing = state === "approved" || state === "checking_out" || state === "searching";
  const productImage = showTryOn ? order.tryOnUrl : order.garmentImageUrl;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-border/60 bg-card shadow-lg overflow-hidden">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-primary to-accent p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">OnPoint · Agent Outfitter</span>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_COLORS[state] || STATE_COLORS.searching}`}>
            {order.selfCheck && !isSelfCheckCompleted ? "Self-check fixture" : STATE_LABELS[state] || state}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="space-y-4 p-5">
        {/* Error */}
        {error && (
          <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Product / Try-on image */}
        {productImage ? (
          <div className="relative overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={productImage}
              alt={showTryOn ? "Try-on render" : "Product image"}
              className="aspect-[4/3] w-full object-cover"
            />
            {showTryOn && (
              <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[10px] font-medium text-white backdrop-blur-sm">
                How it looks on you · IDM-VTON
              </div>
            )}
          </div>
        ) : isProcessing ? (
          <div className="flex items-center justify-center rounded-xl bg-muted/40 py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">Composing your look…</p>
            </div>
          </div>
        ) : null}

        {/* Try-on upload (awaiting approval, no try-on yet) */}
        {canApprove && !showTryOn && !photoLoading && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Try it on before checkout</p>
            <div className="flex gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <Camera className="h-4 w-4" />
                Upload photo
              </button>
              <button
                onClick={() => runTryOn({ photoUrl: SAMPLE_PHOTO })}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-muted/40 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <ScanFace className="h-4 w-4" />
                Use sample
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>
        )}

        {photoLoading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Rendering try-on…</span>
          </div>
        )}

        {/* Quote */}
        {order.totalAmount && order.merchant && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="flex items-baseline justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">From</p>
                <p className="text-lg font-bold text-foreground">
                  ${order.totalAmount} <span className="text-sm font-normal text-muted-foreground">{order.currency}</span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">{order.merchant.name}</p>
                <p className="text-xs text-muted-foreground">
                  {order.restMode
                    ? "listed item price · sandbox session amount"
                    : order.selfCheck
                      ? "deterministic fixture amount"
                    : "incl. shipping & tax · binding quote"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Trust block */}
        {order.trust && (
          <div className="space-y-2 rounded-lg border border-primary/20 bg-primary/[0.03] p-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-primary">
              <Shield className="h-3.5 w-3.5" />
              Requested payment controls
            </div>
            <div className="space-y-1.5 text-sm">
              <TrustRow icon={<Lock className="h-3.5 w-3.5" />} label="Requested ceiling" value={`$${order.trust.spendCeilingUsd} ${order.trust.currency}`} />
              <TrustRow icon={<Lock className="h-3.5 w-3.5" />} label="Merchant request" value={order.trust.merchantScope.merchant} />
              <TrustRow icon={<KeyRound className="h-3.5 w-3.5" />} label="If issued" value="single-use, merchant-scoped" />
              <TrustRow icon={<ScanFace className="h-3.5 w-3.5" />} label="Required step" value={order.selfCheck ? "fixture only" : order.restMode ? "hosted card/device verification" : "passkey on your device"} />
            </div>
            <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
              {order.trust.guardrails.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Approve action — differs by payment rail */}
        {canApprove && order.restMode && order.paymentUrl ? (
          <div className="space-y-2">
            <a
              href={order.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <KeyRound className="h-4 w-4" /> Enter test card on Prava <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-center text-[11px] text-muted-foreground">
              Sandbox — no real money. The hosted flow advances to credential readiness;
              an external checkout outcome is still required.
            </p>
          </div>
        ) : canApprove ? (
          <button
            disabled
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white opacity-90"
          >
            <KeyRound className="h-4 w-4" /> {order.selfCheck ? "Self-check fixture" : "Approve with passkey"}
          </button>
        ) : null}

        {/* Processing state */}
        {isProcessing && !canApprove && !isConfirmed && !isFailed && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">
              {state === "searching" ? "Composing your look…" : "Placing your order…"}
            </span>
          </div>
        )}

        {isCredentialReady && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            Prava issued a sandbox credential. An external checkout must now be attempted before its real processor outcome can be reported. No merchant order or charge is claimed.
          </div>
        )}

        {/* Confirmed */}
        {(isConfirmed || isSandboxCompleted || isSelfCheckCompleted) && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-2.5 text-green-600 dark:text-green-400">
              <Check className="h-5 w-5 flex-shrink-0" />
              <div>
                <p className="text-sm font-bold">
                  {isSandboxCompleted
                    ? "Prava sandbox lifecycle completed"
                    : isSelfCheckCompleted
                      ? "Self-check completed"
                      : "Order placed"}
                </p>
                {isSandboxCompleted ? (
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    Test credential issued and outcome reported. No merchant charge.
                  </p>
                ) : isSelfCheckCompleted ? (
                  <p className="text-xs text-muted-foreground">
                    Deterministic fixture only. No credential, payment, or merchant order.
                  </p>
                ) : order.orderIdPrava ? (
                  <p className="text-xs text-green-600/80 dark:text-green-400/80">
                    Prava order {order.orderIdPrava}
                  </p>
                ) : null}
              </div>
            </div>
            {onReset && (
              <button
                onClick={onReset}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                Search again
              </button>
            )}
          </div>
        )}

        {/* Failed */}
        {isFailed && (
          <div className="space-y-2">
            <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">
              Checkout failed. The payment session may have expired.
            </div>
            {onReset && (
              <button
                onClick={onReset}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted active:scale-[0.98]"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border/40 px-5 py-3 text-center text-[10px] text-muted-foreground">
        {isConfirmed
          ? "Paid via Prava · scoped card · network-level controls"
          : isSandboxCompleted
            ? "Prava sandbox · test lifecycle · no real charge"
            : isSelfCheckCompleted
              ? "Self-check fixture · no transaction"
              : "Prava session requested · user approval required"}
      </div>
    </div>
  );
}

function TrustRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        {label}
      </span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
