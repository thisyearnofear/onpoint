"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, Copy, ExternalLink,
  Shirt, Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { OnPointLayout } from "../../components/OnPointLayout";
import { AgentTrace } from "../../components/pay/AgentTrace";
import { Polaroid } from "../../components/pay/Polaroid";
import { Busy, ErrorState, StagedWait } from "../../components/state";
import { FactList, shortHash } from "../../components/surface/FactList";
import { buildTrace, type PayMethod, type TraceFacts } from "../../lib/pay/trace";

const DEMO_CURATOR = "onpoint-store";
const WALLET_SEND = "https://testnet.mynearwallet.com/send-money";

type Step = "photo" | "choose" | "pay" | "verify" | "done";

interface Listing { id: string; title: string; imageUrl: string | null; cutoutUrl?: string | null; priceKes: number | null }
interface NearQuote { network?: string; accountId?: string; amountNear?: number }
interface PaypalQuote { approveUrl?: string; orderId?: string; amountUsd?: number }
interface QuoteFacts { rails: string[]; ms: number; priceUsd?: number; paypal?: PaypalQuote | null; near?: NearQuote | null }
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

/** Try each URL in order (cutout first — dead R2 keys fall through), then a Shirt tile. */
function SmartImg({
  urls,
  alt = "",
  className,
  tileClassName,
}: {
  urls: (string | null | undefined)[];
  alt?: string;
  className: string;
  tileClassName: string;
}) {
  const sources = urls.filter((u): u is string => Boolean(u));
  const [failedCount, setFailedCount] = useState(0);
  const src = sources[failedCount];
  if (!src) {
    return (
      <div className={tileClassName}>
        <Shirt className="h-7 w-7 text-muted-foreground" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} onError={() => setFailedCount((n) => n + 1)} className={className} />
  );
}

const CTX_KEY = "onpoint-pay-context";
const PHOTO_KEY = "onpoint-pay-photo";

/** PayPal reasons meaning "the payer just hasn't approved yet" — keep checking allowed. */
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
 * agents run programmatically, dressed as "see it on you". The user is the
 * hero: piece on the left, their photo on the right, the render develops
 * as a polaroid. The agent's work shows as a first-person trace below the
 * action area; nothing advances on a timer and nothing is preselected.
 */
