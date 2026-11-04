/**
 * Style board hearts — on-device picks, same pattern as runway-history.
 * Only outfit ids are stored; no server calls, no accounts.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HeartsState {
  hearts: string[];
  toggle: (id: string) => void;
  has: (id: string) => boolean;
}

export const useStyleHearts = create<HeartsState>()(
  persist(
    (set, get) => ({
      hearts: [],
      toggle: (id) =>
        set((s) => ({
          hearts: s.hearts.includes(id) ? s.hearts.filter((h) => h !== id) : [...s.hearts, id],
        })),
      has: (id) => get().hearts.includes(id),
    }),
    { name: "style-board-hearts" },
  ),
);
