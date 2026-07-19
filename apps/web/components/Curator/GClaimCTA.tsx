"use client";

/**
 * GClaimCTA — composable GoodDollar UBI claim call-to-action.
 *
 * Full delightful flow backed by @goodsdks/citizen-sdk:
 *   1. Wallet not connected → prompt to connect
 *   2. Wrong chain → "Switch to Celo" button
 *   3. On Celo → check whitelist + entitlement:
 *      - Not whitelisted → "Verify your identity" button (opens in-app FV)
 *        → on return, polls whitelist status → auto-transitions to claim-ready
 *      - Can claim → "Claim today's G$" button (SDK handles gas faucet)
 *      - Already claimed → countdown to next claim time
 *   4. Claiming → spinner + "Confirm in wallet…"
 *   5. Success → amount claimed + Celoscan link, calls onClaimed
 *
 * Composable: accepts onClaimed callback, compact flag, className.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  usePublicClient,
  useWalletClient,
} from "wagmi";
import {
  Gift,
  Loader2,
  CheckCircle2,
  ExternalLink,
  AlertCircle,
  RefreshCw,
  Camera,
  Clock,
  Sparkles,
} from "lucide-react";
import { celo } from "../../config/chains";
import { formatGAmount } from "../../lib/services/g-claim-service";
import {
  createIdentitySDK,
  createClaimSDK,
  checkWhitelist,
  checkEntitlement,
  getNextClaimTime,
  generateFVLink,
  claimUBI,
} from "../../lib/services/g-claim-service";
import { recordMetric } from "../../lib/utils/metrics";
import { useGStreak } from "../../lib/hooks/use-g-streak";
import type { Address } from "viem";

interface GClaimCTAProps {
  /** Fired after a successful claim, with the tx hash. */
  onClaimed?: (txHash: string) => void;
  /** Compact layout for inline use (e.g. inside AddFunds modal). */
  compact?: boolean;
  /** Optional className override. */
  className?: string;
}

type Phase =
  | "loading"
  | "disconnected"
  | "wrong-chain"
  | "not-whitelisted"
  | "verifying"
  | "can-claim"
  | "cooldown"
  | "claiming"
  | "success"
  | "error";

interface ClaimState {
  isWhitelisted: boolean;
  entitlement: bigint;
  nextClaimTime: Date | null;
  txHash: string | null;
}

