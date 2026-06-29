/**
 * g-streak-config — GoodDollar claim streak milestones + loyalty bonuses.
 *
 * Single source of truth for the G$ Style Streak loop. The streak is
 * positive-only: missing a day forfeits the next bonus but NEVER revokes
 * perks already earned. See ADR 0009 / goodbuilders-season-4.md.
 *
 * The streak is driven by daily G$ UBI claims (not app visits). Each
 * consecutive claim day advances the streak; crossing a milestone grants
 * a loyalty bonus (extra G$ notional + a badge that feeds the existing
 * MissionService → persona-unlock pipeline).
 *
 * Design (Core Principles):
 *   - DRY: one place defines milestones, bonuses, and badge names
 *   - ENHANCEMENT FIRST: badges flow into the existing isPersonaUnlocked
 *     check via mission-service — no new unlock mechanism
 *   - CLEAN: pure data + helpers, no side effects, no React
 */

export interface GStreakMilestone {
  /** Consecutive claim days required to reach this milestone. */
  days: number;
  /** Badge granted (feeds MissionService.badges → persona unlocks). */
  badge: string;
  /** Human-readable reward label shown in the UI. */
  rewardLabel: string;
  /** Notional G$ bonus amount (display only — actual G$ comes from UBI). */
  bonusG: number;
}

/**
 * Streak milestones. Ordered ascending by `days`.
 *
 * Badges here are also referenced as alt-unlock paths in persona-config
 * (a streak badge can unlock a premium persona without the XP requirement).
 */
export const G_STREAK_MILESTONES: readonly GStreakMilestone[] = [
  {
    days: 3,
    badge: "streak-starter",
    rewardLabel: "Streetwear Guru unlocked",
    bonusG: 500,
  },
  {
    days: 7,
    badge: "streak-keeper",
    rewardLabel: "Eco Stylist unlocked + 2,000 G$ bonus",
    bonusG: 2000,
  },
  {
    days: 14,
    badge: "streak-master",
    rewardLabel: "Luxury Expert unlocked + 5,000 G$ bonus",
    bonusG: 5000,
  },
  {
    days: 30,
    badge: "streak-legend",
    rewardLabel: "All personas unlocked + 20,000 G$ bonus",
    bonusG: 20000,
  },
];

/** All streak-granted badges (for quick membership checks). */
export const G_STREAK_BADGES: readonly string[] = G_STREAK_MILESTONES.map(
  (m) => m.badge,
);

/**
 * Find the next milestone the user has NOT yet reached.
 * Returns null if all milestones are passed.
 */
export function getNextMilestone(currentStreak: number): GStreakMilestone | null {
  return G_STREAK_MILESTONES.find((m) => currentStreak < m.days) ?? null;
}

/**
 * Find the most recent milestone the user HAS reached.
 * Returns null if none yet.
 */
export function getLastReachedMilestone(
  currentStreak: number,
): GStreakMilestone | null {
  let reached: GStreakMilestone | null = null;
  for (const m of G_STREAK_MILESTONES) {
    if (currentStreak >= m.days) reached = m;
  }
  return reached;
}

/**
 * Return all milestones newly crossed when advancing from `prevStreak` to
 * `newStreak`. Used to grant badges + surface bonus notifications.
 */
export function getNewlyReachedMilestones(
  prevStreak: number,
  newStreak: number,
): GStreakMilestone[] {
  return G_STREAK_MILESTONES.filter(
    (m) => prevStreak < m.days && newStreak >= m.days,
  );
}
