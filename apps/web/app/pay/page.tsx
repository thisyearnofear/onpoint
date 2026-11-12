"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, CheckCircle2, ChevronDown, Copy, ExternalLink, Home,
  Play, Shirt, Wallet,
} from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import QRCode from "qrcode";
import { OnPointLayout } from "../../components/OnPointLayout";
import { AgentTrace } from "../../components/pay/AgentTrace";
import { Polaroid } from "../../components/pay/Polaroid";
import { LimitNotice } from "../../components/pay/LimitNotice";
import { WaitDeck } from "../../components/pay/WaitDeck";
import { ShareArtifact } from "../../components/ShareArtifact";
import { TryOnActionRail } from "../../components/social/TryOnActionRail";
import { Busy, ErrorState, StagedWait } from "../../components/state";
import { FactList, shortHash } from "../../components/surface/FactList";
import { buildTrace, type PayMethod, type TraceFacts } from "../../lib/pay/trace";
import { guessOutcome } from "../../lib/pay/guess";
import { shouldAutoCheck } from "../../lib/pay/auto-check";
import { addKept, readKept, type Kept } from "../../lib/pay/kept";
import { classifyLimit, looksLeft, readLimit, type LimitKind } from "../../lib/pay/allowance";

const DEMO_CURATOR = "onpoint-store";
const WALLET_SEND = "https://testnet.mynearwallet.com/send-money";

type Step = "photo" | "choose" | "pay" | "verify" | "done";

