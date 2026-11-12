"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Copy, CreditCard, ExternalLink,
  HelpCircle, Loader2, Shirt, Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { OnPointLayout } from "../../components/OnPointLayout";
import { AgentTrace } from "../../components/pay/AgentTrace";
import { ErrorState } from "../../components/state";
import { FactList, shortHash } from "../../components/surface/FactList";
import { buildTrace, type PayMethod, type TraceFacts } from "../../lib/pay/trace";

const DEMO_CURATOR = "onpoint-store";
const WALLET_SEND = "https://testnet.mynearwallet.com/send-money";

type Step = "photo" | "method" | "verify" | "done";
type Method = PayMethod | "card";

interface Listing { id: string; title: string; imageUrl: string | null; cutoutUrl?: string | null; priceKes: number | null }
interface NearQuote { network?: string; accountId?: string; amountNear?: number }
interface PaypalQuote { approveUrl?: string; orderId?: string; amountUsd?: number }
interface QuoteFacts { rails: string[]; ms: number; paypal?: PaypalQuote | null; near?: NearQuote | null }
interface TryOnResult {
  requestMs: number;
  renderImage: string | null;
  payment?: { txHash?: string | null; explorerUrl?: string | null; paymentMethod?: string; amountCusd?: number };
  renderMeta?: { provider?: string; imageConditioned?: boolean };
  fitSignal?: { score?: number | null; confidence?: number | string | null; recommendedSize?: string | null } | null;
  aiCost?: { provider?: string; model?: string | null; costUsd?: number | string | null } | null;
  receiptId?: string | null;
  receiptUrl?: string | null;
  polaroid?: { imageUrl?: string; webUrl?: string } | null;
  polaroidWarning?: { reason?: string } | null;
  stylingTips?: string[];
}

function ItemThumb({ urls }: { urls: (string | null | undefined)[] }) {
  // Try each candidate in order (cutout first — dead R2 keys fall through
  // to the listing photo), then the placeholder tile.
  const sources = urls.filter((u): u is string => Boolean(u));
  const [failedCount, setFailedCount] = useState(0);
  const src = sources[failedCount];
  if (!src) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted"><Shirt className="h-7 w-7 text-muted-foreground" /></div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" onError={() => setFailedCount((n) => n + 1)} className="h-20 w-20 rounded-xl object-cover" />
  );
}

const CTX_KEY = "onpoint-pay-context";
const PHOTO_KEY = "onpoint-pay-photo";

/** PayPal reasons meaning "the payer just hasn't approved yet" — keep polling. */
const PAYPAL_PENDING_REASON = "not_approved";

function paypalReasonMessage(error: string): { keepPolling: boolean; message: string | null } {
  const m = /^PayPal payment not verified: (.+)$/.exec(error || "");
  if (!m) return { keepPolling: false, message: null };
  const reason = m[1] ?? "";
  if (reason === PAYPAL_PENDING_REASON) return { keepPolling: true, message: null };
  const friendly: Record<string, string> = {
    order_not_found: "PayPal couldn't find that order — use the approve link again and I'll pick it up.",
    reference_mismatch: "That approval was for a different order — approve the link on this page and I'll check again.",
    currency_mismatch: "That approval was for a different amount — approve the link on this page and I'll check again.",
    insufficient_amount: "That approval was for a different amount — approve the link on this page and I'll check again.",
    auth_failed: "The payment rail hiccuped on our side, not yours — try again in a minute.",
    capture_incomplete: "PayPal approved it but the capture didn't finish — nothing was taken twice. Check again in a moment.",
  };
  if (friendly[reason]) return { keepPolling: false, message: friendly[reason] };
  if (reason.startsWith("capture_failed_") || reason.startsWith("orders_get_")) {
    return { keepPolling: false, message: "PayPal didn't answer cleanly — nothing was taken twice. Check again in a moment." };
  }
  return { keepPolling: false, message: `PayPal couldn't verify the approval (${reason}) — approve the link and check again.` };
}

/**
 * Human front door to the payment rails — the same 402 → pay → verify flow
 * agents run programmatically, as a checkout. The agent's work shows as a
 * first-person trace whose every line is backed by real data; nothing
 * advances on a timer.
 */
