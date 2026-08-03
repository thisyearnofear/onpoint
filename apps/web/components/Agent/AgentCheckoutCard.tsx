"use client";

import { useState, useEffect, useRef } from "react";
import { imageFileToDataUrl } from "@repo/ai-client";
import {
  AlertTriangle,
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
import type { SearchResult } from "./AgentSearchBar";

// ── Types (mirrors orderView from prava-facade.js) ──────────────────
interface OrderData {
  orderId: string;
  state: string;
  merchant: { name: string; url: string; country: string } | null;
  totalAmount: string | null;
  currency: string | null;
  quoteBreakdown: {
    source: string;
    subtotal: string | null;
    shipping: string | null;
    tax: string | null;
    total: string;
    currency: string;
    binding: boolean;
  } | null;
  garmentImageUrl: string | null;
  tryOnUrl: string | null;
  orderIdPrava: string | null;
  sandboxOrderId: string | null;
  selfCheckOrderId: string | null;
  paymentUrl: string | null;
  selfCheck: boolean;
  failure: {
    code?: string;
    message?: string;
    status?: number | null;
    details?: unknown;
    responseId?: string | null;
  } | null;
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
  selectedProduct?: SearchResult | null;
  onProgressChange?: (progress: { state: string; hasTryOn: boolean }) => void;
  onConfirmed?: () => void;
  onReset?: () => void;
}

// A sample person photo for judges who don't want to upload their own.
const SAMPLE_PHOTO =
  "https://images.unsplash.com/photo-1494790108377-be9c29b1293a.jpg?auto=format&fit=crop&w=600&q=60";

const STATE_LABELS: Record<string, string> = {
  searching: "Finding your fit",
  quoted: "Quote ready",
  creating_session: "Requesting permission",
  awaiting_approval: "Awaiting Prava approval",
  try_on_ready: "Try-on ready",
  approved: "Approved",
  credential_ready: "Test credential ready",
  checking_out: "Placing order",
  checkout_unknown: "Checkout outcome unknown",
  confirmed: "✓ Order placed",
  sandbox_completed: "✓ Sandbox completed",
  sandbox_declined: "✓ Sandbox decline verified",
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
  checkout_unknown: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  confirmed: "bg-green-500/10 text-green-600 dark:text-green-400",
  sandbox_completed: "bg-green-500/10 text-green-600 dark:text-green-400",
  sandbox_declined: "bg-green-500/10 text-green-600 dark:text-green-400",
  self_check_completed: "bg-muted text-muted-foreground",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const OUTCOME_STATES = [
  "credential_ready",
  "checkout_unknown",
  "confirmed",
  "sandbox_completed",
  "sandbox_declined",
  "self_check_completed",
  "failed",
];

function OutcomeLedger({
  state,
  hasTryOn,
}: {
  state: string;
  hasTryOn: boolean;
}) {
  const merchantOutcome =
    state === "confirmed"
      ? { label: "Order confirmed", tone: "text-green-600 dark:text-green-400" }
      : state === "sandbox_declined"
        ? {
            label: "Decline reported",
            tone: "text-green-600 dark:text-green-400",
          }
        : state === "checkout_unknown"
          ? {
              label: "Unknown · stopped safely",
              tone: "text-amber-700 dark:text-amber-300",
            }
          : state === "credential_ready" || state === "sandbox_completed"
            ? {
                label: "No merchant order claimed",
                tone: "text-muted-foreground",
              }
            : state === "failed"
              ? {
                  label: "Not completed",
                  tone: "text-red-600 dark:text-red-400",
                }
              : { label: "Fixture only", tone: "text-muted-foreground" };

  const pravaOutcome =
    state === "credential_ready" ||
    state === "checkout_unknown" ||
    state === "sandbox_completed" ||
    state === "sandbox_declined"
      ? {
          label: "Credential generated · successful",
          tone: "text-green-600 dark:text-green-400",
        }
      : state === "confirmed"
        ? { label: "Authorized", tone: "text-green-600 dark:text-green-400" }
        : state === "failed"
          ? { label: "Not completed", tone: "text-red-600 dark:text-red-400" }
          : { label: "No transaction", tone: "text-muted-foreground" };

  return (
    <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
        <div>
          <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-primary">
            Mission receipt
          </p>
          <p className="mt-0.5 text-sm font-bold">
            What happened, boundary by boundary
          </p>
        </div>
        {state === "checkout_unknown" ? (
          <AlertTriangle className="h-5 w-5 text-amber-500" />
        ) : (
          <Check className="h-5 w-5 text-green-500" />
        )}
      </div>
      <div className="divide-y divide-border/40 px-4">
        <OutcomeRow
          label="Fit decision"
          value={hasTryOn ? "Try-on completed" : "Continued without try-on"}
        />
        <OutcomeRow
          label="Prava"
          value={pravaOutcome.label}
          tone={pravaOutcome.tone}
        />
        <OutcomeRow
          label="Merchant"
          value={merchantOutcome.label}
          tone={merchantOutcome.tone}
        />
      </div>
    </div>
  );
}

export function AgentCheckoutCard({
  orderId,
  selectedProduct,
  onProgressChange,
  onConfirmed,
  onReset,
}: Props) {
  const [order, setOrder] = useState<OrderData | null>(null);
  const [loading, setLoading] = useState(true);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [permissionLoading, setPermissionLoading] = useState(false);
  const [continueWithoutTryOn, setContinueWithoutTryOn] = useState(false);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Poll-driven order loop. The client drives the whole payment flow:
  //   1. GET  the order for its current state.
  //   2. While awaiting approval, POST /poll — for a REST
  //      sandbox order this detects when the cardholder has entered their
  //      test card + device verification on Prava's hosted page; for self-check it
  //      completes instantly.
  //   3. Production CLI approval proceeds to checkout. REST sandbox stops at
  //      credential_ready until a real external processor outcome exists.
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
  const pollInFlight = useRef(false);
  const confirmedFired = useRef(false);

  useEffect(() => {
    let active = true;
    const doPoll = async () => {
      try {
        const r = await fetch(`/prava/order/${orderId}`);
        const data = await r.json();
        if (!r.ok)
          throw new Error(data.error || `Order refresh failed (${r.status})`);
        if (!active) return;
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
          data.state === "awaiting_approval" &&
          data.paymentUrl &&
          !pollInFlight.current
        ) {
          pollInFlight.current = true;
          try {
            const pr = await fetch(`/prava/order/${orderId}/poll`, {
              method: "POST",
            });
            const pdata = await pr.json();
            if (!pr.ok)
              throw new Error(
                pdata.error || `Payment poll failed (${pr.status})`,
              );
          } finally {
            pollInFlight.current = false;
          }
          return; // re-read state next tick
        }
      } catch (e: unknown) {
        if (active) {
          setError(e instanceof Error ? e.message : "Order refresh failed");
          setLoading(false);
        }
      }
    };
    doPoll();
    const interval = setInterval(doPoll, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [orderId]);

  useEffect(() => {
    if (!order) return;
    onProgressChange?.({ state: order.state, hasTryOn: !!order.tryOnUrl });
  }, [onProgressChange, order]);

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

  const requestPermission = async () => {
    setPermissionLoading(true);
    setError(null);
    try {
      const r = await fetch(`/prava/order/${orderId}/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fitDecision: order?.tryOnUrl
            ? "try_on_completed"
            : "continue_without_try_on",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || "Permission request failed");
      setOrder(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Permission request failed");
    } finally {
      setPermissionLoading(false);
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
      <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg animate-pulse">
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
      <div className="mx-auto max-w-xl rounded-2xl border border-border/60 bg-card p-6 text-center text-muted-foreground">
        Order not found.{" "}
        <button onClick={onReset} className="text-primary underline">
          Search again
        </button>
      </div>
    );
  }

  const state = order.state || "searching";
  const showTryOn = !!order.tryOnUrl;
  const canCheckFit = state === "quoted" || state === "try_on_ready";
  const canApprove = state === "awaiting_approval";
  const isConfirmed = state === "confirmed";
  const isSandboxCompleted = state === "sandbox_completed";
  const isSandboxDeclined = state === "sandbox_declined";
  const isSelfCheckCompleted = state === "self_check_completed";
  const isFailed = state === "failed";
  const isCheckoutUnknown = state === "checkout_unknown";
  const isCredentialReady = state === "credential_ready";
  const isProcessing =
    state === "approved" ||
    state === "checking_out" ||
    state === "searching" ||
    state === "creating_session";
  const garmentImage = order.garmentImageUrl || selectedProduct?.image || null;
  const productImage = showTryOn ? order.tryOnUrl : garmentImage;

  return (
    <div className="mx-auto max-w-xl overflow-hidden rounded-2xl border border-border/60 bg-card shadow-lg">
      {/* Header */}
      <div className="relative bg-gradient-to-r from-primary to-accent p-4 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="text-sm font-semibold">
              OnPoint · Agent Outfitter
            </span>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATE_COLORS[state] || STATE_COLORS.searching}`}
          >
            {order.selfCheck && !isSelfCheckCompleted
              ? "Self-check fixture"
              : STATE_LABELS[state] || state}
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

        {/* The selected garment remains visible after try-on so the mission never loses identity. */}
        {productImage ? (
          <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-muted/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={
                showTryOn && compareOriginal
                  ? garmentImage || productImage
                  : productImage
              }
              alt={
                showTryOn && !compareOriginal
                  ? "Try-on render"
                  : "Selected product"
              }
              className="aspect-[4/3] w-full object-cover transition-all duration-300"
            />
            {showTryOn && (
              <>
                <div className="absolute left-3 top-3 rounded-full border border-white/15 bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white backdrop-blur-md">
                  {compareOriginal
                    ? "Original product"
                    : "Fit preview · IDM-VTON"}
                </div>
                {garmentImage && (
                  <button
                    type="button"
                    onPointerDown={() => setCompareOriginal(true)}
                    onPointerUp={() => setCompareOriginal(false)}
                    onPointerCancel={() => setCompareOriginal(false)}
                    onPointerLeave={() => setCompareOriginal(false)}
                    onKeyDown={(event) => {
                      if (event.key === " " || event.key === "Enter") {
                        setCompareOriginal(true);
                      }
                    }}
                    onKeyUp={() => setCompareOriginal(false)}
                    className="absolute bottom-3 right-3 flex items-center gap-2 rounded-full border border-white/15 bg-black/70 px-3 py-2 text-[10px] font-bold text-white shadow-lg backdrop-blur-md transition-transform active:scale-95"
                  >
                    <span className="h-2 w-2 rounded-full bg-fuchsia-300" />
                    Hold to compare
                  </button>
                )}
              </>
            )}
          </div>
        ) : isProcessing ? (
          <div className="flex items-center justify-center rounded-xl bg-muted/40 py-12">
            <div className="text-center">
              <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                Composing your look…
              </p>
            </div>
          </div>
        ) : null}

        {/* Try-on upload (awaiting approval, no try-on yet) */}
        {canCheckFit &&
          !showTryOn &&
          !photoLoading &&
          !continueWithoutTryOn && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">
                Try it on before checkout
              </p>
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
            <span className="ml-2 text-sm text-muted-foreground">
              Rendering try-on…
            </span>
          </div>
        )}

        {/* Binding quote */}
        {order.totalAmount && order.merchant && (
          <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {order.quoteBreakdown?.binding
                  ? "Binding quote"
                  : "Prepared quote"}
              </p>
              <p className="text-xs text-muted-foreground">
                {order.quoteBreakdown?.source || order.merchant.name}
              </p>
            </div>
            {order.quoteBreakdown?.subtotal && (
              <div className="space-y-1 text-sm">
                <QuoteRow label="Item" value={order.quoteBreakdown.subtotal} />
                {order.quoteBreakdown.shipping != null && (
                  <QuoteRow
                    label="Shipping"
                    value={order.quoteBreakdown.shipping}
                  />
                )}
                {order.quoteBreakdown.tax != null && (
                  <QuoteRow label="Tax" value={order.quoteBreakdown.tax} />
                )}
              </div>
            )}
            <div className="mt-2 flex items-baseline justify-between border-t border-border/40 pt-2">
              <p className="text-sm font-medium text-foreground">
                Requested ceiling
              </p>
              <p className="text-lg font-bold text-foreground">
                ${order.quoteBreakdown?.total || order.totalAmount}{" "}
                <span className="text-sm font-normal text-muted-foreground">
                  {order.currency}
                </span>
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Quote prepared · nothing charged
            </p>
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
              <TrustRow
                icon={<Lock className="h-3.5 w-3.5" />}
                label="Requested ceiling"
                value={`$${order.trust.spendCeilingUsd} ${order.trust.currency}`}
              />
              <TrustRow
                icon={<Lock className="h-3.5 w-3.5" />}
                label="Merchant requested"
                value={order.trust.merchantScope.merchant}
              />
              <TrustRow
                icon={<KeyRound className="h-3.5 w-3.5" />}
                label={isCredentialReady ? "Observed credential" : "If issued"}
                value={
                  isCredentialReady
                    ? "single-use · scoped · server-held"
                    : "single-use · merchant-scoped"
                }
              />
              <TrustRow
                icon={<ScanFace className="h-3.5 w-3.5" />}
                label="Required step"
                value={
                  order.selfCheck
                    ? "fixture only"
                    : order.restMode
                      ? "hosted card/device verification"
                      : "passkey on your device"
                }
              />
            </div>
            <ul className="ml-5 list-disc space-y-0.5 text-xs text-muted-foreground">
              {order.trust.guardrails.map((g) => (
                <li key={g}>{g}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Approve action — differs by payment rail */}
        {canCheckFit && !showTryOn && !continueWithoutTryOn && (
          <button
            type="button"
            onClick={() => setContinueWithoutTryOn(true)}
            className="min-h-[44px] w-full text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Continue without try-on
          </button>
        )}

        {canCheckFit &&
          (showTryOn || continueWithoutTryOn) &&
          !order.paymentUrl && (
            <div className="space-y-3 rounded-2xl border border-primary/25 bg-[linear-gradient(135deg,hsl(var(--primary)/0.08),transparent)] p-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-white shadow-md shadow-primary/20">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    Fit decision made. Scope ready to seal.
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {showTryOn
                      ? "Try-on completed"
                      : "Continuing without try-on"}{" "}
                    · {order.merchant?.name}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
                  <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Merchant
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold">
                    {order.trust?.merchantScope.merchant ||
                      order.merchant?.name}
                  </p>
                </div>
                <div className="rounded-xl border border-border/50 bg-background/80 px-3 py-2.5">
                  <p className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                    Maximum
                  </p>
                  <p className="mt-1 text-xs font-semibold">
                    ${order.trust?.spendCeilingUsd || order.totalAmount}{" "}
                    {order.currency}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={requestPermission}
                disabled={permissionLoading}
                className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-60"
              >
                {permissionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="h-4 w-4" />
                )}
                Request exact-scope permission
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Prava creates the permission session only now. Nothing has been
                charged.
              </p>
            </div>
          )}

        {canApprove && order.restMode && order.paymentUrl ? (
          <div className="space-y-2">
            <a
              href={order.paymentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white transition-all hover:bg-primary/90 active:scale-[0.98]"
            >
              <KeyRound className="h-4 w-4" /> Enter test card on Prava{" "}
              <ArrowRight className="h-4 w-4" />
            </a>
            <p className="text-center text-[11px] text-muted-foreground">
              Sandbox — no real money. The hosted flow advances to credential
              readiness; an external checkout outcome is still required.
            </p>
          </div>
        ) : canApprove && order.paymentUrl ? (
          <button
            disabled
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-bold text-white opacity-90"
          >
            <KeyRound className="h-4 w-4" />{" "}
            {order.selfCheck ? "Self-check fixture" : "Approve with passkey"}
          </button>
        ) : null}

        {/* Processing state */}
        {isProcessing &&
          !canApprove &&
          !isConfirmed &&
          !isFailed &&
          !isCheckoutUnknown && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">
                {state === "searching"
                  ? "Composing your look…"
                  : state === "creating_session"
                    ? "Requesting permission…"
                    : "Placing your order…"}
              </span>
            </div>
          )}

        {OUTCOME_STATES.includes(state) && (
          <OutcomeLedger state={state} hasTryOn={showTryOn} />
        )}

        {isCredentialReady && (
          <div className="rounded-lg bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            Prava issued a sandbox credential. An external checkout must now be
            attempted before its real processor outcome can be reported. No
            merchant order or charge is claimed.
          </div>
        )}

        {isCheckoutUnknown && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-700 dark:text-amber-300">
            <p className="font-semibold">Checkout outcome unknown</p>
            <p className="mt-1 text-xs leading-relaxed">
              The automation attempt timed out after credential issuance.
              OnPoint stopped, did not retry, and reported no processor status.
              No merchant order or charge is claimed.
            </p>
          </div>
        )}

        {isSandboxDeclined && (
          <div className="rounded-lg bg-green-500/10 px-3 py-2.5 text-sm text-green-700 dark:text-green-300">
            End-merchant checkout was attempted with the sandbox credential and
            declined as expected. The real decline was reported to Prava; no
            charge or merchant order is claimed.
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
                    Test credential issued and outcome reported. No merchant
                    charge.
                  </p>
                ) : isSelfCheckCompleted ? (
                  <p className="text-xs text-muted-foreground">
                    Deterministic fixture only. No credential, payment, or
                    merchant order.
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
              {order.failure?.code
                ? `${order.failure.code}: ${order.failure.message || "Prava hosted flow failed"}`
                : "Prava hosted flow failed before credential issuance."}
              {order.failure?.responseId && (
                <span className="mt-1 block text-xs">
                  Support reference: {order.failure.responseId}
                </span>
              )}
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
              : state === "quoted" || state === "try_on_ready"
                ? "Binding quote · permission not requested"
                : "Prava session requested · user approval required"}
      </div>
    </div>
  );
}

function TrustRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
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

function QuoteRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span>${value}</span>
    </div>
  );
}

function OutcomeRow({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-semibold ${tone}`}>{value}</span>
    </div>
  );
}
