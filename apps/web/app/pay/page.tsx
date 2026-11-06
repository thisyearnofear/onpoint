"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, QrCode, Sparkles, Wallet } from "lucide-react";
import { OnPointLayout } from "../../components/OnPointLayout";

const DEMO_LISTING = "0cc69356-68f1-4466-86f8-9db6b440d70a"; // NEAR FC Home Kit — studio sample stock
const DEMO_CURATOR = "onpoint-store";

type Step = "upload" | "quoting" | "pay" | "verifying" | "done" | "failed";

interface NearQuote {
  network?: string;
  accountId?: string;
  amountNear?: number;
  amountYocto?: string;
  instructions?: string;
}

/**
 * Human front door to the NEAR payment rail — the same flow agents use
 * programmatically, rendered for a person with a wallet:
 * upload a photo → get the 402 quote → pay from a NEAR wallet →
 * paste the tx hash → the try-on renders. Testnet, studio sample stock.
 */
export default function PayPage() {
  const [step, setStep] = useState<Step>("upload");
  const [photo, setPhoto] = useState<string | null>(null);
  const [quote, setQuote] = useState<NearQuote | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const [payerId, setPayerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const callRail = useCallback(async (extra: Record<string, string>) => {
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        curatorSlug: DEMO_CURATOR,
        listingId: DEMO_LISTING,
        photoData: photo,
        ...extra,
      }),
    });
    return { status: res.status, data: await res.json().catch(() => ({})) };
  }, [photo]);

  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setPhoto(String(reader.result));
    reader.readAsDataURL(file);
  };

  const getQuote = async () => {
    setError(null);
    setStep("quoting");
    const { status, data } = await callRail({});
    if (status === 402 && (data.near || data.quote?.near)) {
      setQuote(data.near || data.quote.near);
      setQuoteId(data.quoteId || data.quote?.quoteId || null);
      setStep("pay");
    } else {
      setError(data.error || `Unexpected response (${status}) — try again.`);
      setStep("upload");
    }
  };

  const verify = async () => {
    setError(null);
    setStep("verifying");
    const { status, data } = await callRail({
      nearAccountId: payerId.trim().toLowerCase(),
      nearTxHash: txHash.trim(),
      ...(quoteId ? { quoteId } : {}),
    });
    if (status === 200 && (data.tryOn?.render?.image || data.success)) {
      setRender(data.tryOn?.render?.image || null);
      setStep("done");
    } else {
      setError(data.error || "That payment didn't verify yet — the tx may still be finalizing. Try again in a few seconds.");
      setStep("pay");
    }
  };

  const copyPayTo = async () => {
    if (!quote?.accountId) return;
    try { await navigator.clipboard.writeText(quote.accountId); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const nearLink = quote?.accountId && quote?.amountNear
    ? `near://send?to=${quote.accountId}&amount=${quote.amountNear}`
    : null;

  return (
    <OnPointLayout>
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight">Pay with NEAR</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The same rail AI agents pay on — opened for people. Try on the NEAR FC home kit,
          pay in NEAR on testnet, get the render back. Studio sample stock; the rails are real.
        </p>

        {step === "upload" || step === "quoting" ? (
          <div className="mt-8 space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border bg-muted/40 px-6 py-14 text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
            >
              {photo ? (
                <Image src={photo} alt="Your photo" width={120} height={120} unoptimized className="h-28 w-28 rounded-xl object-cover" />
              ) : (
                <>
                  <QrCode className="h-8 w-8 opacity-50" />
                  <span className="text-sm font-semibold">Upload a photo of yourself</span>
                  <span className="text-xs opacity-70">JPG or PNG — used once for the try-on render</span>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            <button
              type="button"
              disabled={!photo || step === "quoting"}
              onClick={getQuote}
              className="w-full rounded-full bg-foreground py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
            >
              {step === "quoting" ? "Getting your NEAR quote…" : "Get my NEAR payment quote"}
            </button>
          </div>
        ) : null}

        {step === "pay" && quote ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your quote — 402</p>
              <p className="mt-3 font-mono text-2xl font-bold">{quote.amountNear} NEAR</p>
              <p className="mt-1 break-all font-mono text-sm text-muted-foreground">to {quote.accountId}</p>
              <p className="mt-2 text-xs text-muted-foreground">on NEAR {quote.network ?? "testnet"}</p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {nearLink ? (
                <a href={nearLink} className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                  <Wallet className="h-4 w-4" /> Pay in NEAR wallet
                </a>
              ) : null}
              <button type="button" onClick={copyPayTo} className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
                {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                {copied ? "Copied" : "Copy address"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Any NEAR wallet works — the deep link opens mobile wallets (HOT, Meteor, MyNearWallet).
              Or copy the address and send the amount manually.
            </p>

            <div className="rounded-2xl border border-border p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">After you pay</p>
              <div className="mt-3 space-y-3">
                <input
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  placeholder="your-account.testnet"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                  aria-label="Your NEAR account"
                />
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="transaction hash from your wallet"
                  className="w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                  aria-label="NEAR transaction hash"
                />
                <button
                  type="button"
                  disabled={!payerId.trim() || !txHash.trim()}
                  onClick={verify}
                  className="w-full rounded-full bg-foreground py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
                >
                  Verify payment &amp; render my try-on
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {step === "verifying" ? (
          <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">Verifying on-chain, then rendering…</p>
            <p className="mt-1 text-xs text-muted-foreground">JSON-RPC verification + the try-on render takes a moment.</p>
          </div>
        ) : null}

        {step === "done" ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-2xl border border-border p-5 text-center">
              <CheckCircle2 className="mx-auto h-8 w-8 text-success" />
              <p className="mt-3 text-sm font-bold">Payment verified — try-on rendered.</p>
              <p className="mt-1 text-xs text-muted-foreground">You paid the seller directly; the payment IS the proof.</p>
            </div>
            {render ? (
              <div className="overflow-hidden rounded-2xl border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={render} alt="Your try-on render" className="w-full" />
              </div>
            ) : null}
            <Link href="/lab/try-on" className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-3 text-sm font-bold transition-colors hover:bg-muted">
              Try the full fitting room <ExternalLink className="h-4 w-4" />
            </Link>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-xl border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</p>
        ) : null}
      </div>
    </OnPointLayout>
  );
}
