"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, Loader2, Wallet } from "lucide-react";

type PayoutWalletStatus = "unset" | "platform_custodial" | "curator_owned";

interface WalletEditorProps {
  slug: string;
  initialWallet?: string | null;
  splitAddress?: string | null;
  payoutWalletStatus?: PayoutWalletStatus | null;
}

export function WalletEditor({
  slug,
  initialWallet,
  splitAddress,
  payoutWalletStatus,
}: WalletEditorProps) {
  const router = useRouter();
  const [wallet, setWallet] = useState(initialWallet || "");
  const [status, setStatus] = useState<PayoutWalletStatus>(payoutWalletStatus || "unset");
  const [uiStatus, setUiStatus] = useState<
    "idle" | "saving" | "splitting" | "provisioning" | "migrating" | "error" | "ok"
  >("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function saveWallet() {
    setUiStatus("saving");
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
        setUiStatus("error");
        setMessage(data.error || `Save failed (${res.status})`);
        return;
      }
      setUiStatus("ok");
      setStatus(data.curator?.commerce?.payoutWalletStatus || "curator_owned");
      setMessage(
        wallet.trim()
          ? "Wallet saved. Curator can receive agent cUSD payouts once they have live physical stock."
          : "Wallet cleared.",
      );
      router.refresh();
    } catch (err) {
      setUiStatus("error");
      setMessage(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function provisionCustodial() {
    setUiStatus("provisioning");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/provision-custodial-wallet`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUiStatus("error");
        setMessage(data.error || `Provision failed (${res.status})`);
        return;
      }
      setWallet(data.address || "");
      setStatus("platform_custodial");
      setUiStatus("ok");
      setMessage(
        data.alreadyExisted
          ? "Custodial wallet already existed — address refreshed in UI."
          : "Custodial payout wallet generated. Keys stay on the API host only.",
      );
      router.refresh();
    } catch (err) {
      setUiStatus("error");
      setMessage(err instanceof Error ? err.message : "Provision failed");
    }
  }

  async function migrateWallet() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())) {
      setUiStatus("error");
      setMessage("Enter a valid destination wallet before migrating.");
      return;
    }
    setUiStatus("migrating");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/migrate-payout-wallet`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ walletAddress: wallet.trim(), sweep: true }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUiStatus("error");
        setMessage(data.error || `Migration failed (${res.status})`);
        return;
      }
      setStatus("curator_owned");
      setUiStatus("ok");
      const swept = data.sweep?.txHash;
      setMessage(
        swept
          ? `Swept cUSD to curator wallet. Tx: ${swept}`
          : "Payout wallet migrated (no custodial balance to sweep).",
      );
      router.refresh();
    } catch (err) {
      setUiStatus("error");
      setMessage(err instanceof Error ? err.message : "Migration failed");
    }
  }

  async function setupSplit() {
    setUiStatus("splitting");
    setMessage(null);
    try {
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/setup-split`,
        { method: "POST" },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUiStatus("error");
        setMessage(data.error || `Split setup failed (${res.status})`);
        return;
      }
      setUiStatus("ok");
      setMessage(
        data.splitAddress
          ? `Split ready: ${data.splitAddress}`
          : "Split setup complete.",
      );
      router.refresh();
    } catch (err) {
      setUiStatus("error");
      setMessage(err instanceof Error ? err.message : "Split setup failed");
    }
  }

  const busy = uiStatus === "saving" || uiStatus === "splitting" || uiStatus === "provisioning" || uiStatus === "migrating";
  const valid =
    wallet.trim() === "" || /^0x[0-9a-fA-F]{40}$/.test(wallet.trim());

  const statusLabel =
    status === "platform_custodial"
      ? "Platform custodial"
      : status === "curator_owned"
        ? "Curator owned"
        : "Unset";

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm font-medium">
          <Wallet className="h-4 w-4 text-amber-500" />
          Payout wallet (Celo / MiniPay)
        </label>
        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
          {statusLabel}
        </span>
      </div>
      <input
        type="text"
        value={wallet}
        onChange={(e) => {
          setWallet(e.target.value);
          setUiStatus("idle");
          setMessage(null);
        }}
        placeholder="0x…"
        className="w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={provisionCustodial}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-500/15 disabled:opacity-50"
        >
          {uiStatus === "provisioning" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Generate custodial
        </button>
        <button
          type="button"
          onClick={saveWallet}
          disabled={busy || !valid}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          {uiStatus === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save wallet
        </button>
        <button
          type="button"
          onClick={migrateWallet}
          disabled={busy || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted/50 disabled:opacity-50"
        >
          {uiStatus === "migrating" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sweep + migrate
        </button>
        <button
          type="button"
          onClick={setupSplit}
          disabled={busy || status === "platform_custodial" || !/^0x[0-9a-fA-F]{40}$/.test(wallet.trim())}
          className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-bold hover:bg-muted/50 disabled:opacity-50"
          title={status === "platform_custodial" ? "Deploy split after curator owns their wallet" : undefined}
        >
          {uiStatus === "splitting" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {splitAddress ? "Refresh split" : "Setup 0xSplit"}
        </button>
      </div>
      {status === "platform_custodial" && (
        <p className="text-xs text-amber-700">
          Custodial bootstrap — skip 0xSplit until the curator claims their own wallet.
        </p>
      )}
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
            uiStatus === "error" ? "text-destructive" : "text-emerald-600"
          }`}
        >
          {uiStatus === "error" ? (
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