export default function PayPage() {
  const [step, setStep] = useState<Step>("photo");
  const [method, setMethod] = useState<PayMethod | null>(null);
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
  const pairRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);

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
      const priceUsd = data.quote?.priceCusd ?? data.priceCusd ?? undefined;
      const facts: QuoteFacts = {
        rails,
        ms,
        priceUsd,
        paypal: pp ? { orderId: pp.orderId, amountUsd: pp.amountUsd } : null,
        near: near ? { amountNear: near.amountNear, network: near.network } : null,
      };
      setQuote(near || null);
      setPaypal(pp || null);
      setQuoteFacts(facts);
      quotedIds.current = { curatorSlug, listingId: listingId ?? selected };
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
      // First upload gets one automatic quote — every call counts against
      // the API's per-IP cap, so later actions quote only on explicit taps.
      const ok = await getQuote(data);
      setPhotoLoading(false);
      if (ok) setStep("choose");
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
    const methodNow: PayMethod = opts?.method ?? method ?? "near";
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
        setStep("pay");
        polling.current = false;
        verifyIds.current = null;
        return;
      }
      setError(
        status === 429
          ? "I've checked too many times in a row — give it a minute, then tap “check again”. Your approval is safe."
          : data.error || `Something went wrong (${status}) — try again.`,
      );
      setStep("pay");
      polling.current = false;
      verifyIds.current = null;
      return;
    }
    setError(
      methodNow === "paypal"
        ? "PayPal couldn't confirm the approval — tap “I've approved — check again”."
        : "I can't see the payment on NEAR yet — give it a few seconds, then tap Verify again.",
    );
    setStep("pay");
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

  // Bring the active surface into view as the step changes — at 1280×900
  // the payment choices land below the fold without this.
  useEffect(() => {
    const behavior: ScrollBehavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    if (step === "choose") chooseRef.current?.scrollIntoView({ behavior, block: "center" });
    else if (step === "verify") pairRef.current?.scrollIntoView({ behavior, block: "center" });
    else if (step === "done") heroRef.current?.scrollIntoView({ behavior, block: "start" });
  }, [step]);

  const pickPiece = (newId: string) => {
    if (newId === selected) return;
    setSelected(newId);
    // A quote (and any PayPal order inside it) is bound to the listing it
    // was fetched for — switching pieces drops it. Never auto-quote: every
    // call counts against the API's per-IP cap.
    setQuote(null);
    setPaypal(null);
    setQuoteFacts(null);
    setMethod(null);
    paypalArmed.current = null;
    quotedIds.current = null;
    setError(null);
    setStep("photo");
    persistContext({ curatorSlug, listingId: newId, quote: null });
  };

  const active = listings.find((l) => l.id === selected);

  const phase: TraceFacts["phase"] =
    step === "done" ? "done"
      : step === "verify" ? "checking"
        : quoting ? "quoting"
          : step === "choose" || step === "pay" ? "awaiting" : "idle";

  const { steps: traceSteps, verdict } = buildTrace({
    listing: active ? { title: active.title, curatorSlug } : undefined,
    quote: quoteFacts,
    method: method ?? undefined,
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

  const price = paypal?.amountUsd ?? quoteFacts?.priceUsd;
  const railChoices = [
    {
      id: "paypal" as PayMethod,
      live: !!paypal,
      title: "PayPal",
      amount: paypal?.amountUsd != null ? `$${paypal.amountUsd}` : null,
      line: "Card or PayPal balance. You approve in a new tab.",
    },
    {
      id: "near" as PayMethod,
      live: !!quote?.amountNear,
      title: "NEAR",
      amount: quote?.amountNear != null ? `${quote.amountNear} NEAR` : null,
      line: "From a NEAR wallet. Goes straight to the seller.",
    },
  ].filter((r) => r.live);

  const trace = active && traceSteps.length > 0 ? (
    <div className="mt-8">
      <AgentTrace steps={traceSteps} verdict={step === "done" ? null : verdict} />
    </div>
  ) : null;

  return (
    <OnPointLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            See it on you
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Add a photo, pay a few cents for the render, and it develops right here.
            Sandbox and testnet — the rails are real, nothing costs real money.
          </p>
        </div>

        {/* ── Done: the polaroid is the hero ─────────────────────── */}
        {step === "done" && result ? (
          <div ref={heroRef} className="mt-8 space-y-6">
            <div className="mx-auto max-w-sm -rotate-1">
              {result.renderImage ? (
                <Polaroid src={result.renderImage} caption={active?.title ?? "Your try-on"} />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center bg-muted"><Shirt className="h-8 w-8 text-muted-foreground" /></div>
              )}
            </div>

            {verdict ? (
              <p className="border-l-2 border-foreground pl-3 font-display text-xl leading-snug">{verdict}</p>
            ) : null}

            <p className="text-sm text-muted-foreground">
              {result.payment?.paymentMethod === "paypal" || method === "paypal"
                ? `Paid${paypal?.amountUsd ? ` $${paypal.amountUsd}` : ""} through PayPal. The seller's payout is recorded on the receipt as pending reconciliation.`
                : `Paid${quote?.amountNear ? ` ${quote.amountNear}` : ""} NEAR, straight to the seller's account — verified against the chain.`}
            </p>

            <div className="flex flex-wrap gap-3">
              {result.polaroid?.webUrl ? (
                <a href={result.polaroid.webUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  Share the polaroid <ExternalLink className="h-4 w-4" />
                </a>
              ) : result.receiptUrl ? (
                <a href={result.receiptUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  Open the receipt <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              {result.polaroid?.webUrl && result.receiptUrl ? (
                <a href={result.receiptUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
                  Open the receipt <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setResult(null);
                  setQuote(null);
                  setPaypal(null);
                  setQuoteFacts(null);
                  setMethod(null);
                  paypalArmed.current = null;
                  setError(null);
                  setStep("photo");
                  window.scrollTo({ top: 0 });
                }}
                className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted"
              >
                Try another piece
              </button>
            </div>

            {result.polaroidWarning ? (
              <p className="text-sm text-muted-foreground">
                The render worked, but the shareable polaroid couldn&rsquo;t be saved — your receipt still has everything.
              </p>
            ) : null}

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

            {trace}
          </div>
        ) : (
          <>
            {/* ── The pair: the piece | you — visible until done ───── */}
            <div ref={pairRef} className="mt-6 grid grid-cols-2 gap-3">
              <div>
                <div className="relative aspect-[3/4] overflow-hidden border border-border bg-muted/20">
                  <SmartImg
                    key={active?.id}
                    urls={[active?.cutoutUrl, active?.imageUrl]}
                    alt={active?.title ?? "The piece"}
                    className="h-full w-full object-contain"
                    tileClassName="flex h-full items-center justify-center"
                  />
                </div>
                <p className="mt-2 text-sm font-bold leading-snug">{active?.title ?? "…"}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">from {curatorSlug}</p>
              </div>
              <div>
                {step === "verify" && photo ? (
                  // In verify the whole column IS the developing polaroid —
                  // no bordered frame around it, or the caption overflows.
                  <Polaroid src={photo} caption="Developing…" developing />
                ) : (
                <div className="relative aspect-[3/4] border border-border bg-muted/20">
                  {photo ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo} alt="You" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        className="absolute right-2 top-2 rounded-full bg-background/90 px-3 py-1.5 text-xs font-bold shadow-sm transition-colors hover:bg-background"
                      >
                        Change
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="group flex h-full w-full flex-col items-center justify-center gap-3 border-2 border-dashed border-border text-muted-foreground transition-all hover:border-foreground/40"
                    >
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-foreground/5 transition-transform group-hover:scale-105">
                        <Shirt className="h-6 w-6 text-foreground/60" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">Add your photo</span>
                      <span className="px-4 text-center text-xs">JPG or PNG · used once for this render</span>
                    </button>
                  )}
                </div>
                )}
                <p className="mt-2 text-sm font-bold leading-snug">You</p>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

            {/* ── Piece rail ─────────────────────────────────────── */}
            {listings.length > 1 ? (
              <div className="mt-5">
                <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Pieces</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {listings.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={l.id === selected}
                      disabled={quoting || step === "verify"}
                      onClick={() => pickPiece(l.id)}
                      aria-label={l.title}
                      title={l.title}
                      className={`shrink-0 overflow-hidden rounded-xl transition-all disabled:opacity-50 ${
                        l.id === selected ? "ring-2 ring-foreground" : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <SmartImg
                        urls={[l.cutoutUrl, l.imageUrl]}
                        alt={l.title}
                        className="h-14 w-14 object-cover"
                        tileClassName="flex h-14 w-14 items-center justify-center bg-muted"
                      />
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Step: photo (no quote yet) ─────────────────────── */}
            {step === "photo" && photo && !quoteFacts ? (
              <button
                type="button"
                disabled={quoting || photoLoading}
                onClick={async () => {
                  setError(null);
                  const ok = await getQuote(photo);
                  if (ok) setStep("choose");
                }}
                className="mt-6 w-full rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {quoting || photoLoading ? <Busy label="Getting the price" /> : "See this piece on me — get the price"}
              </button>
            ) : null}

            {/* ── Step: choose a rail ────────────────────────────── */}
            {step === "choose" ? (
              <div ref={chooseRef} className="mt-6 space-y-5">
                <h2 className="font-display text-xl">
                  {price != null ? `It's $${price.toFixed(2)}. How would you like to pay?` : "How would you like to pay?"}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {railChoices.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => { setMethod(r.id); setStep("pay"); }}
                      className="rounded-2xl border border-border bg-card px-5 py-4 text-left transition-all hover:border-foreground/50"
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="text-sm font-bold">{r.title}</span>
                        {r.amount ? <span className="font-mono text-sm">{r.amount}</span> : null}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">{r.line}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* ── Step: pay — only the chosen rail's panel ───────── */}
            {step === "pay" ? (
              <div className="mt-6 space-y-4">
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

                {method === "near" && quote ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-sm">
                        {quote.amountNear} NEAR to <span className="break-all">{quote.accountId}</span>
                      </p>
                      <button type="button" onClick={() => copy(quote.accountId!)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
                        {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                      </button>
                    </div>

                    {walletUrl ? (
                      <a href={walletUrl} className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                        <Wallet className="h-4 w-4" /> Pay {quote.amountNear} NEAR in MyNearWallet
                      </a>
                    ) : null}

                    {qrDataUrl ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-sm font-semibold text-primary underline-offset-2 hover:underline">Pay from my phone</summary>
                        <div className="mt-3 flex items-center gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={qrDataUrl} alt="Scan to pay" className="h-24 w-24 rounded-xl" />
                          <p className="text-xs text-muted-foreground">Opens the send page with the amount and address pre-filled.</p>
                        </div>
                      </details>
                    ) : null}

                    <details className="text-sm">
                      <summary className="cursor-pointer text-sm font-semibold text-primary underline-offset-2 hover:underline">I already paid</summary>
                      <div className="mt-3">
                        <div className="flex gap-2">
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
                        <p className="mt-2 text-xs text-muted-foreground">Just the hash — I read your account from the chain.</p>
                      </div>
                    </details>

                    <details className="text-sm">
                      <summary className="cursor-pointer text-sm font-semibold text-primary underline-offset-2 hover:underline">New to NEAR?</summary>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        <a href="https://testnet.mynearwallet.com" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">testnet.mynearwallet.com</a>{" "}
                        creates a pre-funded testnet wallet in 30 seconds.
                      </p>
                    </details>
                  </div>
                ) : null}

                <button
                  type="button"
                  onClick={() => { setMethod(null); paypalArmed.current = null; setStep("choose"); }}
                  className="text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
                >
                  Pay another way
                </button>
              </div>
            ) : null}

            {/* ── Step: verify — the polaroid develops ───────────── */}
            {step === "verify" ? (
              <div className="mt-6">
                <StagedWait
                  bare
                  title="Developing your try-on"
                  stages={[{ at: 0, label: "Payment check, render and fit read happen in one pass" }]}
                  lines={[
                    "Renders usually land in 15 to 40 seconds.",
                    "Your photo is used once for this render.",
                  ]}
                />
              </div>
            ) : null}

            {trace}
          </>
        )}

        {error ? (
          <ErrorState className="mt-5" message={error} onDismiss={() => setError(null)} />
        ) : null}
      </div>
    </OnPointLayout>
  );
}
