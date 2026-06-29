"use client";

/**
 * GStreamPanel — Superfluid G$ streaming panel for subscribing to curators.
 *
 * Lets a user open, update, or close a continuous G$ stream to a curator's
 * wallet. Shows the current stream status (monthly amount) and provides
 * preset amounts for quick subscription.
 *
 * Flow:
 *   1. Not connected → "Connect wallet" prompt
 *   2. Wrong chain → "Switch to Celo" button
 *   3. No stream → "Subscribe" form with preset amounts
 *   4. Active stream → shows current monthly amount + "Update" / "Stop" buttons
 *   5. Transaction pending → spinner
 *   6. Success → confirmation + Celoscan link
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  Activity,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  Zap,
  X,
  RefreshCw,
} from "lucide-react";
import { celo } from "../../config/chains";
import {
  openStream,
  updateStream,
  closeStream,
  getStreamMonthly,
  formatGAmount,
} from "../../lib/services/g-stream-service";
import { recordMetric } from "../../lib/utils/metrics";
import type { Address } from "viem";

interface GStreamPanelProps {
  /** The curator's wallet address (stream receiver). */
  curatorAddress: Address;
  /** Curator display name for the UI. */
  curatorName?: string;
  /** Compact layout. */
  compact?: boolean;
  className?: string;
}

type Phase = "loading" | "disconnected" | "wrong-chain" | "idle" | "active" | "pending" | "success" | "error" | "confirm-stop";

const PRESET_MONTHLY: { amount: number; usd: string }[] = [
  { amount: 5, usd: "~$0.01" },
  { amount: 10, usd: "~$0.01" },
  { amount: 25, usd: "~$0.03" },
  { amount: 50, usd: "~$0.05" },
];

