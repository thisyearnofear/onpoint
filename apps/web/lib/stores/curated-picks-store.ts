import { create } from "zustand";
import type { CuratedPick, CurationContext } from "../utils/curated-picks";

interface CuratedPicksState {
  picks: CuratedPick[];
  queries: string[];
  source: string;
  cached: boolean;
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
  contextKey: string | null;

  fetchPicks: (context: CurationContext) => Promise<void>;
  clear: () => void;
}

const CACHE_KEY_PREFIX = "onpoint-curated-picks:";
const CACHE_TTL_MS = 10 * 60 * 1000;

let inFlightPromise: Promise<void> | null = null;
let inFlightKey: string | null = null;

function hashContext(ctx: CurationContext): string {
  const str = JSON.stringify({
    s: ctx.score,
    t: ctx.takeaways.slice(0, 5),
    p: ctx.persona || "",
    g: ctx.sessionGoal || "",
  });
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return String(hash);
}

export const useCuratedPicksStore = create<CuratedPicksState>()((set, get) => ({
  picks: [],
  queries: [],
  source: "",
  cached: false,
  loading: false,
  error: null,
  fetchedAt: null,
  contextKey: null,

  fetchPicks: async (context: CurationContext) => {
    const key = hashContext(context);
    const state = get();

    if (state.contextKey === key && !state.loading) return;
    if (inFlightKey === key && inFlightPromise) {
      return inFlightPromise;
    }

    try {
      const cached = sessionStorage.getItem(CACHE_KEY_PREFIX + key);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
          set({
            picks: parsed.picks,
            queries: parsed.queries,
            source: parsed.source,
            cached: true,
            loading: false,
            error: null,
            fetchedAt: parsed.timestamp,
            contextKey: key,
          });
          return;
        }
        sessionStorage.removeItem(CACHE_KEY_PREFIX + key);
      }
    } catch {
      // sessionStorage unavailable or corrupted — fall through to fetch
    }

    const promise = (async () => {
      set({ loading: true, error: null, contextKey: key });

      try {
        const res = await fetch("/api/agent/curated-shop", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(context),
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const now = Date.now();
        set({
          picks: data.picks || [],
          queries: data.queries || [],
          source: data.source || "",
          cached: data.cached || false,
          loading: false,
          error: null,
          fetchedAt: now,
          contextKey: key,
        });

        try {
          sessionStorage.setItem(
            CACHE_KEY_PREFIX + key,
            JSON.stringify({
              picks: data.picks,
              queries: data.queries,
              source: data.source,
              timestamp: now,
            }),
          );
        } catch {
          // quota exceeded — non-fatal
        }
      } catch (err) {
        set({
          loading: false,
          error: err instanceof Error ? err.message : "Fetch failed",
        });
      } finally {
        inFlightPromise = null;
        inFlightKey = null;
      }
    })();

    inFlightPromise = promise;
    inFlightKey = key;
    return promise;
  },

  clear: () => {
    set({
      picks: [],
      queries: [],
      source: "",
      cached: false,
      loading: false,
      error: null,
      fetchedAt: null,
      contextKey: null,
    });
  },
}));
