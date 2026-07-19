"use client";

import React, { useMemo, useState } from "react";
import Image from "next/image";
import { flushSync } from "react-dom";
import { MapPin, Package, Search, Sparkles, X } from "lucide-react";
import {
  TransitionLink,
  withViewTransition,
} from "../../components/ViewTransition";

export interface DirectoryCurator {
  slug: string;
  name: string;
  type: "human" | "ai";
  verticals: string[];
  brand?: {
    logo?: string;
    colors?: { primary?: string; accent?: string };
    location?: { city: string; landmark?: string };
  };
  channels?: {
    whatsapp?: string;
    telegram?: string;
    instagram?: string;
  };
  createdAt: string;
  liveListingCount: number;
}

interface CuratorDirectoryClientProps {
  curators: DirectoryCurator[];
  verticals: string[];
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Vertical emoji map for visual flair
const VERTICAL_EMOJI: Record<string, string> = {
  football: "⚽",
  streetwear: "🏙️",
  formal: "👔",
  vintage: "📽️",
  luxury: "💎",
  accessories: "👜",
  footwear: "👟",
  jewelry: "💍",
  athleisure: "🏃",
  outerwear: "🧥",
  denim: "👖",
  knitwear: "🧶",
  swimwear: "🏊",
  activewear: "💪",
  resort: "🏖️",
  beauty: "💄",
  eyewear: "🕶️",
  watches: "⌚",
  bags: "🎒",
  hats: "🎩",
};

export function CuratorDirectoryClient({
  curators,
  verticals,
}: CuratorDirectoryClientProps) {
  const [query, setQuery] = useState("");
  const [activeVertical, setActiveVertical] = useState<string | null>(null);

  // Animate the grid reflow when filters change (no-op without support)
  const setVerticalAnimated = (vertical: string | null) =>
    withViewTransition(() => flushSync(() => setActiveVertical(vertical)));
  const clearFiltersAnimated = () =>
    withViewTransition(() =>
      flushSync(() => {
        setQuery("");
        setActiveVertical(null);
      }),
    );

  const filtered = useMemo(() => {
    return curators.filter((c) => {
      // Text search
      if (query.trim()) {
        const q = query.toLowerCase();
        const nameMatch = c.name.toLowerCase().includes(q);
        const slugMatch = c.slug.toLowerCase().includes(q);
        const cityMatch = c.brand?.location?.city?.toLowerCase().includes(q);
        if (!nameMatch && !slugMatch && !cityMatch) return false;
      }
      // Vertical filter
      if (activeVertical && !(c.verticals ?? []).includes(activeVertical)) {
        return false;
      }
      return true;
    });
  }, [curators, query, activeVertical]);

  return (
    <div>
      {/* ── Search + Filters ── */}
      <div className="space-y-4 mb-8">
        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or slug…"
            className="w-full bg-card border border-border rounded-full pl-11 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Vertical filter chips */}
        {verticals.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setVerticalAnimated(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeVertical === null
                  ? "bg-foreground text-background"
                  : "bg-muted/40 text-muted-foreground hover:bg-muted"
              }`}
            >
              All
            </button>
            {verticals.map((v) => (
              <button
                key={v}
                onClick={() =>
                  setVerticalAnimated(activeVertical === v ? null : v)
                }
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1 ${
                  activeVertical === v
                    ? "bg-foreground text-background"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {VERTICAL_EMOJI[v] && <span>{VERTICAL_EMOJI[v]}</span>}
                <span className="capitalize">{v}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Results count ── */}
      <p className="text-xs text-muted-foreground mb-4">
        {filtered.length} curator{filtered.length !== 1 ? "s" : ""}
        {activeVertical && (
          <>
            {" "}
            in <span className="capitalize font-medium">{activeVertical}</span>
          </>
        )}
        {query && (
          <>
            {" "}
            matching &ldquo;{query}&rdquo;
          </>
        )}
      </p>

      {/* ── Curator grid ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="w-8 h-8 text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">
            No curators match your search.
          </p>
          <button
            onClick={clearFiltersAnimated}
            className="mt-3 text-xs text-primary hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((curator) => (
            <CuratorCard key={curator.slug} curator={curator} />
          ))}
        </div>
      )}
    </div>
  );
}

function CuratorCard({ curator }: { curator: DirectoryCurator }) {
  const primary = curator.brand?.colors?.primary || "#6366f1";
  const accent = curator.brand?.colors?.accent || "#f59e0b";
  const city = curator.brand?.location?.city;
  const hasListings = curator.liveListingCount > 0;

  return (
    <TransitionLink
      href={`/s/${curator.slug}`}
      className="group relative flex flex-col rounded-2xl border border-border bg-card overflow-hidden hover:border-foreground/20 hover:shadow-lg transition-all"
      data-view-transition="curator-card"
      style={{ viewTransitionName: `curator-card-${curator.slug}` }}
    >
      {/* Brand color strip */}
      <div
        className="h-1.5 w-full"
        style={{
          background: `linear-gradient(90deg, ${primary}, ${accent})`,
        }}
      />

      {/* Card body */}
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Avatar + name */}
        <div className="flex items-center gap-3">
          {curator.brand?.logo ? (
            <div
              className="relative w-12 h-12 shrink-0"
              data-view-transition="curator-avatar"
              style={{ viewTransitionName: `curator-avatar-${curator.slug}` }}
            >
              <Image
                src={curator.brand.logo}
                alt={curator.name}
                fill
                unoptimized
                className="rounded-xl object-cover border border-border"
              />
            </div>
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-white font-bold text-lg shrink-0"
              data-view-transition="curator-avatar"
              style={{
                background: `linear-gradient(135deg, ${primary}, ${accent})`,
                viewTransitionName: `curator-avatar-${curator.slug}`,
              }}
            >
              {getInitials(curator.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3
              className="font-bold text-foreground truncate group-hover:text-primary transition-colors"
              data-view-transition="curator-name"
              style={{ viewTransitionName: `curator-name-${curator.slug}` }}
            >
              {curator.name}
            </h3>
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {curator.type === "ai" && (
                <span className="flex items-center gap-0.5 text-primary">
                  <Sparkles className="w-3 h-3" />
                  AI
                </span>
              )}
              {city && (
                <span className="flex items-center gap-0.5">
                  <MapPin className="w-3 h-3" />
                  {city}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Verticals */}
        {curator.verticals.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {curator.verticals.slice(0, 4).map((v) => (
              <span
                key={v}
                className="px-2 py-0.5 rounded-md bg-muted/40 text-[10px] font-medium text-muted-foreground capitalize"
              >
                {VERTICAL_EMOJI[v] ? `${VERTICAL_EMOJI[v]} ` : ""}
                {v}
              </span>
            ))}
            {curator.verticals.length > 4 && (
              <span className="px-2 py-0.5 text-[10px] text-muted-foreground">
                +{curator.verticals.length - 4}
              </span>
            )}
          </div>
        )}

        {/* Listing count */}
        <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-border/50">
          <Package className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {hasListings ? (
              <>
                <span className="font-bold text-foreground">
                  {curator.liveListingCount}
                </span>{" "}
                live listing{curator.liveListingCount !== 1 ? "s" : ""}
              </>
            ) : (
              "No live listings"
            )}
          </span>
        </div>
      </div>
    </TransitionLink>
  );
}
