/**
 * Analysis History Store
 *
 * Persists completed style analysis sessions to localStorage
 * so the PolaroidGallery ("My Looks") can display them across page refreshes.
 *
 * Follows the same zustand + persist pattern as cart-store.ts.
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AnalysisSession {
  id: string;
  /** ISO-8601 timestamp */
  createdAt: string;
  /** 1-10 AI style score */
  score: number;
  /** What the user was going for */
  sessionGoal: string | null;
  /** Which persona analysed them */
  persona: string | null;
  /** First takeaway line (used as the caption) */
  headline: string;
  /** All AI takeaways */
  takeaways: string[];
  /** Topics that were analysed */
  topics: string[];
  /** Base64 data-URL of the primary capture */
  coverImage: string | null;
  /** Additional capture images */
  extraImages: string[];
  /** Product recommendations from the session */
  recommendations: Array<{ name: string; price: number; category: string }>;
}

interface HistoryState {
  sessions: AnalysisSession[];

  // Actions
  addSession: (session: Omit<AnalysisSession, "id" | "createdAt">) => void;
  removeSession: (id: string) => void;
  clearHistory: () => void;

  // Queries
  latestSession: () => AnalysisSession | undefined;
  sessionCount: () => number;
}

export const useAnalysisHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      sessions: [],

      addSession: (data) => {
        const session: AnalysisSession = {
          ...data,
          id: `analysis_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          sessions: [session, ...state.sessions].slice(0, 50),
        }));
      },

      removeSession: (id) => {
        set((state) => ({
          sessions: state.sessions.filter((s) => s.id !== id),
        }));
      },

      clearHistory: () => set({ sessions: [] }),

      latestSession: () => get().sessions[0],
      sessionCount: () => get().sessions.length,
    }),
    {
      name: "onpoint-analysis-history",
      partialize: (state) => ({ sessions: state.sessions }),
    },
  ),
);