export default function PayPage() {
  const [step, setStep] = useState<Step>("photo");
  const [method, setMethod] = useState<Method>("near");
  // Deep links (/pay?curator=&listing=) arrive from try-on upsells — the
  // render should be of the piece the visitor was just looking at.
  const [curatorSlug, setCuratorSlug] = useState<string>(DEMO_CURATOR);
  const preselectListing = useRef<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [quote, setQuote] = useState<NearQuote | null>(null);
  const [paypal, setPaypal] = useState<PaypalQuote | null>(null);
  const [quoteFacts, setQuoteFacts] = useState<QuoteFacts | null>(null);
  const [result, setResult] = useState<TryOnResult | null>(null);
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const polling = useRef(false);
  const pendingPhoto = useRef<string | null>(null);
  // Explicit ids a returned-proof verify is bound to — a wallet redirect
  // reloads the page before listings land, so state alone isn't reliable
  // there. Set only on the return path, cleared when a verify ends.
  const verifyIds = useRef<{ curatorSlug: string; listingId: string } | null>(null);
  // The {curatorSlug, listingId} the current quote was fetched for — verify
  // must send the same listing the PayPal/NEAR order is bound to.
  const quotedIds = useRef<{ curatorSlug: string; listingId: string } | null>(null);
  const paypalArmed = useRef<{ orderId: string; checks: number; last: number } | null>(null);

  const persistContext = useCallback((ctx: {
    curatorSlug: string;
    listingId: string;
    quote?: QuoteFacts | null;
  }) => {
    try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch { /* quota */ }
  }, []);

  const callRail = useCallback(async (
    extra: Record<string, string>,
    photoData?: string | null,
    ids?: { curatorSlug: string; listingId: string },
  ) => {
    const use = ids ?? verifyIds.current ?? { curatorSlug, listingId: selected };
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curatorSlug: use.curatorSlug,
        listingId: use.listingId,
        photoData: photoData ?? photo,
        ...extra,
      }),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }, [photo, selected, curatorSlug]);

  const getQuote = useCallback(async (photoData: string, listingId?: string) => {
    setQuoting(true);
    const started = performance.now();
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curatorSlug, listingId: listingId ?? selected, photoData }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) {
      const ms = Math.round(performance.now() - started);
      const near = data.near || data.quote?.near || null;
      const pp = data.paypal || data.quote?.paypal || null;
      const rails: string[] = Array.isArray(data.quote?.paymentRails)
        ? data.quote.paymentRails
        : Array.isArray(data.paymentRails) ? data.paymentRails : [];
      const facts: QuoteFacts = {
        rails,
        ms,
        paypal: pp ? { orderId: pp.orderId, amountUsd: pp.amountUsd } : null,
        near: near ? { amountNear: near.amountNear, network: near.network } : null,
      };
      setQuote(near || null);
      setPaypal(pp || null);
      setQuoteFacts(facts);
      quotedIds.current = { curatorSlug, listingId: listingId ?? selected };
      // Default to a rail that's actually live.
      if (!near && pp) setMethod("paypal");
      persistContext({ curatorSlug, listingId: listingId ?? selected, quote: facts });
      setQuoting(false);
      return true;
    }
    setQuoting(false);
    setError(data.error || `Couldn't fetch your payment options (${res.status}) — try again.`);
    return false;
  }, [selected, curatorSlug, persistContext]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result);
      setPhoto(data);
      try { sessionStorage.setItem(PHOTO_KEY, data); } catch { /* quota */ }
      setPhotoLoading(true);
      setError(null);
      const ok = await getQuote(data);
      setPhotoLoading(false);
      if (ok) setStep("method");
    };
    reader.readAsDataURL(file);
  };

  const startVerify = useCallback(async (
    extra: Record<string, string>,
    opts?: { method?: PayMethod; ids?: { curatorSlug: string; listingId: string } },
  ) => {
    if (polling.current) return;
    polling.current = true;
    setError(null);
    const methodNow: PayMethod = opts?.method ?? (method === "paypal" ? "paypal" : "near");
    if (opts?.method) setMethod(opts.method);
    const ids = opts?.ids ?? verifyIds.current ?? quotedIds.current ?? { curatorSlug, listingId: selected };
    // The API caps this endpoint at 5 requests a minute and 20 a day per
    // visitor, and every check counts — so never poll it. PayPal gets one
    // check per return to this tab (or per tap); NEAR gets three spaced
    // attempts while the transfer finalises.
    const waits = methodNow === "paypal" ? [] : [8000, 20000];
    setStep("verify");
    for (let attempt = 0; attempt <= waits.length; attempt++) {
      const callStart = performance.now();
      const { status, data } = await callRail(extra, pendingPhoto.current ?? photo, ids);
      if (status === 200 && (data.success || data.tryOn)) {
        setResult({
          requestMs: performance.now() - callStart,
          renderImage: data.tryOn?.render?.image || null,
          payment: data.payment || undefined,
          renderMeta: data.tryOn?.render
            ? { provider: data.tryOn.render.provider, imageConditioned: data.tryOn.render.imageConditioned }
            : undefined,
          fitSignal: data.tryOn?.fitSignal ?? null,
          aiCost: data.aiCost ?? null,
          receiptId: data.receiptId ?? null,
          receiptUrl: data.receiptUrl ?? null,
          polaroid: data.polaroid ?? null,
          polaroidWarning: data.polaroidWarning ?? null,
          stylingTips: Array.isArray(data.tryOn?.stylingTips) ? data.tryOn.stylingTips : [],
        });
        setStep("done");
        polling.current = false;
        verifyIds.current = null;
        try { sessionStorage.removeItem(CTX_KEY); sessionStorage.removeItem(PHOTO_KEY); } catch { /* */ }
        return;
      }
      if (status === 402) {
        const err = typeof data.error === "string" ? data.error : "";
        if (methodNow !== "paypal") {
          const wait = waits[attempt];
          if (wait === undefined) break;
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }
        const { keepPolling, message } = paypalReasonMessage(err);
        setError(
          keepPolling
            ? "PayPal says this isn't approved yet — finish there, and I'll check again when you come back to this tab."
            : message || err || "PayPal couldn't verify the approval — try again.",
        );
        setStep("method");
        polling.current = false;
        verifyIds.current = null;
        return;
      }
      setError(
        status === 429
          ? "I've checked too many times in a row — give it a minute, then tap “check again”. Your approval is safe."
          : data.error || `Something went wrong (${status}) — try again.`,
      );
      setStep("method");
      polling.current = false;
      verifyIds.current = null;
      return;
    }
    setError(
      methodNow === "paypal"
        ? "PayPal couldn't confirm the approval — tap “I've approved — check again”."
        : "I can't see the payment on NEAR yet — give it a few seconds, then tap Verify again.",
    );
    setStep("method");
    polling.current = false;
    verifyIds.current = null;
  }, [callRail, photo, method, curatorSlug, selected]);

  // After the approve click, check once each time the payer returns to this
  // tab — at most four automatic checks, eight seconds apart.
  const paypalOrderIdNow = paypal?.orderId;
  useEffect(() => {
    const onReturn = () => {
      const armed = paypalArmed.current;
      if (document.visibilityState !== "visible" || !armed || polling.current) return;
      if (armed.orderId !== paypalOrderIdNow || armed.checks >= 4 || Date.now() - armed.last < 8000) return;
      armed.checks += 1;
      armed.last = Date.now();
      void startVerify({ paypalOrderId: armed.orderId }, { method: "paypal", ids: quotedIds.current ?? undefined });
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [startVerify, paypalOrderIdNow]);

  // Restore a photo that survived a wallet redirect; pick up returned proofs.
  // The verify must use the persisted curator+listing — listings state hasn't
  // loaded yet on return, so `selected` would be "" here.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedCurator = params.get("curator");
    const wantedListing = params.get("listing");
    if (wantedCurator && /^[a-z0-9][a-z0-9-]{0,63}$/.test(wantedCurator)) {
      setCuratorSlug(wantedCurator);
    }
    if (wantedListing) preselectListing.current = wantedListing;
    const returned = params.get("transactionHashes") || params.get("tx");
    const ppId = params.get("paypalOrderId") || params.get("token");
    let stored: string | null = null;
    let storedCtx: { curatorSlug?: string; listingId?: string; quote?: QuoteFacts } | null = null;
    try {
      stored = sessionStorage.getItem(PHOTO_KEY);
      storedCtx = JSON.parse(sessionStorage.getItem(CTX_KEY) || "null");
    } catch { /* ssr */ }
    if (storedCtx?.quote) setQuoteFacts(storedCtx.quote);
    // Only a returned proof binds verify to stored ids — an ordinary reload
    // must not pin every later request to a stale listing.
    const ids = storedCtx?.curatorSlug && storedCtx?.listingId
      ? { curatorSlug: storedCtx.curatorSlug, listingId: storedCtx.listingId }
      : wantedCurator && wantedListing
        ? { curatorSlug: wantedCurator, listingId: wantedListing }
        : undefined;
    if (stored && !photo) { setPhoto(stored); pendingPhoto.current = stored; }
    if (returned) {
      setTxHash(returned);
      window.history.replaceState({}, "", "/pay");
      if (stored && ids) { verifyIds.current = ids; void startVerify({ nearTxHash: returned }, { method: "near", ids }); }
      else setStep("photo");
    } else if (ppId) {
      setMethod("paypal");
      window.history.replaceState({}, "", "/pay");
      if (stored && ids) { verifyIds.current = ids; void startVerify({ paypalOrderId: ppId }, { method: "paypal", ids }); }
      else setStep("photo");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let stale = false;
    setListings([]);
    setSelected("");
    fetch(`/api/pay/listings?curator=${encodeURIComponent(curatorSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (stale) return;
        const items = Array.isArray(d.listings) ? d.listings : [];
        setListings(items);
        const wanted = preselectListing.current;
        preselectListing.current = null;
        const match = wanted ? items.find((l: Listing) => l.id === wanted) : null;
        const picked = match ? match.id : items[0]?.id ?? "";
        setSelected(picked);
      })
      .catch(() => {});
    return () => { stale = true; };
  }, [curatorSlug]);

  const walletUrl = quote?.accountId && quote?.amountNear && typeof window !== "undefined"
    ? `${WALLET_SEND}/${quote.accountId}/${quote.amountNear}?success_url=${encodeURIComponent(`${window.location.origin}/pay?sent=1`)}`
    : null;

  useEffect(() => {
    if (!walletUrl) return;
    QRCode.toDataURL(walletUrl, { width: 240, margin: 1 }).then(setQrDataUrl).catch(() => {});
  }, [walletUrl]);

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* blocked */ }
  };

  const active = listings.find((l) => l.id === selected);

  const phase: TraceFacts["phase"] =
    step === "done" ? "done"
      : step === "verify" ? "checking"
        : quoting ? "quoting"
          : step === "method" ? "awaiting" : "idle";

  const { steps: traceSteps, verdict } = buildTrace({
    listing: active ? { title: active.title, curatorSlug } : undefined,
    quote: quoteFacts,
    method: method === "card" ? undefined : method,
    phase,
    result: result
      ? {
          requestMs: result.requestMs,
          payment: result.payment,
          render: result.renderMeta,
          fitSignal: result.fitSignal,
          aiCost: result.aiCost,
          receiptId: result.receiptId,
          receiptUrl: result.receiptUrl,
        }
      : undefined,
  });

  return (
    <OnPointLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {/* ── Hero: what you're buying + the journey ─────────────── */}
        <div className="mb-2">
          <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">Checkout</p>
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            See it on you, then pay for the render
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Upload a photo, pick a way to pay, and watch the work happen.
            Sandbox and testnet pricing — the rails are real, nothing here costs real money.
          </p>
        </div>

        {/* Item card — the purchase, visible */}
        {active ? (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            <ItemThumb key={active.id} urls={[active.cutoutUrl, active.imageUrl]} />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug">{active.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Try-on render{quote?.amountNear ? ` · ${quote.amountNear} NEAR` : ""}{paypal?.amountUsd ? ` · $${paypal.amountUsd}` : ""}{active.priceKes ? ` · KES ${active.priceKes}` : ""}
              </p>
            </div>
            {listings.length > 1 ? (
              <select
                value={selected}
                disabled={step === "verify" || quoting}
                onChange={(e) => {
                  const newId = e.target.value;
                  setSelected(newId);
                  // A quote (and any PayPal order inside it) is bound to the
                  // listing it was fetched for — switching pieces re-quotes.
                  if (quoteFacts && photo) {
                    setQuote(null);
                    setPaypal(null);
                    setQuoteFacts(null);
                    setError(null);
                    void getQuote(photo, newId);
                  } else {
                    persistContext({ curatorSlug, listingId: newId, quote: quoteFacts });
                  }
                }}
                className="ml-auto rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                aria-label="Choose a piece"
              >
                {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            ) : null}
          </div>
        ) : null}

        {/* The agent's work — the spine of the page from the offer onward */}
        {active ? (
          <div className="mt-6">
            <AgentTrace steps={traceSteps} verdict={verdict} />
          </div>
        ) : null}

        {/* ── Step 1: photo ──────────────────────────────────────── */}
        {step === "photo" ? (
          <div className="mt-6">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="group flex w-full flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed border-border bg-muted/40 px-6 py-16 text-muted-foreground transition-all hover:border-foreground/40"
            >
              {photo ? (
                <Image src={photo} alt="Your photo" width={140} height={140} unoptimized className="h-36 w-36 rounded-2xl object-cover shadow-lg" />
              ) : (
                <>
                  <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-foreground/5 transition-transform group-hover:scale-105">
                    <Shirt className="h-7 w-7 text-foreground/60" />
                  </span>
                  <span className="text-base font-semibold text-foreground">Drop in a photo of yourself</span>
                  <span className="text-xs">JPG or PNG · used once for your try-on render</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            {photoLoading ? (
              <p className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Getting your payment options…</p>
            ) : photo ? (
              <button
                type="button"
                onClick={async () => {
                  setPhotoLoading(true);
                  setError(null);
                  const ok = await getQuote(photo);
                  setPhotoLoading(false);
                  if (ok) setStep("method");
                }}
                className="mt-4 w-full rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background transition-opacity hover:opacity-90"
              >
                Continue with this photo
              </button>
            ) : null}
          </div>
        ) : null}

        {/* ── Step 2: method ─────────────────────────────────────── */}
        {step === "method" ? (
          <div className="mt-6 space-y-5">
            {/* Method tiles — agnostic: rendered from what the quote advertises */}
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Payment method">
              {[
                { id: "paypal" as Method, label: "PayPal", sub: paypal ? `$${paypal.amountUsd ?? "—"}` : "Card or balance", live: !!paypal, icon: CreditCard },
                { id: "near" as Method, label: "NEAR", sub: quote?.amountNear ? `${quote.amountNear} Ⓝ` : "crypto wallet", live: !!quote, icon: Wallet },
                { id: "card" as Method, label: "Card", sub: "soon", live: false, icon: CreditCard },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  role="radio"
                  aria-checked={method === m.id}
                  disabled={!m.live}
                  onClick={() => setMethod(m.id)}
                  className={`flex flex-col items-center gap-1.5 rounded-2xl border-2 px-3 py-4 transition-all ${
                    method === m.id && m.live
                      ? "border-foreground bg-card shadow-sm"
                      : m.live
                        ? "border-border bg-card/60 hover:border-foreground/50"
                        : "cursor-not-allowed border-border/60 bg-muted/30 opacity-50"
                  }`}
                >
                  <m.icon className="h-5 w-5" />
                  <span className="text-sm font-bold">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">{m.live ? m.sub : "coming soon"}</span>
                </button>
              ))}
            </div>

            {/* NEAR body */}
            {method === "near" && quote ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card p-5">
                  <div className="flex items-baseline justify-between">
                    <p className="font-mono text-2xl font-bold">{quote.amountNear} NEAR</p>
                    <p className="text-xs text-muted-foreground">on {quote.network ?? "testnet"}</p>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <p className="break-all font-mono text-xs text-muted-foreground">to {quote.accountId}</p>
                    <button type="button" onClick={() => copy(quote.accountId!)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
                      {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {walletUrl ? (
                  <a href={walletUrl} className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                    <Wallet className="h-4 w-4" /> Pay {quote.amountNear} NEAR in MyNearWallet
                  </a>
                ) : null}

                {qrDataUrl ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={qrDataUrl} alt="Scan to pay" className="h-24 w-24 rounded-xl" />
                    <div>
                      <p className="text-sm font-semibold">Or scan to pay on your phone</p>
                      <p className="mt-1 text-xs text-muted-foreground">Opens the send page with the amount and address pre-filled.</p>
                    </div>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Already paid?</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={txHash}
                      onChange={(e) => setTxHash(e.target.value)}
                      placeholder="paste the transaction hash"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                      aria-label="NEAR transaction hash"
                    />
                    <button type="button" disabled={!txHash.trim()} onClick={() => startVerify({ nearTxHash: txHash.trim() }, { method: "near", ids: quotedIds.current ?? undefined })}
                      className="shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">
                      Verify
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Just the hash — we read your account from the chain.</p>
                </div>
              </div>
            ) : null}

            {/* PayPal body — no order id to paste; the quote carries it */}
            {method === "paypal" && paypal?.approveUrl ? (
              <div className="space-y-4">
                <a href={paypal.approveUrl} target="_blank" rel="noreferrer"
                  onClick={() => {
                    if (paypal.orderId) paypalArmed.current = { orderId: paypal.orderId, checks: 0, last: 0 };
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  Approve {paypal.amountUsd ? `$${paypal.amountUsd}` : "payment"} on PayPal <ExternalLink className="h-4 w-4" />
                </a>
                <p className="text-xs text-muted-foreground">
                  PayPal asks you, not me — approve in the new tab, and I&rsquo;ll pick it up when you come back to this one.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    if (paypal.orderId) void startVerify({ paypalOrderId: paypal.orderId }, { method: "paypal", ids: quotedIds.current ?? undefined });
                  }}
                  className="text-sm font-semibold text-primary underline-offset-2 hover:underline"
                >
                  I&rsquo;ve approved — check again
                </button>
              </div>
            ) : null}

            <details className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-foreground">
                <HelpCircle className="h-4 w-4" /> New to NEAR?
              </summary>
              <p className="mt-2 text-xs leading-relaxed">
                <a href="https://testnet.mynearwallet.com" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">testnet.mynearwallet.com</a>{" "}
                creates a pre-funded testnet wallet in 30 seconds — or use PayPal above, no crypto needed.
              </p>
            </details>
          </div>
        ) : null}

        {/* ── Step 3: verify — the trace's pending row is the wait ── */}
        {step === "verify" ? (
          <p className="mt-4 text-xs text-muted-foreground">
            {method === "paypal"
              ? "Capture, render and fit read happen in one pass — usually under a minute."
              : "I verify the transfer against NEAR's own RPC, then render — usually under a minute."}
          </p>
        ) : null}

        {/* ── Done: the render is the hero ────────────────────────── */}
        {step === "done" && result ? (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {result.renderImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={result.renderImage} alt="Your try-on render" className="w-full" />
              ) : (
                <div className="flex h-64 items-center justify-center bg-muted"><Shirt className="h-8 w-8 text-muted-foreground" /></div>
              )}
              <div className="border-t border-border p-5">
                <p className="text-sm font-bold">That&rsquo;s you, wearing it.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {method === "paypal"
                    ? `Paid${paypal?.amountUsd ? ` $${paypal.amountUsd}` : ""} through PayPal. The seller's payout is recorded on the receipt as pending reconciliation.`
                    : `Paid${quote?.amountNear ? ` ${quote.amountNear}` : ""} NEAR, straight to the seller's account — verified against the chain.`}
                </p>
              </div>
            </div>

            <FactList
              rows={[
                result.fitSignal?.score != null ? { label: "Fit score", value: String(result.fitSignal.score) } : null,
                result.fitSignal?.recommendedSize ? { label: "Recommended size", value: result.fitSignal.recommendedSize } : null,
                result.renderMeta?.provider ? { label: "Render", value: result.renderMeta.provider } : null,
                result.aiCost?.costUsd != null
                  ? {
                      label: "AI cost",
                      value: `$${Number(result.aiCost.costUsd).toFixed(6)} via ${result.aiCost.provider ?? "provider"}${result.aiCost.model ? ` · ${result.aiCost.model}` : ""}`,
                      mono: true,
                    }
                  : null,
                result.payment?.txHash
                  ? {
                      label: "Payment",
                      value: shortHash(result.payment.txHash),
                      mono: true,
                      href: result.payment.explorerUrl ?? undefined,
                    }
                  : null,
                result.receiptUrl
                  ? { label: "Receipt", value: result.receiptId ?? "public receipt", href: result.receiptUrl }
                  : null,
              ].filter((r): r is NonNullable<typeof r> => r !== null)}
            />

            {result.stylingTips && result.stylingTips.length > 0 ? (
              <ul className="space-y-1.5">
                {result.stylingTips.slice(0, 3).map((tip, i) => (
                  <li key={i} className="text-sm text-muted-foreground">{tip}</li>
                ))}
              </ul>
            ) : null}

            <div className="flex flex-wrap gap-3">
              {result.receiptUrl ? (
                <a href={result.receiptUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  Open the receipt <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              {result.polaroid?.webUrl ? (
                <a href={result.polaroid.webUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
                  Share the polaroid <ExternalLink className="h-4 w-4" />
                </a>
              ) : result.polaroidWarning ? (
                <p className="text-sm text-muted-foreground">
                  The render worked, but the shareable polaroid couldn&rsquo;t be saved — your receipt still has everything.
                </p>
              ) : null}
              <Link href="/lab/try-on" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
                Try more pieces <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : null}

        {error ? (
          <ErrorState className="mt-5" message={error} onDismiss={() => setError(null)} />
        ) : null}
      </div>
    </OnPointLayout>
  );
}
