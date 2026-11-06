"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Copy, ExternalLink, HelpCircle, QrCode, Sparkles, Wallet } from "lucide-react";
import QRCode from "qrcode";
import { OnPointLayout } from "../../components/OnPointLayout";

const DEMO_LISTING = "0cc69356-68f1-4466-86f8-9db6b440d70a"; // NEAR FC Home Kit — studio sample stock
const DEMO_CURATOR = "onpoint-store";
const WALLET_SEND = "https://testnet.mynearwallet.com/send-money";

type Step = "upload" | "pay" | "verifying" | "done";

interface NearQuote {
  network?: string;
  accountId?: string;
  amountNear?: number;
  amountYocto?: string;
}

/**
 * Human front door to the NEAR payment rail — the same 402 → pay → verify
 * flow agents run programmatically, rendered for a person with a wallet.
 * One field total: the payer is derived from the transaction on-chain.
 * Testnet, studio sample stock — the rails are real.
 */
export default function PayPage() {
  const [step, setStep] = useState<Step>("upload");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [quote, setQuote] = useState<NearQuote | null>(null);
  const [render, setRender] = useState<string | null>(null);
  const [txHash, setTxHash] = useState("");
  const [verifySince, setVerifySince] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const polling = useRef(false);

  const callRail = useCallback(
    async (extra: Record<string, string>) => {
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
    },
    [photo],
  );

  const getQuote = useCallback(async (photoData: string) => {
    const res = await fetch("/api/pay/try-on", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ curatorSlug: DEMO_CURATOR, listingId: DEMO_LISTING, photoData }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.status === 402 && (data.near || data.quote?.near)) {
      setQuote(data.near || data.quote.near);
      return true;
    }
    setError(data.error || `Couldn't fetch your payment quote (${res.status}) — try again.`);
    return false;
  }, []);

  // Warm the quote the moment the photo lands — perceived instant pay step.
  const onFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      const data = String(reader.result);
      setPhoto(data);
      // Survive the wallet redirect — try-on photo under the ~6MB API cap.
      try { sessionStorage.setItem("onpoint-pay-photo", data); } catch { /* quota */ }
      setPhotoLoading(true);
      setError(null);
      const ok = await getQuote(data);
      setPhotoLoading(false);
      if (ok) setStep("pay");
    };
    reader.readAsDataURL(file);
  };

  // Verify-and-render: retry on 402 (payment still finalizing), one request
  // returns the render once the transfer verifies.
  const startVerify = useCallback(
    async (hash: string) => {
      if (polling.current) return;
      polling.current = true;
      setError(null);
      setVerifySince(Date.now());
      setStep("verifying");
      const deadline = Date.now() + 120_000;
      while (Date.now() < deadline) {
        const { status, data } = await callRail({ nearTxHash: hash });
        if (status === 200 && (data.success || data.tryOn)) {
          setRender(data.tryOn?.render?.image || null);
          setStep("done");
          polling.current = false;
          return;
        }
        if (status !== 402) {
          setError(data.error || `Something went wrong (${status}) — try again.`);
          setStep("pay");
          polling.current = false;
          return;
        }
        await new Promise((r) => setTimeout(r, 4000));
      }
      setError("Payment hasn't landed on-chain yet — check your wallet, then retry the hash.");
      setStep("pay");
      polling.current = false;
    },
    [callRail],
  );

  // Wallet-redirect return: MyNearWallet appends ?transactionHashes= after send.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returned = params.get("transactionHashes");
    const storedPhoto = photo ?? (() => { try { return sessionStorage.getItem("onpoint-pay-photo"); } catch { return null; } })();
    if (storedPhoto && !photo) setPhoto(storedPhoto);
    if (returned) {
      setTxHash(returned);
      window.history.replaceState({}, "", "/pay");
      if (storedPhoto) { setPhoto(storedPhoto); startVerify(returned); }
      else setStep("upload");
    }
  }, [photo, startVerify]);

  // QR for mobile wallets — near:// send URI scannable by HOT / Meteor / MyNearWallet.
  useEffect(() => {
    if (!quote?.accountId || !quote?.amountNear) return;
    QRCode.toDataURL(`near://send?to=${quote.accountId}&amount=${quote.amountNear}`, { width: 220, margin: 1 })
      .then(setQrDataUrl)
      .catch(() => {});
  }, [quote]);

  const walletUrl = quote?.accountId && quote?.amountNear && typeof window !== "undefined"
    ? `${WALLET_SEND}/${quote.accountId}/${quote.amountNear}?success_url=${encodeURIComponent(`${window.location.origin}/pay?sent=1`)}`
    : null;

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* clipboard blocked */ }
  };

  const elapsed = verifySince ? Math.round((Date.now() - verifySince) / 1000) : 0;

  return (
    <OnPointLayout>
      <div className="mx-auto max-w-xl px-4 py-10">
        <Link href="/" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        <h1 className="font-display text-3xl font-semibold tracking-tight">Pay with NEAR</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The same rail AI agents pay on — opened for people. Try on the{" "}
          <span className="font-semibold text-foreground">NEAR FC home kit</span>, pay{" "}
          <span className="font-mono">0.0078 NEAR</span> (≈ $0.03) on testnet, get the render back.
          Studio sample stock; the rails are real.
        </p>

        {step === "upload" ? (
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
            {photoLoading ? <p className="text-center text-sm text-muted-foreground">Getting your payment quote…</p> : null}
          </div>
        ) : null}

        {step === "pay" && quote ? (
          <div className="mt-8 space-y-5">
            <div className="rounded-2xl border border-border bg-muted/40 p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your quote — HTTP 402</p>
              <p className="mt-3 font-mono text-2xl font-bold">{quote.amountNear} NEAR</p>
              <div className="mt-1 flex items-center gap-2">
                <p className="break-all font-mono text-sm text-muted-foreground">to {quote.accountId}</p>
                <button type="button" onClick={() => copy(quote.accountId!)} className="shrink-0 text-muted-foreground transition-colors hover:text-foreground" aria-label="Copy address">
                  {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">on NEAR {quote.network ?? "testnet"}</p>
            </div>

            {walletUrl ? (
              <a href={walletUrl} className="flex w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 py-3.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90">
                <Wallet className="h-4 w-4" /> Pay {quote.amountNear} NEAR in MyNearWallet
              </a>
            ) : null}

            {qrDataUrl ? (
              <div className="flex items-center gap-4 rounded-2xl border border-border p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrDataUrl} alt="Scan to pay with a NEAR wallet" className="h-28 w-28 rounded-xl" />
                <div>
                  <p className="text-sm font-semibold">Scan to pay</p>
                  <p className="mt-1 text-xs text-muted-foreground">Opens in any NEAR mobile wallet (HOT, Meteor, MyNearWallet) with the amount and address pre-filled.</p>
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-border p-5">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Already paid?</p>
              <div className="mt-3 flex gap-2">
                <input
                  value={txHash}
                  onChange={(e) => setTxHash(e.target.value)}
                  placeholder="paste the transaction hash"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-4 py-3 font-mono text-sm outline-none focus:border-foreground"
                  aria-label="NEAR transaction hash"
                />
                <button
                  type="button"
                  disabled={!txHash.trim()}
                  onClick={() => startVerify(txHash.trim())}
                  className="shrink-0 rounded-full bg-foreground px-5 py-3 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
                >
                  Verify
                </button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">One field — we read your account from the chain itself.</p>
            </div>

            <details className="rounded-2xl border border-dashed border-border px-4 py-3 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer items-center gap-2 font-semibold text-foreground">
                <HelpCircle className="h-4 w-4" /> New to NEAR?
              </summary>
              <p className="mt-2 text-xs leading-relaxed">
                <a href="https://testnet.mynearwallet.com" target="_blank" rel="noreferrer" className="font-semibold underline underline-offset-2">testnet.mynearwallet.com</a>{" "}
                creates a testnet wallet that arrives pre-funded — no faucet run needed. This whole page runs on testnet: nothing here costs real money.
              </p>
            </details>
          </div>
        ) : null}

        {step === "verifying" ? (
          <div className="mt-8 rounded-2xl border border-border bg-muted/40 p-8 text-center">
            <Sparkles className="mx-auto h-8 w-8 animate-pulse text-muted-foreground" />
            <p className="mt-3 text-sm font-semibold">
              {elapsed < 8 ? "Confirming your payment on-chain…" : "Payment confirmed — rendering your try-on…"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Trustless verification, then the render — usually under 30 seconds.</p>
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
