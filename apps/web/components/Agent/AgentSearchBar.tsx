"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";

const SUGGESTIONS = [
  "Black Alo Yoga leggings under $130",
  "Black leggings under $130",
  "Women's running jacket",
  "Neutral yoga set",
];

export interface SearchResult {
  title: string;
  merchant: string;
  product_id: string;
  image?: string;
  offers?: { variant_id: string; price: number; available: boolean }[];
}

interface Props {
  onResults: (results: SearchResult[], query: string) => void;
  loading?: boolean;
}

export function AgentSearchBar({ onResults, loading }: Props) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const isLoading = !!loading || searching;

  const search = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setError(null);
    setSearching(true);
    try {
      const r = await fetch("/prava/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || `Search failed (${r.status})`);
      onResults(data.results || [], q);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    search(query);
  };

  return (
    <div className="w-full">
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative flex items-center">
          <Search className="absolute left-4 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What are you shopping for?"
            className="min-h-[52px] w-full rounded-full border border-border bg-background pl-12 pr-32 text-base text-foreground shadow-lg shadow-primary/5 placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-5 text-sm font-bold text-white transition-all hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50"
          >
            <Sparkles
              className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
            />
            {isLoading ? "Searching" : "Find"}
          </button>
        </div>
      </form>
      {isLoading && (
        <p
          className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Searching live merchant inventory · no payment session created
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Suggestion chips */}
      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            disabled={isLoading}
            onClick={() => {
              setQuery(s);
              search(s);
            }}
            className="rounded-full border border-border/60 bg-muted/40 px-3.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
