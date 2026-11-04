/**
 * Style board hearts — on-device picks, same pattern as runway-history.
 * Only outfit ids are stored; no server calls, no accounts.
 * Single home for saved outfits: the style board and the wardrobe studio both read/write here.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface HeartsState {
  hearts: string[];
  toggle: (id: string) => void;
  /** Merge ids in without duplicating or reordering existing picks (used for migration). */
  addMany: (ids: string[]) => void;
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
      addMany: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.hearts.includes(id));
          return fresh.length ? { hearts: [...s.hearts, ...new Set(fresh)] } : s;
        }),
      has: (id) => get().hearts.includes(id),
    }),
    { name: "style-board-hearts" },
  ),
);
