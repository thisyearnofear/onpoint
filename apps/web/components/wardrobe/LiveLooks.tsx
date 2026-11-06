"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw, Shirt, Sparkles, X } from "lucide-react";
import { LookCard, type LookCardData } from "../LookCard";
import { getApiBase } from "../../lib/utils/api-base";
import { OCCASIONS, SEASONS, SORT_OPTIONS, VIBES } from "../../lib/looks/constants";
import { sortLooks } from "../../lib/looks/sort";
import {
  buildOutfitsHref,
  hasActiveLooksFilters,
  looksQuery,
  type LiveLooksFilters,
} from "../../lib/looks/params";

interface LiveLooksProps {
  filters: LiveLooksFilters;
  onFiltersChange: (next: LiveLooksFilters) => void;
}

type FilterKey = "category" | "occasion" | "season" | "sort" | "curator";

const GRID = "grid gap-6 sm:grid-cols-2 lg:grid-cols-3";
const chip =
  "inline-flex min-h-[44px] items-center rounded-full border px-3 text-sm transition-colors";
const chipIdle = `${chip} border-border text-muted-foreground hover:text-foreground hover:bg-muted/60`;
const chipActive = `${chip} border-foreground bg-foreground font-bold text-background`;

function FilterRow({
  label,
  options,
  value,
  onSelect,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={label}>
      <span className="mr-1 text-sm font-semibold text-muted-foreground">{label}</span>
      {options.map((option) => (
        <button
          key={option.value || "all"}
          type="button"
          className={value === option.value ? chipActive : chipIdle}
          aria-pressed={value === option.value}
          onClick={() => onSelect(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function LiveLooks({ filters, onFiltersChange }: LiveLooksProps) {
  const [looks, setLooks] = useState<LookCardData[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [attempt, setAttempt] = useState(0);
  const [showFilters, setShowFilters] = useState(false);
  const query = looksQuery(filters);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    setState("loading");
    fetch(`${getApiBase()}/api/looks?${query}`, { signal: controller.signal })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: { looks?: LookCardData[] }) => {
        if (cancelled) return;
        setLooks(sortLooks(data.looks || [], filters.sort));
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [query, filters.sort, attempt]);

  const select = useCallback(
    (key: FilterKey, value: string) => {
      const next = { ...filters, [key]: value };
      window.history.replaceState(null, "", buildOutfitsHref(next, window.location.search));
      onFiltersChange(next);
    },
    [filters, onFiltersChange],
  );

  const clearAll = useCallback(() => {
    const next = { ...filters, category: "", occasion: "", season: "", tag: "", curator: "" };
    window.history.replaceState(null, "", buildOutfitsHref(next, window.location.search));
    onFiltersChange(next);
  }, [filters, onFiltersChange]);

  return (
    <section aria-label="Live looks from curators" aria-busy={state === "loading"}>
      <h3 className="text-base font-bold leading-tight">Live looks</h3>
      <p className="mt-1 text-sm text-muted-foreground">
        Real outfits from OnPoint curators — try any of them on, and shop the pieces.
      </p>

      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FilterRow label="Sort" options={[...SORT_OPTIONS]} value={filters.sort} onSelect={(v) => select("sort", v)} />
          <button
            type="button"
            className={showFilters ? chipActive : chipIdle}
            aria-expanded={showFilters}
            onClick={() => setShowFilters((s) => !s)}
          >
            Filters{hasActiveLooksFilters(filters) ? " · on" : ""}
          </button>
        </div>
        {showFilters && (
          <>
            <FilterRow label="Vibe" options={VIBES} value={filters.category} onSelect={(v) => select("category", v)} />
            <FilterRow label="Occasion" options={OCCASIONS} value={filters.occasion} onSelect={(v) => select("occasion", v)} />
            <FilterRow label="Season" options={SEASONS} value={filters.season} onSelect={(v) => select("season", v)} />
          </>
        )}
        {filters.curator && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border px-3 text-sm">
              From {filters.curator}
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={`Stop filtering by ${filters.curator}`}
                onClick={() => select("curator", "")}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          </div>
        )}
      </div>

      {state === "loading" && (
        <div className="mt-6">
          <p className="text-sm font-semibold text-muted-foreground">Loading live looks…</p>
          <div className={`${GRID} mt-4`}>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-2xl border border-dashed border-border bg-muted/30" />
            ))}
          </div>
        </div>
      )}

      {state === "failed" && (
        <div className="mt-6 rounded-2xl border border-dashed border-border p-6">
          <p className="text-sm font-semibold">Live looks aren&apos;t reachable right now.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            The studio references below are still here. Or{" "}
            <button
              type="button"
              className="font-bold text-primary hover:underline"
              onClick={() => setAttempt((a) => a + 1)}
            >
              try loading them again
            </button>
            .
          </p>
        </div>
      )}

      {state === "ready" && looks.length === 0 && (
        <div className="mt-6 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
          <Shirt className="mb-4 h-12 w-12 text-muted-foreground/30" />
          <h4 className="text-lg font-bold">
            {hasActiveLooksFilters(filters) ? "No looks match those filters" : "No looks yet"}
          </h4>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            {hasActiveLooksFilters(filters)
              ? "Try a different vibe, or clear the filters."
              : "Looks are style boards built from curator inventory. Browse curators, or see what Nia put together."}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            {hasActiveLooksFilters(filters) ? (
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                onClick={clearAll}
              >
                <RefreshCw className="h-4 w-4" />
                Clear filters
              </button>
            ) : (
              <>
                <Link
                  href="/curators"
                  className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/90"
                >
                  Browse curators
                </Link>
                <Link
                  href="/s/nia"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm font-bold transition-colors hover:bg-muted"
                >
                  <Sparkles className="h-4 w-4" />
                  Try Nia&apos;s digital looks
                </Link>
              </>
            )}
          </div>
        </div>
      )}

      {state === "ready" && looks.length > 0 && (
        <div className={`${GRID} mt-6`}>
          {looks
            .filter((l, i, a) => a.findIndex((x) => (x.title || "") === (l.title || "")) === i)
            .map((look) => (
              <LookCard key={look.id} look={look} />
            ))}
        </div>
      )}
    </section>
  );
}
