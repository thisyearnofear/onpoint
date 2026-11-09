"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Check, CheckCircle2, Copy, CreditCard, ExternalLink,
  HelpCircle, Loader2, Shirt, Wallet,
} from "lucide-react";
import QRCode from "qrcode";
import { OnPointLayout } from "../../components/OnPointLayout";

const DEMO_CURATOR = "onpoint-store";
const WALLET_SEND = "https://testnet.mynearwallet.com/send-money";

type Step = "photo" | "method" | "verify" | "done";
type Method = "near" | "paypal" | "card";

interface Listing { id: string; title: string; imageUrl: string | null; priceKes: number | null }
interface NearQuote { network?: string; accountId?: string; amountNear?: number }
interface PaypalQuote { approveUrl?: string; orderId?: string; amountUsd?: number }

const STEPS: { id: Step; label: string }[] = [
  { id: "photo", label: "Your photo" },
  { id: "method", label: "Choose payment" },
  { id: "verify", label: "Try-on ready" },
];

/**
 * Human front door to the payment rails — the same 402 → pay → verify flow
 * agents run programmatically, as a checkout. Method-agnostic: the tiles
 * render whatever the quote advertises (NEAR live, PayPal live, card soon).
 * The payer is derived from the transaction itself — one field max.
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
  const [quote, setQuote] = useState<NearQuote | null>(null);
  const [paypal, setPaypal] = useState<PaypalQuote | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const [paypalOrderId, setPaypalOrderId] = useState("");
  const [tick, setTick] = useState(0); // verify stage: 0 quoted,1 payment seen,2 rendering,3 done
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [selected, setSelected] = useState<string>("");
  const fileRef = useRef<HTMLInputElement>(null);
  const polling = useRef(false);
  const pendingPhoto = useRef<string | null>(null);

  const callRail = useCallback(async (extra: Record<string, string>, photoData?: string | null) => {
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curatorSlug,
        listingId: selected,
        photoData: photoData ?? photo,
        ...extra,
      }),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }, [photo, selected, curatorSlug]);

  const getQuote = useCallback(async (photoData: string, listingId?: string) => {
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curatorSlug, listingId: listingId ?? selected, photoData }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402) {
      const near = data.near || data.quote?.near || (Array.isArray(data.paymentRails) ? null : null);
      const pp = data.paypal || data.quote?.paypal;
      setQuote(near || null);
      setPaypal(pp || null);
      return true;
    }
    setError(data.error || `Couldn't fetch your payment options (${res.status}) — try again.`);
    return false;
  }, [selected, curatorSlug]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result);
      setPhoto(data);
      try { sessionStorage.setItem("onpoint-pay-photo", data); } catch { /* quota */ }
      setPhotoLoading(true);
      setError(null);
      const ok = await getQuote(data);
      setPhotoLoading(false);
      if (ok) setStep("method");
    };
    reader.readAsDataURL(file);
  };

  const startVerify = useCallback(async (extra: Record<string, string>) => {
    if (polling.current) return;
    polling.current = true;
    setError(null);
    setTick(1);
    setStep("verify");
    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline) {
      setTick((t) => Math.max(t, Date.now() - (deadline - 150_000) > 10_000 ? 2 : 1));
      const { status, data } = await callRail(extra, pendingPhoto.current ?? photo);
      if (status === 200 && (data.success || data.tryOn)) {
        setTick(3);
        setRender(data.tryOn?.render?.image || null);
        setStep("done");
        polling.current = false;
        return;
      }
      if (status !== 402) {
        setError(data.error || `Something went wrong (${status}) — try again.`);
        setStep("method");
        polling.current = false;
        return;
      }
      await new Promise((r) => setTimeout(r, 4000));
    }
    setError("Payment hasn't landed yet — check your wallet or approval, then retry.");
    setStep("method");
    polling.current = false;
  }, [callRail, photo]);

  // Restore a photo that survived a wallet/PayPal redirect; pick up returned proofs.
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
    try { stored = sessionStorage.getItem("onpoint-pay-photo"); } catch { /* ssr */ }
    if (stored && !photo) { setPhoto(stored); pendingPhoto.current = stored; }
    if (returned) {
      setTxHash(returned);
      window.history.replaceState({}, "", "/pay");
      if (stored) { void startVerify({ nearTxHash: returned }); }
      else setStep("photo");
    } else if (ppId) {
      setPaypalOrderId(ppId);
      setMethod("paypal");
      window.history.replaceState({}, "", "/pay");
      if (stored) { void startVerify({ paypalOrderId: ppId }); }
      else setStep("photo");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetch(`/api/pay/listings?curator=${encodeURIComponent(curatorSlug)}`)
      .then((r) => r.json())
      .then((d) => {
        const items = Array.isArray(d.listings) ? d.listings : [];
        setListings(items);
        const wanted = preselectListing.current;
        preselectListing.current = null;
        const match = wanted ? items.find((l: Listing) => l.id === wanted) : null;
        setSelected(match ? match.id : items[0]?.id ?? "");
      })
      .catch(() => {});
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
  const stepIdx = STEPS.findIndex((s) => s.id === (step === "done" ? "verify" : step));

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
            Upload a photo, pick a way to pay, and the try-on lands in about thirty seconds.
            Demo pricing on testnet — the payment rails are real, nothing here costs real money.
          </p>
        </div>

        {/* Progress */}
        <ol className="mt-6 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.id} className="flex flex-1 items-center gap-2">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  i < stepIdx || step === "done"
                    ? "bg-foreground text-background"
                    : i === stepIdx
                      ? "border-2 border-foreground text-foreground"
                      : "border border-border text-muted-foreground"
                }`}
              >
                {i < stepIdx || step === "done" ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={`text-xs font-medium ${i <= stepIdx || step === "done" ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
              {i < STEPS.length - 1 ? <span className="h-px flex-1 bg-border" /> : null}
            </li>
          ))}
        </ol>

        {/* Item card — the purchase, visible */}
        {active ? (
          <div className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
            {active.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={active.imageUrl} alt="" className="h-20 w-20 rounded-xl object-cover" />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-muted"><Shirt className="h-7 w-7 text-muted-foreground" /></div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug">{active.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Try-on render{quote?.amountNear ? ` · ${quote.amountNear} NEAR` : ""}{paypal?.amountUsd ? ` · $${paypal.amountUsd}` : ""}{active.priceKes ? ` · KES ${active.priceKes}` : ""}
              </p>
            </div>
            {listings.length > 1 ? (
              <select
                value={selected}
                onChange={(e) => setSelected(e.target.value)}
                className="ml-auto rounded-xl border border-border bg-background px-3 py-2 text-xs font-medium"
                aria-label="Choose a piece"
              >
                {listings.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
              </select>
            ) : null}
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
                    <button type="button" disabled={!txHash.trim()} onClick={() => startVerify({ nearTxHash: txHash.trim() })}
                      className="shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">
                      Verify
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Just the hash — we read your account from the chain.</p>
                </div>
              </div>
            ) : null}

            {/* PayPal body */}
            {method === "paypal" && paypal?.approveUrl ? (
              <div className="space-y-4">
                <a href={paypal.approveUrl} target="_blank" rel="noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  Approve {paypal.amountUsd ? `$${paypal.amountUsd}` : "payment"} on PayPal <ExternalLink className="h-4 w-4" />
                </a>
                <div className="rounded-2xl border border-border p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Approved it?</p>
                  <div className="mt-3 flex gap-2">
                    <input
                      value={paypalOrderId}
                      onChange={(e) => setPaypalOrderId(e.target.value)}
                      placeholder="paste the PayPal order id"
                      className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                      aria-label="PayPal order id"
                    />
                    <button type="button" disabled={!paypalOrderId.trim()} onClick={() => startVerify({ paypalOrderId: paypalOrderId.trim() })}
                      className="shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40">
                      Verify
                    </button>
                  </div>
                </div>
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

        {/* ── Step 3: verify — the wait, staged ──────────────────── */}
        {step === "verify" ? (
          <div className="mt-6 rounded-xl border border-border bg-card p-8">
            <ol className="mx-auto max-w-sm space-y-4">
              {["Payment quote locked in", "Payment seen on-chain", "Rendering your try-on", "Ready"].map((label, i) => (
                <li key={label} className="flex items-center gap-3">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                    tick > i ? "bg-foreground text-background" : tick === i ? "border-2 border-foreground" : "border border-border text-muted-foreground"
                  }`}>
                    {tick > i ? <Check className="h-3.5 w-3.5" /> : tick === i ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : i + 1}
                  </span>
                  <span className={`text-sm ${tick >= i ? "font-semibold text-foreground" : "text-muted-foreground"}`}>{label}</span>
                </li>
              ))}
            </ol>
            <p className="mt-6 text-center text-xs text-muted-foreground">Verified trustlessly on-chain — usually under 30 seconds.</p>
          </div>
        ) : null}

        {/* ── Done: the render is the hero ────────────────────────── */}
        {step === "done" ? (
          <div className="mt-6 space-y-5">
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {render ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={render} alt="Your try-on render" className="w-full" />
              ) : (
                <div className="flex h-64 items-center justify-center bg-muted"><Shirt className="h-8 w-8 text-muted-foreground" /></div>
              )}
              <div className="border-t border-border p-5">
                <p className="text-sm font-bold">That&rsquo;s you, wearing it.</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Paid {method === "near" && quote?.amountNear ? `${quote.amountNear} NEAR` : method === "paypal" ? "via PayPal" : ""} — verified on-chain, direct to the seller. No middleman took a cut.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/lab/try-on" className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                Try more pieces <ExternalLink className="h-4 w-4" />
              </Link>
              <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
                Back to wardrobe
              </Link>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mt-5 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
        ) : null}
      </div>
    </OnPointLayout>
  );
}