export function GClaimCTA({ onClaimed, compact, className }: GClaimCTAProps) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [phase, setPhase] = useState<Phase>("loading");
  const [state, setState] = useState<ClaimState>({
    isWhitelisted: false,
    entitlement: 0n,
    nextClaimTime: null,
    txHash: null,
  });
  const [error, setError] = useState<string | null>(null);
  const [fvLink, setFvLink] = useState<string | null>(null);
  const [milestoneBonus, setMilestoneBonus] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { recordClaim } = useGStreak();

  const isOnCelo = chainId === celo.id;

  // ── Fetch claim status ─────────────────────────────────────────
  const refreshStatus = useCallback(async () => {
    if (!isConnected || !isOnCelo || !publicClient || !walletClient || !address) {
      setPhase("loading");
      return;
    }
    setPhase("loading");
    setError(null);
    try {
      const identitySDK = await createIdentitySDK(
        publicClient,
        walletClient,
        address as Address,
      );
      const claimSDK = await createClaimSDK(
        publicClient,
        walletClient,
        address as Address,
      );

      const [{ isWhitelisted }, entitlementResult, nextTime] = await Promise.all([
        checkWhitelist(identitySDK, address as Address),
        checkEntitlement(claimSDK),
        getNextClaimTime(claimSDK),
      ]);

      const entitlement = entitlementResult?.amount ?? 0n;

      setState({
        isWhitelisted,
        entitlement,
        nextClaimTime: nextTime,
        txHash: null,
      });

      if (!isWhitelisted) {
        setPhase("not-whitelisted");
      } else if (entitlement > 0n) {
        setPhase("can-claim");
      } else {
        setPhase("cooldown");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read claim status");
      setPhase("error");
    }
  }, [isConnected, isOnCelo, publicClient, walletClient, address]);

  // Initial status fetch
  useEffect(() => {
    if (!isConnected) {
      setPhase("disconnected");
      return;
    }
    if (!isOnCelo) {
      setPhase("wrong-chain");
      return;
    }
    refreshStatus();
  }, [isConnected, isOnCelo, refreshStatus]);

  // ── Poll whitelist status when returning from FV ───────────────
  const startWhitelistPoll = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    setPhase("verifying");

    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > 60) {
        // Stop after 5 minutes of polling
        if (pollRef.current) clearInterval(pollRef.current);
        setPhase("not-whitelisted");
        setError(
          "Verification is taking longer than expected. Refresh after completing verification.",
        );
        return;
      }

      if (!publicClient || !walletClient || !address) return;
      const identitySDK = await createIdentitySDK(
        publicClient,
        walletClient,
        address as Address,
      );
      const { isWhitelisted } = await checkWhitelist(identitySDK, address as Address);

      if (isWhitelisted) {
        if (pollRef.current) clearInterval(pollRef.current);
        // Re-fetch full status to get entitlement
        refreshStatus();
      }
    }, 5000);
  }, [publicClient, walletClient, address, refreshStatus]);

  // Also re-check on window focus (user returns from FV tab)
  useEffect(() => {
    if (phase !== "verifying") return;
    const onFocus = () => refreshStatus();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [phase, refreshStatus]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Start face verification ────────────────────────────────────
  const handleVerify = useCallback(async () => {
    if (!publicClient || !walletClient || !address) return;
    setError(null);
    try {
      const identitySDK = await createIdentitySDK(
        publicClient,
        walletClient,
        address as Address,
      );
      const callbackUrl = window.location.href;
      const link = await generateFVLink(identitySDK, callbackUrl);
      if (link) {
        setFvLink(link);
        // Open FV in a new tab
        window.open(link, "_blank", "noopener,noreferrer");
        // Start polling for whitelist status
        startWhitelistPoll();
      } else {
        setError("Could not generate verification link. Please try again.");
        setPhase("error");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification setup failed");
      setPhase("error");
    }
  }, [publicClient, walletClient, address, startWhitelistPoll]);

  // ── Submit claim ───────────────────────────────────────────────
  const handleClaim = useCallback(async () => {
    if (!publicClient || !walletClient || !address) return;
    setPhase("claiming");
    setError(null);
    try {
      const claimSDK = await createClaimSDK(
        publicClient,
        walletClient,
        address as Address,
      );
      const txHash = await claimUBI(claimSDK);
      if (txHash) {
        setState((prev) => ({ ...prev, txHash }));
        setPhase("success");
        onClaimed?.(txHash);
        recordMetric("claim", "succeeded");
        // Advance the G$ Style Streak and surface any newly-crossed
        // milestone bonus. Positive-only: never revokes earned perks.
        const crossed = recordClaim();
        if (crossed.length > 0) {
          setMilestoneBonus(crossed[crossed.length - 1]!.rewardLabel);
        }
        // Best-effort: sync streak progress to the mission service so the
        // MissionsPanel reflects streak progress. Uses the wallet address
        // as the userId (the streak is wallet-scoped, not Auth0-scoped).
        // The canonical unlock path is the localStorage streak badges
        // merged in VirtualTryOn — this POST is for display only.
        try {
          const streakState = JSON.parse(
            localStorage.getItem("onpoint-g-streak") || "0",
          );
          fetch("/api/agent/missions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: address,
              eventType: "g-claim-streak",
              metadata: { streak: Number(streakState) || 1 },
            }),
          }).catch(() => {
            // Silent — display-only sync
          });
        } catch {
          // non-fatal
        }
        // Refresh status to show cooldown
        setTimeout(() => refreshStatus(), 2000);
      } else {
        setError("Claim transaction was not submitted");
        setPhase("error");
        recordMetric("claim", "failed");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Claim failed";
      recordMetric("claim", "failed");
      // If the SDK redirected to FV, we'll be in the verifying state
      if (msg.includes("whitelist") || msg.includes("verification")) {
        startWhitelistPoll();
      } else {
        setError(msg);
        setPhase("error");
      }
    }
  }, [publicClient, walletClient, address, onClaimed, refreshStatus, startWhitelistPoll]);

  // ── Render ─────────────────────────────────────────────────────

  if (phase === "disconnected") {
    return (
      <Shell compact={compact} className={className}>
        <Gift className="h-5 w-5 text-success shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Claim free G$ UBI
          </p>
          <p className="text-xs text-muted-foreground">
            Connect your wallet to claim daily GoodDollar on Celo.
          </p>
        </div>
      </Shell>
    );
  }

  if (phase === "wrong-chain") {
    return (
      <Shell compact={compact} className={className}>
        <AlertCircle className="h-5 w-5 text-warning shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Switch to Celo
          </p>
          <p className="text-xs text-muted-foreground">
            GoodDollar UBI is only available on Celo.
          </p>
        </div>
        <button
          onClick={() => switchChain?.({ chainId: celo.id })}
          className="rounded-lg bg-success px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-success"
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
        <p className="text-sm text-muted-foreground">Checking claim status…</p>
      </Shell>
    );
  }

  if (phase === "error") {
    return (
      <Shell compact={compact} className={className}>
        <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">Something went wrong</p>
          <p className="text-xs text-rose-400/80 break-words">{error}</p>
        </div>
        <button
          onClick={refreshStatus}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
        >
          Retry
        </button>
      </Shell>
    );
  }

  if (phase === "verifying") {
    return (
      <Shell compact={compact} className={className}>
        <Camera className="h-5 w-5 text-success shrink-0 animate-pulse" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Complete verification
          </p>
          <p className="text-xs text-muted-foreground">
            Finish face verification in the opened tab. We&apos;ll detect it automatically.
          </p>
        </div>
        {fvLink && (
          <button
            onClick={() => window.open(fvLink, "_blank", "noopener,noreferrer")}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-muted"
          >
            Reopen
          </button>
        )}
      </Shell>
    );
  }

  if (phase === "not-whitelisted") {
    return (
      <Shell compact={compact} className={className}>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-success/10 shrink-0">
          <Camera className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Verify to claim G$
          </p>
          <p className="text-xs text-muted-foreground">
            Quick face verification — proves you&apos;re unique. Takes 30 seconds.
          </p>
        </div>
        <button
          onClick={handleVerify}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500"
        >
          <Camera className="h-3.5 w-3.5" />
          Verify
        </button>
      </Shell>
    );
  }

  if (phase === "success" && state.txHash) {
    const claimedAmount = state.entitlement > 0n ? formatGAmount(state.entitlement) : null;
    return (
      <Shell compact={compact} className={className}>
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            {claimedAmount ? `${claimedAmount} claimed!` : "G$ claimed successfully!"}
          </p>
          <a
            href={`https://celoscan.io/tx/${state.txHash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-400 hover:underline"
          >
            View on Celoscan
            <ExternalLink className="h-3 w-3" />
          </a>
          {milestoneBonus && (
            <p className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-amber-400">
              <Sparkles className="h-3 w-3" />
              Streak milestone! {milestoneBonus}
            </p>
          )}
        </div>
      </Shell>
    );
  }

  if (phase === "cooldown") {
    const next = state.nextClaimTime;
    const msLeft = next ? Math.max(0, next.getTime() - Date.now()) : 0;
    const hoursLeft = Math.floor(msLeft / 3600000);
    const minsLeft = Math.floor((msLeft % 3600000) / 60000);
    const timeLabel = hoursLeft > 0
      ? `${hoursLeft}h ${minsLeft}m`
      : minsLeft > 0
        ? `${minsLeft}m`
        : "<1m";
    return (
      <Shell compact={compact} className={className}>
        <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            Already claimed today
          </p>
          <p className="text-xs text-muted-foreground">
            Next claim in {timeLabel}
          </p>
        </div>
        <button
          onClick={refreshStatus}
          className="rounded-lg border border-border p-1.5 text-muted-foreground transition-colors hover:bg-muted"
          title="Refresh"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </Shell>
    );
  }

  // phase === "can-claim"
  const claimAmount = state.entitlement > 0n ? formatGAmount(state.entitlement) : null;
  return (
    <Shell compact={compact} className={className}>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 shrink-0">
        <Gift className="h-4 w-4 text-white" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-foreground">
          {claimAmount ? `Claim ${claimAmount}` : "Claim today's G$"}
        </p>
        <p className="text-xs text-muted-foreground">
          Free daily UBI — gas sponsored, no cost to you.
        </p>
      </div>
      <button
        onClick={handleClaim}
        disabled={phase === "claiming"}
        className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
      >
        {phase === "claiming" ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Claiming…
          </>
        ) : (
          <>
            <Sparkles className="h-3.5 w-3.5" />
            Claim
          </>
        )}
      </button>
    </Shell>
  );
}

// ── Layout shell ──────────────────────────────────────────────────

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
      className={`flex items-center gap-3 rounded-xl border border-border bg-card ${
        compact ? "p-3" : "p-4"
      } ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
