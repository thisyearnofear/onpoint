"use client";

import { useCallback, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Mail,
  Smartphone,
  Wallet,
} from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { getMiniPayAddress, isMiniPayEnvironment } from "../../lib/utils/minipay";
import {
  isValidCuratorWhatsapp,
  isValidPayoutAddress,
  migrateCuratorWallet,
  provisionCustodialWallet,
  type PayoutWalletProvider,
  type PayoutWalletStatus,
  walletFromApiResponse,
} from "../../lib/services/curator-payout-wallet";
import { connectMagicPayoutWallet, isMagicConfigured } from "../../lib/services/magic-wallet";

interface CuratorPayoutWalletPanelProps {
  slug: string;
  whatsapp: string;
  initialWallet?: string;
  initialStatus?: PayoutWalletStatus;
  onWalletChange?: (address: string, status: PayoutWalletStatus) => void;
  compact?: boolean;
  /** When true, custodial provision is deferred until curator profile exists (onboarding). */
  deferApi?: boolean;
  onRequestCustodial?: () => void;
}

export function CuratorPayoutWalletPanel({
  slug,
  whatsapp,
  initialWallet = "",
  initialStatus = "unset",
  onWalletChange,
  compact,
  deferApi,
  onRequestCustodial,
}: CuratorPayoutWalletPanelProps) {
  const [wallet, setWallet] = useState(initialWallet);
  const [status, setStatus] = useState<PayoutWalletStatus>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"magic" | "provision" | "minipay" | "migrate" | null>(null);

  const apiBase = getApiBase();
  const canAct = Boolean(slug && isValidCuratorWhatsapp(whatsapp));
  const magicEnabled = isMagicConfigured();

  const applyWallet = useCallback(
    (address: string, nextStatus: PayoutWalletStatus, note?: string) => {
      setWallet(address);
      setStatus(nextStatus);
      onWalletChange?.(address, nextStatus);
      setMessage(note || "Payout wallet updated.");
      setError(null);
    },
    [onWalletChange],
  );

  async function persistWallet(
    address: string,
    provider: PayoutWalletProvider,
    localMessage: string,
  ) {
    if (deferApi || !canAct) {
      applyWallet(address, "curator_owned", localMessage);
      return;
    }
    setBusy(provider === "magic" ? "magic" : provider === "minipay" ? "minipay" : "migrate");
    setError(null);
    setMessage(null);
    try {
      const data = await migrateCuratorWallet(apiBase, slug, whatsapp, address, provider);
      const mapped = walletFromApiResponse(data);
      applyWallet(mapped.address, mapped.status, data.message || localMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save wallet");
    } finally {
      setBusy(null);
    }
  }

  async function connectMagic() {
    setBusy("magic");
    setError(null);
    setMessage(null);
    try {
      const address = await connectMagicPayoutWallet();
      await persistWallet(
        address,
        "magic",
        "Your payout wallet is ready — sign in with the same email to access it later.",
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Magic sign-in failed");
      setBusy(null);
    }
  }

  async function provisionCustodial() {
    if (!canAct) {
      setError("Add your WhatsApp number with country code first.");
      return;
    }
    if (deferApi) {
      onRequestCustodial?.();
      setMessage("We will create your payout wallet when you submit your storefront.");
      setError(null);
      return;
    }
    setBusy("provision");
    setError(null);
    setMessage(null);
    try {
      const data = await provisionCustodialWallet(apiBase, slug, whatsapp);
      const mapped = walletFromApiResponse(data);
      applyWallet(mapped.address, mapped.status, data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Provision failed");
    } finally {
      setBusy(null);
    }
  }

  async function connectMiniPay() {
    setBusy("minipay");
    setError(null);
    setMessage(null);
    try {
      if (!isMiniPayEnvironment()) {
        throw new Error(
          "Open this page in MiniPay on your phone, or paste your MiniPay address below.",
        );
      }
      const address = await getMiniPayAddress();
      if (!address) throw new Error("Could not read your MiniPay address.");
      await persistWallet(address, "minipay", "MiniPay wallet linked for agent payouts.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "MiniPay connect failed");
      setBusy(null);
    }
  }

  async function migrateManual() {
    if (!isValidPayoutAddress(wallet)) {
      setError("Enter a valid 0x address first.");
      return;
    }
    await persistWallet(wallet.trim(), "manual", "Wallet saved for agent payouts.");
  }

  const statusLabel =
    status === "platform_custodial"
      ? "OnPoint holding payouts for you"
      : status === "curator_owned"
        ? "Your wallet"
        : "Not set";

  const optionClass =
    "flex items-start gap-3 rounded-xl border p-3 text-left transition-colors disabled:opacity-50";

  return (
    <div className={compact ? "space-y-3" : "space-y-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            status === "curator_owned"
              ? "bg-success/10 text-success"
              : status === "platform_custodial"
                ? "bg-warning/10 text-warning"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {statusLabel}
        </span>
        {wallet && (
          <code className="truncate max-w-full rounded bg-muted px-2 py-1 text-[11px] font-mono">
            {wallet}
          </code>
        )}
      </div>

      <p className="text-xs leading-5 text-muted-foreground">
        AI agents pay in cUSD when they buy your stock. No seed phrases — email, MiniPay,
        or a quick OnPoint-held wallet until you are ready.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {magicEnabled && (
          <button
            type="button"
            onClick={connectMagic}
            disabled={Boolean(busy)}
            className={`${optionClass} border-indigo-500/25 bg-indigo-500/5 hover:bg-indigo-500/10 sm:col-span-2`}
          >
            <Mail className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            <span>
              <span className="block text-sm font-bold">Email or Google — recommended</span>
              <span className="mt-1 block text-xs text-muted-foreground">
                Invisible wallet on Celo. You own the payouts; no seed phrase to save.
              </span>
            </span>
            {busy === "magic" && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
          </button>
        )}

        <button
          type="button"
          onClick={connectMiniPay}
          disabled={Boolean(busy)}
          className={`${optionClass} border-success/20 bg-success/5 hover:bg-success/10`}
        >
          <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-success" />
          <span>
            <span className="block text-sm font-bold">Use MiniPay</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Best on Celo in Kenya — one tap from the MiniPay app.
            </span>
          </span>
          {busy === "minipay" && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </button>

        <button
          type="button"
          onClick={provisionCustodial}
          disabled={Boolean(busy) || status === "curator_owned"}
          className={`${optionClass} border-warning/20 bg-warning/5 hover:bg-warning/10`}
        >
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            <span className="block text-sm font-bold">Quick start (OnPoint holds funds)</span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Fastest ops path — claim to your own wallet anytime.
            </span>
          </span>
          {busy === "provision" && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}
        </button>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
          Or paste a Celo address
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="text"
            value={wallet}
            onChange={(e) => {
              setWallet(e.target.value);
              setError(null);
              setMessage(null);
              onWalletChange?.(e.target.value, status);
            }}
            placeholder="0x…"
            className="min-w-0 flex-1 rounded-xl border border-border bg-card px-3 py-2.5 font-mono text-sm outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10"
          />
          <button
            type="button"
            onClick={migrateManual}
            disabled={Boolean(busy)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-muted/50 disabled:opacity-50"
          >
            {busy === "migrate" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </button>
        </div>
      </div>

      {slug && !deferApi && (
        <a
          href={`/curator/wallet?slug=${encodeURIComponent(slug)}`}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          Manage payout wallet later
          <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
          {error}
        </p>
      )}
      {message && (
        <p className="flex items-start gap-1.5 text-xs text-success">
          <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
