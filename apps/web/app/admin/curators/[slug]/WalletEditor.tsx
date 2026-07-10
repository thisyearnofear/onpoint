"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Wallet } from "lucide-react";

interface WalletEditorProps {
  slug: string;
  initialWallet?: string | null;
  splitAddress?: string | null;
}

export function WalletEditor({
  slug,
  initialWallet,
  splitAddress,
}: WalletEditorProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState(initialWallet || "");
  const [status, setStatus] = useState<"idle" | "saving" | "splitting" | "error" | "ok">(
    "idle",
  );
  const [message, setMessage] = useState<string | null>(null);

  async function saveWallet() {
    setStatus("saving");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/commerce`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet.trim() }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || `Save failed (${res.status})`);
        return;
      }
      setStatus("ok");
      setMessage(
        wallet.trim()
          ? "Wallet saved. Curator can receive agent cUSD payouts once they have live physical stock."
          : "Wallet cleared.",
      );
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function setupSplit() {
    setStatus("splitting");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/setup-split`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error || `Split setup failed (${res.status})`);
        return;
      }
      setStatus("ok");
      setMessage(
        data.splitAddress
          ? `Split ready: ${data.splitAddress}`
          : "Split setup complete.",
      );
      router.refresh();
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Split setup failed");
    }
  }

  const busy = status === "saving" || status === "splitting";
  const valid =
    wallet.trim() === "" || /^0x[0-9a-fA-F]{40}$/.test(wallet.trim());

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <Wallet className="h-4 w-4 text-amber-500" />
        Payout wallet (Celo / MiniPay)
      </label>
      <input
        type="text"
        value={wallet}
        onChange={(e) => {
          setWallet(e.target.value);
          setStatus("idle");
          setMessage(null);
        }}
        placeholder="0x…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={saveWallet}
          disabled={busy || !valid}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {status === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          Save wallet
        </button>
        <button
          type="button"
          onClick={setupSplit}
          disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted/50 disabled:opacity-50"
        >
          {status === "splitting" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          {splitAddress ? "Refresh split" : "Setup 0xSplit"}
        </button>
      </div>
      {!valid && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3" />
          Enter a valid 0x address (40 hex chars) or clear the field.
        </p>
      )}
      {splitAddress && (
        <p className="truncate text-xs text-muted-foreground font-mono">
          Split: {splitAddress}
        </p>
      )}
      {message && (
        <p
          className={`flex items-start gap-1.5 text-xs ${
            status === "error" ? "text-destructive" : "text-emerald-600"
          }`}
        >
          {status === "error" ? (
            <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          ) : (
            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          )}
          {message}
        </p>
      )}
    </div>
  );
}
