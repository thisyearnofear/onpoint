/**
 * CrossCuratorRecommendations — shows curated picks from complementary
 * curators that pair well with the current storefront's verticals.
 *
 * Each card links to the recommended curator's storefront with attribution
 * tracking via ?ref=cross:<sourceSlug>.
 */

"use client";

import React from "react";
import Link from "next/link";
import { Sparkles, ExternalLink } from "lucide-react";
import { trackCuratorCrossRecommendationClick } from "../lib/utils/analytics";

interface Recommendation {
  listingId: string;
  curatorSlug: string;
  curatorName: string;
  curatorColor: string;
  itemTitle: string;
  itemSubtitle: string;
  imageUrl: string | null;
  lowestPrice: number | null;
  compatibilityScore: number;
  matchReason: string;
}

interface CrossCuratorRecommendationsProps {
  sourceCuratorSlug: string;
  limit?: number;
}

function formatPrice(value: number | null) {
  if (!value) return null;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0,
  }).format(value);
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function CrossCuratorRecommendations({
  sourceCuratorSlug,
  limit = 6,
}: CrossCuratorRecommendationsProps) {
  const [recommendations, setRecommendations] = React.useState<
    Recommendation[]
  >([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function fetchRecommendations() {
      try {
        const res = await fetch(
          `/api/curator/recommendations?curatorSlug=${encodeURIComponent(sourceCuratorSlug)}&limit=${limit}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!cancelled) {
          setRecommendations(data.recommendations || []);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
          setLoading(false);
        }
      }
    }

    fetchRecommendations();
    return () => {
      cancelled = true;
    };
  }, [sourceCuratorSlug, limit]);

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Finding complementary styles...
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-48 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Gracefully hide if no recommendations
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">
          Picked for you by AI
        </h2>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
          {recommendations.length} items
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Our AI stylists found pieces from other curators that pair well with
        this collection.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {recommendations.map((rec) => (
          <Link
            key={rec.listingId}
            href={`/s/${rec.curatorSlug}?ref=cross:${sourceCuratorSlug}`}
            onClick={() => {
              trackCuratorCrossRecommendationClick({
                sourceCuratorSlug,
                targetCuratorSlug: rec.curatorSlug,
                listingId: rec.listingId,
                itemTitle: rec.itemTitle,
                matchReason: rec.matchReason,
                compatibilityScore: rec.compatibilityScore,
              });
              // Fire Redis event for funnel analytics
              fetch("/api/curator/analytics/track", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  event: "cross_reco_click",
                  curatorSlug: sourceCuratorSlug,
                  targetCuratorSlug: rec.curatorSlug,
                }),
              }).catch(() => {});
            }}
            className="group overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-all hover:shadow-md hover:border-primary/30"
          >
            {/* Image or placeholder */}
            <div className="relative aspect-[4/3] bg-muted">
              {rec.imageUrl ? (
                <img
                  src={rec.imageUrl}
                  alt={rec.itemTitle}
                  className="h-full w-full object-cover transition-transform group-hover:scale-105"
                />
              ) : (
                <div
                  className="flex h-full flex-col items-center justify-center gap-2 text-white"
                  style={{
                    background: `linear-gradient(135deg, ${rec.curatorColor}, ${rec.curatorColor}88)`,
                  }}
                >
                  <div className="grid h-12 w-12 place-items-center rounded-full border border-white/25 bg-white/15 text-lg font-black backdrop-blur">
                    {getInitials(rec.curatorName)}
                  </div>
                  <span className="text-xs font-bold">{rec.curatorName}</span>
                </div>
              )}

              {/* Curator badge */}
              <div className="absolute left-2 top-2 flex items-center gap-1.5 rounded-full bg-background/90 px-2 py-1 text-[10px] font-bold shadow-sm backdrop-blur">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ background: rec.curatorColor }}
                />
                {rec.curatorName}
              </div>

              {/* External link icon */}
              <div className="absolute right-2 top-2 rounded-full bg-background/80 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </div>
            </div>

            {/* Card body */}
            <div className="space-y-2 p-3">
              <div>
                <h3 className="text-sm font-bold text-foreground">
                  {rec.itemTitle}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {rec.itemSubtitle}
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">
                  {formatPrice(rec.lowestPrice) || "Ask"}
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {rec.matchReason}
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
