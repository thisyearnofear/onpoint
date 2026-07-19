"use client";

/**
 * GStreakPill — visible surface for the G$ Style Streak loop.
 *
 * Shows the current claim streak, the active perks (premium personas
 * unlocked via streak badges), the next milestone, and a "protect your
 * streak" prompt when today's claim hasn't happened yet.
 *
 * "Protect" is positive-only: missing a day forfeits the next bonus but
 * never revokes earned perks. The prompt is a nudge, not a threat.
 *
 * Reuses the GBalancePill shell pattern (CONSOLIDATION). Composable: pass
 * `compact` for inline use in AgentStatus, omit for the HomePanel card.
 */

import React, { useState, useRef, useEffect } from "react";
import { Flame, Gift, ChevronDown, Sparkles, ShieldCheck, Wallet } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useChainId } from "wagmi";
import { celo } from "../../config/chains";
import { useGStreak } from "../../lib/hooks/use-g-streak";
import { G_STREAK_MILESTONES } from "../../lib/utils/g-streak-config";

interface GStreakPillProps {
  /** Compact inline layout (AgentStatus). Defaults to false (HomePanel card). */
  compact?: boolean;
  className?: string;
}

export function GStreakPill({ compact, className }: GStreakPillProps) {
  const { streak, isProtectedToday, nextMilestone, lastMilestone } = useGStreak();
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const isOnCelo = chainId === celo.id;
  const containerRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);

  // Click-outside-to-close (compact mode popover)
  useEffect(() => {
    if (!expanded || !compact) return;
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [expanded, compact]);

  // ── Day 0: user has never claimed. Surface the loop entry point. ──
  if (streak === 0 && !lastMilestone) {
    if (compact) {
      // Compact: small "Claim G$" pill that opens RainbowKit connect modal
      return (
        <ConnectButton.Custom>
          {({ openConnectModal, account, chain }) => {
            // If already connected and on Celo, they need to go claim —
            // show a nudge pill instead of a connect button.
            if (account && chain) {
              return null; // The full streak card will handle this
            }
            return (
              <button
                onClick={openConnectModal}
                className={`flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-success/15 transition-colors ${className ?? ""}`}
                title="Claim free daily G$ to unlock premium stylists"
              >
                <Gift className="h-3.5 w-3.5" />
                <span>Claim G$</span>
              </button>
            );
          }}
        </ConnectButton.Custom>
      );
    }

    // Full card: the G$ loop entry point
    return (
      <DayZeroCard
        isConnected={isConnected}
        isOnCelo={isOnCelo}
        className={className}
      />
    );
  }

  const daysToNext = nextMilestone ? nextMilestone.days - streak : 0;
  const showProtectPrompt = !isProtectedToday && streak > 0;

  // ── Compact (AgentStatus inline) ───────────────────────────────
  if (compact) {
    return (
      <div className={`relative ${className ?? ""}`} ref={containerRef}>
        <button
          onClick={() => setExpanded((v) => !v)}
          className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            showProtectPrompt
              ? "border-warning/40 bg-warning/10 text-amber-300 hover:bg-warning/15"
              : "border-success/20 bg-success/5 text-emerald-300 hover:bg-success/10"
          }`}
          title="G$ Style Streak"
        >
          <Flame
            className={`h-3.5 w-3.5 ${streak >= 3 ? "text-amber-400" : "text-warning"}`}
          />
          <span className="font-bold">{streak}</span>
          <span className="text-[10px] opacity-70 whitespace-nowrap">
            day{streak === 1 ? "" : "s"}
          </span>
          <ChevronDown
            className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`}
          />
        </button>

        {expanded && (
          <div className="absolute right-0 top-full mt-2 w-72 z-50">
            <div className="rounded-xl border border-border bg-card p-3 shadow-xl space-y-2">
              <StreakDetail
                streak={streak}
                isProtectedToday={isProtectedToday}
                nextMilestone={nextMilestone}
                lastMilestone={lastMilestone}
                daysToNext={daysToNext}
                showProtectPrompt={showProtectPrompt}
              />
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Full card (HomePanel) ──────────────────────────────────────
  return (
    <div
      className={`rounded-2xl border ${
        showProtectPrompt
          ? "border-warning/30 bg-warning/5"
          : "border-success/20 bg-success/5"
      } p-4 ${className ?? ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            showProtectPrompt
              ? "bg-warning/15"
              : "bg-gradient-to-br from-emerald-500 to-teal-600"
          }`}
        >
          <Flame
            className={`h-5 w-5 ${
              showProtectPrompt ? "text-amber-400" : "text-white"
            }`}
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-foreground">
              {streak}-day G$ streak
            </p>
            {isProtectedToday && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[9px] font-bold text-emerald-300">
                <ShieldCheck className="h-2.5 w-2.5" />
                Protected
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {nextMilestone
              ? `${daysToNext} day${daysToNext === 1 ? "" : "s"} to ${nextMilestone.rewardLabel}`
              : "All streak milestones reached — legend!"}
          </p>
        </div>
      </div>

      {showProtectPrompt && (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-warning/10 px-3 py-2">
          <Gift className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300/90">
            Claim today&apos;s G$ to protect your streak and keep your perks.
          </p>
        </div>
      )}

      {/* Milestone progress dots */}
      <div className="mt-3 flex items-center gap-1.5">
        {G_STREAK_MILESTONES.map((m) => {
          const reached = streak >= m.days;
          return (
            <div
              key={m.badge}
              title={`${m.days} days: ${m.rewardLabel}`}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                reached ? "bg-success" : "bg-muted"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Shared detail content (used in compact popover) ────────────────

function StreakDetail({
  streak,
  isProtectedToday,
  nextMilestone,
  lastMilestone,
  daysToNext,
  showProtectPrompt,
}: {
  streak: number;
  isProtectedToday: boolean;
  nextMilestone: { days: number; rewardLabel: string } | null;
  lastMilestone: { days: number; rewardLabel: string } | null;
  daysToNext: number;
  showProtectPrompt: boolean;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">G$ Style Streak</span>
        <span className="flex items-center gap-1 text-xs font-bold text-amber-400">
          <Flame className="h-3 w-3" />
          {streak}
        </span>
      </div>

      {lastMilestone && (
        <div className="flex items-center gap-1.5 text-[11px] text-emerald-300">
          <Sparkles className="h-3 w-3" />
          <span>{lastMilestone.rewardLabel}</span>
        </div>
      )}

      {nextMilestone && (
        <p className="text-[11px] text-muted-foreground">
          {daysToNext} day{daysToNext === 1 ? "" : "s"} to{" "}
          {nextMilestone.rewardLabel}
        </p>
      )}

      {showProtectPrompt ? (
        <p className="text-[11px] text-amber-300/90">
          Claim today&apos;s G$ to protect your streak.
        </p>
      ) : isProtectedToday ? (
        <p className="text-[11px] text-emerald-300/80">
          Streak protected for today.
        </p>
      ) : null}
    </div>
  );
}

// ── Day 0: the G$ loop entry point (full card) ────────────────────

function DayZeroCard({
  isConnected,
  isOnCelo,
  className,
}: {
  isConnected: boolean;
  isOnCelo: boolean;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-success/20 bg-gradient-to-br from-emerald-500/8 via-teal-500/5 to-emerald-500/8 p-4 ${className ?? ""}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600">
          <Gift className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 space-y-1">
          <p className="text-sm font-bold text-foreground">
            Unlock premium stylists with free G$
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Claim free daily G$ — no card needed. Build a streak to unlock
            premium AI stylists like Anna Wintour and Virgil Abloh.
          </p>
        </div>
      </div>

      {/* Milestone path preview */}
      <div className="mt-3 flex items-center gap-1.5">
        {G_STREAK_MILESTONES.map((m) => (
          <div
            key={m.badge}
            title={`Day ${m.days}: ${m.rewardLabel}`}
            className="flex-1 rounded-lg bg-muted/50 px-2 py-1.5 text-center"
          >
            <p className="text-[10px] font-bold text-muted-foreground">
              Day {m.days}
            </p>
            <p className="text-[9px] text-muted-foreground/70 leading-tight mt-0.5">
              {m.rewardLabel.split(" + ")[0]?.replace(" unlocked", "")}
            </p>
          </div>
        ))}
      </div>

      {/* CTA: connect wallet or switch to Celo */}
      <div className="mt-3">
        {!isConnected ? (
          <ConnectButton.Custom>
            {({ openConnectModal }) => (
              <button
                onClick={openConnectModal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-transform active:scale-[0.98] hover:from-emerald-500/90 hover:to-teal-600/90"
              >
                <Wallet className="h-4 w-4" />
                Connect Wallet to Claim
              </button>
            )}
          </ConnectButton.Custom>
        ) : !isOnCelo ? (
          <ConnectButton.Custom>
            {({ chain, openChainModal }) => (
              <button
                onClick={openChainModal}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-warning/90 px-4 py-2.5 text-sm font-bold text-white transition-transform active:scale-[0.98] hover:bg-warning"
              >
                <Wallet className="h-4 w-4" />
                Switch to Celo to Claim
              </button>
            )}
          </ConnectButton.Custom>
        ) : (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 px-4 py-2.5 text-sm font-medium text-emerald-300">
            <Sparkles className="h-4 w-4" />
            Claim your first G$ above ↑
          </div>
        )}
      </div>
    </div>
  );
}