interface Listing { id: string; title: string; imageUrl: string | null; cutoutUrl?: string | null; priceKes: number | null }
interface NearQuote { network?: string; accountId?: string; amountNear?: number }
interface PaypalQuote { approveUrl?: string; orderId?: string; amountUsd?: number }
interface QuoteFacts { rails: string[]; ms: number; priceUsd?: number; paypal?: PaypalQuote | null; near?: NearQuote | null; celo?: { amountCusd: number; payTo: string; chainId?: number } | null }
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
  const [celo, setCelo] = useState<QuoteFacts["celo"]>(null);
  const [guess, setGuess] = useState<number | null>(null);
  // The piece the user queued from the wait deck — becomes "Next: {title}"
  // on the done screen. No request is fired while it's only queued.
  const [queuedPieceId, setQueuedPieceId] = useState<string | null>(null);
  // The full trace sits collapsed behind "Show what I did" during verify.
  const [traceOpen, setTraceOpen] = useState(false);
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
  // Set the moment a result is showing — a verify must never fire again
  // after success (an armed-but-consumed PayPal order 402'd on every tab
  // focus and wiped the done screen, repeatedly → 429).
  const resultShown = useRef(false);
  const [keptList, setKeptList] = useState<Kept[]>([]);
  // Rough daily looks remaining, learned from X-RateLimit-* headers.
  const [dailyLooksLeft, setDailyLooksLeft] = useState<number | null>(null);
  // A 429 shown as a designed wait — never an ErrorState. `retried` marks
  // "the automatic retry already happened; offer a manual button instead".
  const [limited, setLimited] = useState<{
    kind: LimitKind;
    waitSec: number;
    action: "quote" | "check";
    safeApproval: boolean;
    retried: boolean;
  } | null>(null);
  // The action a limit paused — re-run once on expiry or on "Try again".
  const pendingAction = useRef<(() => void) | null>(null);
  const pairRef = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const othersRef = useRef<HTMLDivElement>(null);

  const persistContext = useCallback((ctx: {
    curatorSlug: string;
    listingId: string;
    quote?: QuoteFacts | null;
  }) => {
    try { sessionStorage.setItem(CTX_KEY, JSON.stringify(ctx)); } catch { /* quota */ }
  }, []);

  // The limiter reports its own accounting on every response — headers on
  // a non-429 describe the daily window (the daily limiter runs last).
  const trackLimits = useCallback((res: Response, data: unknown) => {
    const lim = readLimit(res.headers, data);
    if (res.status !== 429) {
      const n = looksLeft(lim.remaining, lim.limit);
      if (n != null) setDailyLooksLeft(n);
    }
    return lim;
  }, []);

  // The request was turned away. Show the wait as the state — the photo,
  // piece, quote and chosen rail all survive; the paused action is stashed
  // so the notice can re-run it once (auto for a breather, manual after).
  const hitLimit = useCallback((
    retryAfterSec: number | null,
    action: "quote" | "check",
    retry: () => void,
    retried: boolean,
    safeApproval: boolean,
  ) => {
    const sec = retryAfterSec ?? 60;
    pendingAction.current = retry;
    setLimited({
      kind: classifyLimit(sec),
      waitSec: sec,
      action,
      safeApproval,
      retried,
    });
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
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data, limits: trackLimits(res, data) };
  }, [photo, selected, curatorSlug, trackLimits]);

  const getQuote = useCallback(async (photoData: string, listingId?: string, fromRetry = false) => {
    setQuoting(true);
    const started = performance.now();
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curatorSlug, listingId: listingId ?? selected, photoData }),
    });
    const data = await res.json().catch(() => ({}));
    const limits = trackLimits(res, data);
    if (res.status === 429) {
      hitLimit(
        limits.retryAfterSec,
        "quote",
        () => void getQuote(photoData, listingId, true).then((ok) => { if (ok) setStep("choose"); }),
        fromRetry,
        paypalArmed.current != null,
      );
      setQuoting(false);
      setStep("photo");
      return false;
    }
    if (res.status === 402) {
      const ms = Math.round(performance.now() - started);
      const near = data.near || data.quote?.near || null;
      const pp = data.paypal || data.quote?.paypal || null;
      const rails: string[] = Array.isArray(data.quote?.paymentRails)
        ? data.quote.paymentRails
        : Array.isArray(data.paymentRails) ? data.paymentRails : [];
      const priceUsd = data.quote?.priceCusd ?? data.priceCusd ?? undefined;
      const payTo = data.quote?.payTo ?? data.payTo;
      const facts: QuoteFacts = {
        rails,
        ms,
        priceUsd,
        paypal: pp ? { orderId: pp.orderId, amountUsd: pp.amountUsd } : null,
        near: near ? { amountNear: near.amountNear, network: near.network } : null,
        celo: rails.includes("celo_cusd") && payTo && priceUsd != null
          ? { amountCusd: priceUsd, payTo, chainId: data.quote?.chainId ?? data.chainId }
          : null,
      };
      setCelo(facts.celo ?? null);
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
  }, [selected, curatorSlug, persistContext, trackLimits, hitLimit]);

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
    opts?: { method?: PayMethod; ids?: { curatorSlug: string; listingId: string }; fromRetry?: boolean },
  ) => {
    if (polling.current || resultShown.current || limited) return;
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
      const { status, data, limits } = await callRail(extra, pendingPhoto.current ?? photo, ids);
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
        resultShown.current = true;
        setLimited(null);
        pendingAction.current = null;
        // The order is consumed — disarm so a later tab focus can't fire
        // another verify with the already-captured id.
        paypalArmed.current = null;
        const webUrl = data.polaroid?.webUrl;
        if (webUrl && data.polaroid?.imageUrl) {
          const id = String(webUrl).split("/").filter(Boolean).pop() ?? "";
          if (id) {
            try {
              setKeptList(
                addKept(window.localStorage, {
                  id,
                  item: data.tryOn?.item ?? "Try-on",
                  imageUrl: data.polaroid.imageUrl,
                  webUrl,
                  receiptUrl: data.receiptUrl ?? null,
                  score: data.tryOn?.fitSignal?.score ?? null,
                  at: new Date().toISOString(),
                }),
              );
            } catch { /* storage optional */ }
          }
        }
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
      if (status === 429) {
        // The wait is the state — not an error. Return to the pay step the
        // check came from; the approval stays uncaptured and safe.
        hitLimit(
          limits.retryAfterSec,
          "check",
          () => void startVerify(extra, { method: methodNow, ids, fromRetry: true }),
          opts?.fromRetry ?? false,
          methodNow === "paypal" || paypalArmed.current != null,
        );
        setStep("pay");
        polling.current = false;
        verifyIds.current = null;
        return;
      }
      setError(data.error || `Something went wrong (${status}) — try again.`);
      setStep("pay");
      polling.current = false;
      verifyIds.current = null;
      return;
    }
    setError(
      methodNow === "paypal"
        ? "PayPal couldn't confirm the approval — tap “I've approved — check again”."
        : methodNow === "celo"
          ? "I can't see that transfer on Celo yet — give it a few seconds, then tap Verify again."
          : "I can't see the payment on NEAR yet — give it a few seconds, then tap Verify again.",
    );
    setStep("pay");
    polling.current = false;
    verifyIds.current = null;
  }, [callRail, photo, method, curatorSlug, selected, limited, hitLimit]);

  // After the approve click, check once each time the payer returns to this
  // tab — at most four automatic checks, eight seconds apart.
  const paypalOrderIdNow = paypal?.orderId;
  useEffect(() => {
    const onReturn = () => {
      const armed = paypalArmed.current;
      if (
        document.visibilityState !== "visible" ||
        !shouldAutoCheck({
          step,
          method,
          armed,
          polling: polling.current,
          limited: limited != null,
          now: Date.now(),
          currentOrderId: paypalOrderIdNow,
        })
      )
        return;
      armed!.checks += 1;
      armed!.last = Date.now();
      void startVerify({ paypalOrderId: armed!.orderId }, { method: "paypal", ids: quotedIds.current ?? undefined });
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, [startVerify, paypalOrderIdNow, step, method, limited]);

  // "Kept on this device" — read client-side only to avoid hydration drift.
  useEffect(() => {
    try { setKeptList(readKept(window.localStorage)); } catch { /* */ }
  }, []);

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

  const celoPayTo = celo?.payTo;
  const [celoQrDataUrl, setCeloQrDataUrl] = useState<string | null>(null);
  useEffect(() => {
    setCeloQrDataUrl(null);
    if (!celoPayTo) return;
    QRCode.toDataURL(celoPayTo, { width: 240, margin: 1 }).then(setCeloQrDataUrl).catch(() => {});
  }, [celoPayTo]);

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
    setCelo(null);
    setQuoteFacts(null);
    setMethod(null);
    setGuess(null);
    setQueuedPieceId(null);
    setTraceOpen(false);
    setResult(null);
    resultShown.current = false;
    paypalArmed.current = null;
    quotedIds.current = null;
    setLimited(null);
    pendingAction.current = null;
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
    {
      id: "celo" as PayMethod,
      live: !!celo,
      title: "cUSD on Celo",
      amount: celo ? `${celo.amountCusd} cUSD` : null,
      line: "From MiniPay, Valora or any Celo wallet. Live on Celo mainnet — real cents.",
    },
  ].filter((r) => r.live);

  const trace = active && traceSteps.length > 0 ? (
    <div className="mt-8">
      <AgentTrace steps={traceSteps} verdict={step === "done" ? null : verdict} />
    </div>
  ) : null;

  const polaroidPath = (() => {
    const u = result?.polaroid?.webUrl;
    if (!u) return null;
    try { return new URL(u).pathname; } catch { return u; }
  })();
  const otherListings = listings.filter((l) => l.id !== selected);
  const queuedListing = listings.find((l) => l.id === queuedPieceId) ?? null;
  const fitScore = result?.fitSignal?.score ?? null;
  const pendingTraceLabel = traceSteps.find((s) => s.state === "pending")?.label ?? null;
  const inVerify = step === "verify";
  const showPieceRail = listings.length > 1 && !inVerify;
  const paymentShort = result?.payment?.paymentMethod === "paypal" || method === "paypal"
    ? `Paid${paypal?.amountUsd ? ` $${paypal.amountUsd}` : ""} through PayPal`
    : result?.payment?.paymentMethod === "cusd" || method === "celo"
      ? `Paid${celo?.amountCusd != null ? ` ${celo.amountCusd}` : ""} cUSD on Celo`
      : `Paid${quote?.amountNear ? ` ${quote.amountNear}` : ""} NEAR`;

  const keptRow = keptList.length > 0 ? (
    <div>
      <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
        Your try-ons · on this device
      </p>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {keptList.map((k) => (
          <a key={k.id} href={k.webUrl} target="_blank" rel="noreferrer"
            className="w-[88px] shrink-0 bg-white p-1 pb-1.5 shadow-sm transition-transform hover:-translate-y-0.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={k.imageUrl} alt={k.item} className="h-[96px] w-[72px] object-cover" />
            <span className="mt-1 block truncate text-xs text-neutral-800">{k.item}</span>
          </a>
        ))}
      </div>
    </div>
  ) : null;

  const runPending = () => {
    const fn = pendingAction.current;
    pendingAction.current = null;
    setLimited(null);
    fn?.();
  };

  // The wait is the state — a breather counts down and picks the flow back
  // up once; a daily cap hands over real next actions instead of a button.
  const limitNotice = limited ? (
    <div className="space-y-4">
      <LimitNotice
        kind={limited.kind}
        waitSec={limited.waitSec}
        safeApproval={limited.safeApproval}
        autoRetry={limited.kind === "breather" && !limited.retried}
        onExpired={runPending}
        onRetry={runPending}
      >
        {limited.kind === "daily" ? (
          <div className="mt-3">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">Meanwhile</p>
            <div className="mt-1 flex flex-col items-start">
              <Link href="/runway" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-2 hover:underline">
                <Play className="h-4 w-4" /> Play today&rsquo;s Runway theme
              </Link>
              <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline-offset-2 hover:underline">
                <Home className="h-4 w-4" /> Open your wardrobe
              </Link>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">On a different network it will work straight away.</p>
          </div>
        ) : null}
      </LimitNotice>
      {limited.kind === "daily" ? keptRow : null}
    </div>
  ) : null;

  const allowanceHint = dailyLooksLeft === null || dailyLooksLeft > 3 || limited
    ? null
    : dailyLooksLeft === 0
      ? "This is the last one for today on this network."
      : `About ${dailyLooksLeft} look${dailyLooksLeft === 1 ? "" : "s"} left today on this network.`;

  // Staged reveal on done — the polaroid develops, then each line lands.
  // Reduced motion skips the delays entirely (everything immediate).
  const reduceMotion = useReducedMotion();
  const reveal = (delay: number) => ({
    initial: reduceMotion ? false : ({ opacity: 0, y: 6 } as const),
    animate: { opacity: 1, y: 0 },
    transition: reduceMotion ? { duration: 0 } : { delay, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <OnPointLayout>
      <div className="mx-auto max-w-2xl px-4 py-8 md:py-12">
        <Link href="/" className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <div className="mb-2">
          <h1 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
            See it on you
          </h1>
          {!inVerify && step !== "done" ? (
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Add a photo, pay a few cents for the render, and it develops right here.
              PayPal runs in sandbox and NEAR on testnet; cUSD on Celo is live and costs real cents.
            </p>
          ) : null}
        </div>

        {/* ── Done: the polaroid is the hero ─────────────────────── */}
        {step === "done" && result ? (
          <div ref={heroRef} className="mt-2 space-y-4">
            {/* 1 — the look: polaroid develops, then the lines land */}
            <div className="mx-auto max-w-[280px] -rotate-1">
              {result.renderImage ? (
                <Polaroid src={result.renderImage} caption={active?.title ?? "Your try-on"} />
              ) : (
                <div className="flex aspect-[3/4] items-center justify-center bg-muted"><Shirt className="h-8 w-8 text-muted-foreground" /></div>
              )}
            </div>

            <motion.div {...reveal(1.4)}>
              {verdict ? (
                <p className="border-l-2 border-foreground pl-3 font-display text-xl leading-snug">{verdict}</p>
              ) : null}
            </motion.div>

            <motion.div {...reveal(1.9)}>
              {(() => {
                const outcome = guessOutcome(guess, result.fitSignal?.score ?? null);
                return outcome ? <p className="text-sm">{outcome}</p> : null;
              })()}
            </motion.div>

            {/* 2 — the action row: send it, or line up the next piece */}
            <motion.div {...reveal(2.3)} className="space-y-2">
              {result.polaroid?.webUrl && polaroidPath ? (
                <div className="flex flex-wrap items-center gap-4">
                  <ShareArtifact
                    title={`${active?.title ?? "This piece"} — tried on with OnPoint`}
                    text={`Me in ${active?.title ?? "this piece"}${fitScore != null ? ` — fit ${fitScore}/10` : ""}`}
                    url={polaroidPath}
                    imageUrl={result.polaroid.imageUrl ?? null}
                    label="Send it"
                  />
                  {queuedListing ? (
                    <button
                      type="button"
                      onClick={() => { pickPiece(queuedListing.id); window.scrollTo({ top: 0 }); }}
                      className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                    >
                      Next: {queuedListing.title}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => othersRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" })}
                      className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                    >
                      Try another piece
                    </button>
                  )}
                  <a href={result.polaroid.webUrl} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline">
                    Its page <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {result.receiptUrl ? (
                    <a href={result.receiptUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline">
                      Receipt <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-3">
                  {result.polaroidWarning ? (
                    <p className="text-sm text-muted-foreground">
                      The render worked, but the shareable polaroid couldn&rsquo;t be saved — your receipt still has everything.
                    </p>
                  ) : null}
                  {result.receiptUrl ? (
                    <a href={result.receiptUrl} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline">
                      Receipt <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>
              )}
              <p className="text-xs text-muted-foreground">Kept on this device.</p>
            </motion.div>

            {/* 3 — same photo, another piece: one compact scrollable row */}
            <motion.div {...reveal(2.6)} className="space-y-4">
              {otherListings.length > 0 ? (
                <div ref={othersRef}>
                  <p className="mb-1 font-mono text-xs uppercase tracking-wider text-muted-foreground">
                    Same photo, another piece
                  </p>
                  <div className="flex gap-3 overflow-x-auto pb-1">
                    {[
                      ...(queuedListing ? [queuedListing] : []),
                      ...otherListings.filter((l) => l.id !== queuedPieceId),
                    ].slice(0, 6).map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { pickPiece(l.id); window.scrollTo({ top: 0 }); }}
                        className={`w-[72px] shrink-0 text-left transition-opacity ${
                          l.id === queuedPieceId ? "rounded-xl ring-2 ring-foreground" : "opacity-80 hover:opacity-100"
                        }`}
                      >
                        <SmartImg
                          urls={[l.cutoutUrl, l.imageUrl]}
                          alt={l.title}
                          className="h-14 w-14 rounded-xl object-cover"
                          tileClassName="flex h-14 w-14 items-center justify-center rounded-xl bg-muted"
                        />
                        <span className="mt-1 block truncate text-xs font-semibold">{l.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 4 — the detail shelves: hairline disclosures, previews only */}
              <div className="border-b border-border">
                <details className="group border-t border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-semibold">More to do</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      Challenge a friend · Remix · Save
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="pb-4">
                    <TryOnActionRail
                      curatorSlug={curatorSlug}
                      listingId={active?.id ?? ""}
                      itemTitle={active?.title ?? null}
                      imageUrl={result.polaroid?.imageUrl ?? result.renderImage}
                    />
                  </div>
                </details>

                <details className="group border-t border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-semibold">Payment and receipt</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {paymentShort}
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="space-y-4 pb-4">
                    <p className="text-sm text-muted-foreground">
                      {result.payment?.paymentMethod === "paypal" || method === "paypal"
                        ? `${paymentShort}. The seller's payout is recorded on the receipt as pending reconciliation.`
                        : result.payment?.paymentMethod === "cusd" || method === "celo"
                          ? `${paymentShort} — verified against the chain.`
                          : `${paymentShort}, straight to the seller's account — verified against the chain.`}
                    </p>
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
                  </div>
                </details>

                <details className="group border-t border-border">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-semibold">What I did</span>
                    <span className="flex items-center gap-2 text-xs text-muted-foreground">
                      {traceSteps.length} steps · {Math.round(result.requestMs / 1000)}s render
                      <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" />
                    </span>
                  </summary>
                  <div className="pb-4">
                    <AgentTrace steps={traceSteps} verdict={null} />
                  </div>
                </details>
              </div>
            </motion.div>
          </div>
        ) : (
          <>
            {/* ── Verify: one compact stage — developing polaroid | deck ── */}
            {step === "verify" ? (
              <div ref={pairRef} className="mt-6 grid grid-cols-[120px_1fr] items-start gap-4 sm:grid-cols-[minmax(0,180px)_1fr]">
                {photo ? (
                  <Polaroid src={photo} developing overlaySrc={active?.cutoutUrl ?? active?.imageUrl ?? undefined} />
                ) : (
                  <div />
                )}
                <WaitDeck
                  guess={guess}
                  onGuess={setGuess}
                  pieces={otherListings.slice(0, 4).map((l) => ({ id: l.id, title: l.title, urls: [l.cutoutUrl, l.imageUrl] }))}
                  queuedId={queuedPieceId}
                  onQueue={setQueuedPieceId}
                  kept={keptList}
                />
              </div>
            ) : (
            /* ── The pair: the piece | you — visible until done ───── */
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
                <p className="mt-2 text-sm font-bold leading-snug">You</p>
              </div>
            </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

            {/* ── Piece rail — hidden during verify (the deck owns the wait) ── */}
            {showPieceRail ? (
              <div className="mt-5">
                <p className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">Pieces</p>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {listings.map((l) => (
                    <button
                      key={l.id}
                      type="button"
                      aria-pressed={l.id === selected}
                      disabled={quoting || inVerify}
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
              <div className="mt-6 space-y-2">
                {limited ? (
                  limitNotice
                ) : (
                  <button
                    type="button"
                    disabled={quoting || photoLoading || !!limited}
                    onClick={async () => {
                      setError(null);
                      const ok = await getQuote(photo);
                      if (ok) setStep("choose");
                    }}
                    className="w-full rounded-full bg-foreground px-6 py-3.5 text-sm font-bold text-background transition-opacity hover:opacity-90 disabled:opacity-60"
                  >
                    {quoting || photoLoading ? <Busy label="Getting the price" /> : "See this piece on me — get the price"}
                  </button>
                )}
                {allowanceHint ? <p className="text-xs text-muted-foreground">{allowanceHint}</p> : null}
              </div>
            ) : null}

            {/* ── Step: choose a rail ────────────────────────────── */}
            {step === "choose" ? (
              <div ref={chooseRef} className="mt-6 space-y-5">
                <h2 className="font-display text-xl">
                  {price != null ? `It's $${price.toFixed(2)}. How would you like to pay?` : "How would you like to pay?"}
                </h2>
                {allowanceHint ? <p className="text-xs text-muted-foreground">{allowanceHint}</p> : null}
                <div className="grid gap-3 sm:grid-cols-3">
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
                {limitNotice}
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
                      disabled={!!limited}
                      onClick={() => {
                        if (paypal.orderId) void startVerify({ paypalOrderId: paypal.orderId }, { method: "paypal", ids: quotedIds.current ?? undefined });
                      }}
                      className="text-sm font-semibold text-primary underline-offset-2 hover:underline disabled:opacity-50"
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
                          <button type="button" disabled={!txHash.trim() || !!limited} onClick={() => startVerify({ nearTxHash: txHash.trim() }, { method: "near", ids: quotedIds.current ?? undefined })}
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

                {method === "celo" && celo ? (
                  <div className="space-y-4">
                    <p className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-xs text-warning">
                      This rail is live on Celo mainnet — it costs {celo.amountCusd} real cUSD.
                    </p>
                    <div>
                      <p className="text-sm">Send <span className="font-mono font-bold">{celo.amountCusd} cUSD</span> to</p>
                      <div className="mt-2 flex items-start gap-2">
                        <p className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground">{celo.payTo}</p>
                        <button type="button" onClick={() => copy(celo.payTo)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
                          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {celoQrDataUrl ? (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-sm font-semibold text-primary underline-offset-2 hover:underline">Show the address as a QR</summary>
                        <div className="mt-3 flex items-center gap-4">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={celoQrDataUrl} alt="Scan for the address" className="h-24 w-24 rounded-xl" />
                          <p className="text-xs text-muted-foreground">Scan for the address, then enter {celo.amountCusd} cUSD.</p>
                        </div>
                      </details>
                    ) : null}

                    <div>
                      <div className="flex gap-2">
                        <input
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                          placeholder="paste the transaction hash"
                          className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                          aria-label="Celo transaction hash"
                        />
                        <button type="button" disabled={!/^0x[0-9a-fA-F]{64}$/.test(txHash.trim()) || !!limited} onClick={() => startVerify({ paymentTxHash: txHash.trim() }, { method: "celo", ids: quotedIds.current ?? undefined })}
                          className="shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">
                          Verify
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Just the hash — I read the transfer from the chain.</p>
                    </div>
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

            {/* ── Step: verify — the wait, staged ────────────────── */}
            {step === "verify" ? (
              <div className="mt-6 min-w-0 space-y-6 overflow-hidden">
                <StagedWait
                  bare
                  className="min-w-0 !px-0"
                  title="Developing your try-on"
                  stages={[{ at: 0, label: "One pass: payment, render, fit" }]}
                  lines={[
                    "It's made from your actual photo and the actual garment image.",
                    "One request checks the payment, renders you, and reads the fit.",
                    "Renders usually land in 15 to 40 seconds.",
                    "Your photo is used once for this render.",
                    "The receipt is written the moment the render lands.",
                  ]}
                />
                {pendingTraceLabel ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">{pendingTraceLabel}</span>
                    {" · "}
                    <button
                      type="button"
                      aria-expanded={traceOpen}
                      onClick={() => setTraceOpen((v) => !v)}
                      className="font-semibold text-primary underline-offset-2 hover:underline"
                    >
                      {traceOpen ? "Hide what I did" : "Show what I did"}
                    </button>
                    {traceOpen ? trace : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Kept on this device — skipped while the daily notice shows
                the same row, and during verify (the deck owns the wait) */}
            {!inVerify && limited?.kind !== "daily" && keptRow ? <div className="mt-8">{keptRow}</div> : null}

            {!inVerify ? trace : null}
          </>
        )}

        {error ? (
          <ErrorState className="mt-5" message={error} onDismiss={() => setError(null)} />
        ) : null}
      </div>
    </OnPointLayout>
  );
}
