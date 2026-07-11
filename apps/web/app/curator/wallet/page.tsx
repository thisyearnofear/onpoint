"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2, Wallet } from "lucide-react";
import { CuratorPayoutWalletPanel } from "../../../components/Curator/CuratorPayoutWalletPanel";
import { fetchWalletStatus } from "../../../lib/services/curator-payout-wallet";
import { getApiBase } from "../../../lib/utils/api-base";

function WalletPageContent() {
  const searchParams = useSearchParams();
  const slug = (searchParams.get("slug") || "").toLowerCase();
  const [whatsapp, setWhatsapp] = useState(searchParams.get("whatsapp") || "");
  const [loading, setLoading] = useState(Boolean(slug));
  const [wallet, setWallet] = useState("");
  const [status, setStatus] = useState<"unset" | "platform_custodial" | "curator_owned">("unset");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchWalletStatus(getApiBase(), slug);
        if (cancelled) return;
        setWallet(data.walletAddress || "");
        setStatus(data.payoutWalletStatus || "unset");
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "Failed to load wallet");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <Link
        href="/curator"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to curator hub
      </Link>

      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-amber-500" />
          <h1 className="text-2xl font-black tracking-tight">Payout wallet</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Agent sales pay in cUSD on Celo. Set up once — no private keys to memorise.
        </p>
      </div>

      {!slug && (
        <div className="mt-8 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
          Add <code className="rounded bg-muted px-1">?slug=your-storefront</code> to this URL,
          or finish onboarding first.
        </div>
      )}

      {slug && (
        <div className="mt-8 space-y-6 rounded-2xl border border-border bg-card p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Storefront slug</label>
            <input
              value={slug}
              readOnly
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm font-mono"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium">WhatsApp (verification)</label>
            <input
              type="tel"
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="+254712345678"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary/50"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Must match the number on your curator profile — this is how we know it is you.
            </p>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading wallet status…
            </div>
          ) : loadError ? (
            <p className="text-sm text-destructive">{loadError}</p>
          ) : (
            <CuratorPayoutWalletPanel
              slug={slug}
              whatsapp={whatsapp}
              initialWallet={wallet}
              initialStatus={status}
              onWalletChange={(address, nextStatus) => {
                setWallet(address);
                setStatus(nextStatus);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default function CuratorWalletPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      }
    >
      <WalletPageContent />
    </Suspense>
  );
}
