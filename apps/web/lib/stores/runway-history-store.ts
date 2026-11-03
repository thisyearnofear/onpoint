/**
 * Runway history — on-device record of judged rounds (ops/retention.md).
 * Persisted to localStorage via zustand persist; capped at 50 entries,
 * newest first. Photo data is NEVER stored — only the score metadata.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface RunwayEntry {
  roundId: string;
  themeId: string;
  themeName: string;
  judge: string;
  total: number;
  scores: { theme: number; cohesion: number; styling: number };
  verdict: string;
  at: number;
}

interface RunwayHistoryState {
  entries: RunwayEntry[];
  addEntry: (e: RunwayEntry) => void;
  clear: () => void;
}

const MAX_ENTRIES = 50;

export const useRunwayHistory = create<RunwayHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      addEntry: (e) =>
        set((s) => ({
          entries: [e, ...s.entries.filter((x) => x.roundId !== e.roundId)].slice(0, MAX_ENTRIES),
        })),
      clear: () => set({ entries: [] }),
    }),
    { name: "runway-history" },
  ),
);

const DAY_MS = 86400000;
const utcDay = (ms: number) => Math.floor(ms / DAY_MS);

/** Consecutive UTC days with >=1 round, ending today (or yesterday if none today). */
export function computeStreak(entries: RunwayEntry[], nowMs: number): number {
  const days = new Set(entries.map((e) => utcDay(e.at)));
  if (days.size === 0) return 0;
  const today = utcDay(nowMs);
  let d = days.has(today) ? today : today - 1;
  if (!days.has(d)) return 0;
  let streak = 0;
  while (days.has(d)) {
    streak++;
    d--;
  }
  return streak;
}

export function bestScore(entries: RunwayEntry[]): number | null {
  return entries.length ? Math.max(...entries.map((e) => e.total)) : null;
}

export function roundsPlayed(entries: RunwayEntry[]): number {
  return entries.length;
}
