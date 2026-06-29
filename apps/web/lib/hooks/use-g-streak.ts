/**
 * useGStreak — GoodDollar claim-driven Style Streak.
 *
 * Replaces the visit-based localStorage streak in HomePanel with a
 * claim-based streak: the counter advances only when the user claims
 * their daily G$ UBI, not on mere app visits. This ties the retention
 * loop to the G$ integration (see ADR 0009).
 *
 * Positive-only semantics (per goodbuilders-season-4.md v2 design):
 *   - Claiming on consecutive days advances the streak.
 *   - Missing a day resets the streak to 0 but NEVER revokes badges or
 *     perks already earned. "Protect" = opportunity cost, not punishment.
 *
 * Persistence: localStorage (same pattern as the prior visit-streak).
 * The on-chain claim is the source of truth for eligibility; this hook
 * is the client-side streak accumulator that reacts to successful claims.
 *
 * Design (Core Principles):
 *   - DRY: single source for streak state; HomePanel consumes this
 *   - ENHANCEMENT FIRST: supersedes HomePanel.useStreak rather than
 *     running a parallel counter
 *   - CLEAN: no side effects beyond localStorage; pure data out
 */

import { useState, useEffect, useCallback } from "react";
import {
  getNextMilestone,
  getLastReachedMilestone,
  getNewlyReachedMilestones,
  type GStreakMilestone,
} from "../utils/g-streak-config";

const STREAK_KEY = "onpoint-g-streak";
const LAST_CLAIM_KEY = "onpoint-g-last-claim";
const CLAIMED_BADGES_KEY = "onpoint-g-claimed-badges";

/** Grace window before a streak resets (hours). Generous to avoid
 *  punishing users in far-from-UTC timezones or with spotty connectivity. */
const RESET_GRACE_HOURS = 36;

export interface GStreakState {
  /** Current consecutive claim-day count. */
  streak: number;
  /** ISO date string of the last claim, or null. */
  lastClaimDate: string | null;
  /** True if the user has already claimed today (streak is protected). */
  isProtectedToday: boolean;
  /** Next milestone not yet reached, or null if all passed. */
  nextMilestone: GStreakMilestone | null;
  /** Most recent milestone reached, or null. */
  lastMilestone: GStreakMilestone | null;
  /** Badges permanently earned via streak milestones. */
  earnedBadges: string[];
}

export interface UseGStreakResult extends GStreakState {
  /**
   * Record a successful G$ claim. Advances the streak if it is a new
   * calendar day (UTC) since the last claim. Returns the milestones
   * newly crossed (if any) so the caller can grant badges + show bonuses.
   *
   * Idempotent within the same UTC day — calling twice in one day does
   * not double-advance.
   */
  recordClaim: () => GStreakMilestone[];
  /** Re-read state from localStorage (e.g. after another tab claimed). */
  refresh: () => void;
}

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function hoursSince(isoDate: string | null): number {
  if (!isoDate) return Infinity;
  return (Date.now() - new Date(isoDate).getTime()) / 3_600_000;
}

function readEarnedBadges(): string[] {
  try {
    const raw = localStorage.getItem(CLAIMED_BADGES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeEarnedBadges(badges: string[]): void {
  try {
    localStorage.setItem(CLAIMED_BADGES_KEY, JSON.stringify(badges));
  } catch {
    // localStorage unavailable — non-fatal
  }
}

function readState(): GStreakState {
  let streak = 0;
  let lastClaimDate: string | null = null;
  try {
    streak = parseInt(localStorage.getItem(STREAK_KEY) || "0", 10) || 0;
    lastClaimDate = localStorage.getItem(LAST_CLAIM_KEY);
  } catch {
    // localStorage unavailable
  }

  // Reset if the grace window has elapsed since the last claim.
  if (lastClaimDate && hoursSince(lastClaimDate) > RESET_GRACE_HOURS) {
    streak = 0;
    try {
      localStorage.setItem(STREAK_KEY, "0");
    } catch {
      // non-fatal
    }
  }

  const today = todayUTC();
  const isProtectedToday = lastClaimDate === today;
  const earnedBadges = readEarnedBadges();

  return {
    streak,
    lastClaimDate,
    isProtectedToday,
    nextMilestone: getNextMilestone(streak),
    lastMilestone: getLastReachedMilestone(streak),
    earnedBadges,
  };
}

export function useGStreak(): UseGStreakResult {
  const [state, setState] = useState<GStreakState>(() => readState());

  const refresh = useCallback(() => {
    setState(readState());
  }, []);

  // Re-evaluate on mount and when the tab regains focus (another tab may
  // have claimed, or the grace window may have elapsed).
  useEffect(() => {
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  const recordClaim = useCallback((): GStreakMilestone[] => {
    const prev = readState();
    const today = todayUTC();

    // Idempotent within the same UTC day.
    if (prev.lastClaimDate === today) {
      setState(readState());
      return [];
    }

    const yesterday = new Date(Date.now() - 86_400_000)
      .toISOString()
      .slice(0, 10);
    const newStreak = prev.lastClaimDate === yesterday ? prev.streak + 1 : 1;

    try {
      localStorage.setItem(STREAK_KEY, String(newStreak));
      localStorage.setItem(LAST_CLAIM_KEY, today);
    } catch {
      // non-fatal
    }

    const crossed = getNewlyReachedMilestones(prev.streak, newStreak);
    if (crossed.length > 0) {
      const badges = readEarnedBadges();
      for (const m of crossed) {
        if (!badges.includes(m.badge)) badges.push(m.badge);
      }
      writeEarnedBadges(badges);
    }

    setState(readState());
    return crossed;
  }, []);

  return {
    ...state,
    recordClaim,
    refresh,
  };
}