export function GStreamPanel({
  curatorAddress,
  curatorName,
  compact,
  className,
}: GStreamPanelProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [currentMonthly, setCurrentMonthly] = useState(0);
  const [selectedMonthly, setSelectedMonthly] = useState(10);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isOnCelo = chainId === celo.id;

  const refreshStream = useCallback(async () => {
    if (!isConnected || !isOnCelo || !publicClient || !address) {
      setPhase("loading");
      return;
    }
    setPhase("loading");
    try {
      const monthly = await getStreamMonthly(
        publicClient,
        address as Address,
        curatorAddress,
      );
      setCurrentMonthly(monthly);
      setPhase(monthly > 0 ? "active" : "idle");
    } catch {
      setPhase("idle");
    }
  }, [isConnected, isOnCelo, publicClient, address, curatorAddress]);

  useEffect(() => {
    if (!isConnected) {
      setPhase("disconnected");
      return;
    }
    if (!isOnCelo) {
      setPhase("wrong-chain");
      return;
    }
    refreshStream();
  }, [isConnected, isOnCelo, refreshStream]);

  const handleSubscribe = useCallback(async () => {
    if (!publicClient || !walletClient || !address) return;
    setPhase("pending");
    setError(null);
    try {
      const hash = await openStream(
        publicClient,
        walletClient,
        address as Address,
        curatorAddress,
        selectedMonthly,
      );
      if (hash) {
        setTxHash(hash);
        setPhase("success");
        recordMetric("stream_g$", "succeeded");
        setTimeout(() => refreshStream(), 2000);
      } else {
        setError("Transaction was not submitted");
        setPhase("error");
        recordMetric("stream_g$", "failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open stream");
      setPhase("error");
      recordMetric("stream_g$", "failed");
    }
  }, [publicClient, walletClient, address, curatorAddress, selectedMonthly, refreshStream]);

  const handleUpdate = useCallback(async () => {
    if (!publicClient || !walletClient || !address) return;
    setPhase("pending");
    setError(null);
    try {
      const hash = await updateStream(
        publicClient,
        walletClient,
        address as Address,
        curatorAddress,
        selectedMonthly,
      );
      if (hash) {
        setTxHash(hash);
        setPhase("success");
        recordMetric("stream_g$", "succeeded");
        setTimeout(() => refreshStream(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update stream");
      setPhase("error");
      recordMetric("stream_g$", "failed");
    }
  }, [publicClient, walletClient, address, curatorAddress, selectedMonthly, refreshStream]);

  const handleStop = useCallback(async () => {
    if (!publicClient || !walletClient || !address) return;
    setPhase("pending");
    setError(null);
    try {
      const hash = await closeStream(
        publicClient,
        walletClient,
        address as Address,
        curatorAddress,
      );
      if (hash) {
        setTxHash(hash);
        setPhase("success");
        recordMetric("stream_g$", "succeeded");
        setTimeout(() => refreshStream(), 2000);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close stream");
      setPhase("error");
      recordMetric("stream_g$", "failed");
    }
  }, [publicClient, walletClient, address, curatorAddress, refreshStream]);

  // ── Render ─────────────────────────────────────────────────────

  if (phase === "disconnected") {
    return (
      <Shell compact={compact} className={className}>
        <Activity className="h-5 w-5 text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">
          Connect your wallet to subscribe with G$ streaming.
        </p>
      </Shell>
    );
  }

  if (phase === "wrong-chain") {
    return (
      <Shell compact={compact} className={className}>
        <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Switch to Celo</p>
          <p className="text-xs text-muted-foreground">G$ streaming is on Celo.</p>
        </div>
        <button
          onClick={() => switchChain?.({ chainId: celo.id })}
          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500"
        >
          Switch
        </button>
      </Shell>
    );
  }

  if (phase === "loading") {
    return (
      <Shell compact={compact} className={className}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
        <p className="text-sm text-muted-foreground">Checking stream status…</p>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell compact={compact} className={className}>
        <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Stream error</p>
          <p className="text-xs text-rose-400/80 break-words">{error}</p>
        </div>
        <button
          onClick={refreshStream}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
        >
          Retry
        </button>
      </Shell>
    );
  }

  if (phase === "success" && txHash) {
    return (
      <Shell compact={compact} className={className}>
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Stream updated!</p>
          <a
            href={`https://celoscan.io/tx/${txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
          >
            View on Celoscan
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </Shell>
    );
  }

  if (phase === "pending") {
    return (
      <Shell compact={compact} className={className}>
        <Loader2 className="h-5 w-5 animate-spin text-emerald-500 shrink-0" />
        <p className="text-sm text-muted-foreground">Confirm in wallet…</p>
      </Shell>
    );
  }

  // Active stream — show current amount + update/stop controls
  if (phase === "active") {
    return (
      <Shell compact={compact} className={className}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10 shrink-0">
          <Activity className="h-4 w-4 text-emerald-500" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-semibold text-foreground">
            Streaming {formatGAmount(BigInt(Math.round(currentMonthly * 1e18)))}/mo
            {curatorName && <span className="text-muted-foreground"> to {curatorName}</span>}
          </p>
          <div className="flex items-center gap-1.5">
            {PRESET_MONTHLY.map((p) => (
              <button
                key={p.amount}
                onClick={() => setSelectedMonthly(p.amount)}
                className={`rounded-md px-2 py-0.5 text-[10px] font-bold transition-colors ${
                  selectedMonthly === p.amount
                    ? "bg-emerald-500/20 text-emerald-300"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {p.amount}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={handleUpdate}
            disabled={selectedMonthly === currentMonthly}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-emerald-500 disabled:opacity-40"
          >
            <RefreshCw className="h-3 w-3" />
            Update
          </button>
          <button
            onClick={() => setPhase("confirm-stop")}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs font-bold text-rose-400 transition-colors hover:bg-rose-500/10"
          >
            <X className="h-3 w-3" />
            Stop
          </button>
        </div>
      </Shell>
    );
  }

  // Confirm stop — destructive action confirmation
  if (phase === "confirm-stop") {
    return (
      <Shell compact={compact} className={className}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 shrink-0">
          <AlertCircle className="h-4 w-4 text-rose-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Stop the stream?</p>
          <p className="text-xs text-muted-foreground">
            {curatorName ? `${curatorName} will stop receiving G$ from you.` : "The curator will stop receiving G$ from you."} This can&apos;t be undone — you&apos;d need to start a new stream.
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => setPhase("active")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={handleStop}
            className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-rose-500"
          >
            <X className="h-3 w-3" />
            Stop stream
          </button>
        </div>
      </Shell>
    );
  }

  // Idle — subscribe form
  return (
    <Shell compact={compact} className={className}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0">
        <Zap className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1 space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          Subscribe with G$ streaming
          {curatorName && <span className="text-muted-foreground"> to {curatorName}</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Continuous per-second payments. Cancel anytime.
        </p>
        <div className="flex items-center gap-1.5">
          {PRESET_MONTHLY.map((p) => (
            <button
              key={p.amount}
              onClick={() => setSelectedMonthly(p.amount)}
              className={`flex flex-col items-center rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                selectedMonthly === p.amount
                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted border border-transparent"
              }`}
            >
              {p.amount} G$/mo
              <span className="text-[9px] font-normal text-muted-foreground/60">
                {p.usd}/mo
              </span>
            </button>
          ))}
        </div>
      </div>
      <button
        onClick={handleSubscribe}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500"
      >
        <Zap className="h-3.5 w-3.5" />
        Subscribe
      </button>
    </Shell>
  );
}

function Shell({
  children,
  compact,
  className,
}: {
  children: React.ReactNode;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card ${
        compact ? "p-3" : "p-4"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
