"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowRightLeft,
  GitBranch,
  Link2,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Users,
} from "lucide-react";

interface CuratorAnalyticsReport {
  slug: string;
  pageViews: number;
  tryOns: number;
  buyClicks: number;
  shares: number;
  shareVisits: number;
  leads: number;
  purchases: number;
  highIntentViews: number;
  crossRecoClicks: number;
  crossRecoClickTargets: Record<string, number>;
  crossCuratorAttributions: Record<string, number>;
  crossShareVisits: Record<string, number>;
}

interface CuratorOverview {
  totalCurators: number;
  topCurators: Array<{
    slug: string;
    name: string;
    pageViews: number;
    purchases: number;
  }>;
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

// ── Bar component ──
function Bar({
  value,
  max,
  color = "bg-primary",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(p, 2)}%` }}
      />
    </div>
  );
}

export function CrossCuratorRecommendationsSection() {
  const [reports, setReports] = useState<CuratorAnalyticsReport[]>([]);
  const [overview, setOverview] = useState<CuratorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      // Fetch overview to get curator list
      const overviewRes = await fetch("/api/curator/analytics");
      if (!overviewRes.ok) throw new Error(`HTTP ${overviewRes.status}`);
      const overviewData = await overviewRes.json();
      const ov: CuratorOverview | null = overviewData.overview || null;
      setOverview(ov);

      if (!ov || ov.topCurators.length === 0) {
        setReports([]);
        setLoading(false);
        return;
      }

      // Fetch per-curator reports (with cross-reco data)
      const curatorReports = await Promise.allSettled(
        ov.topCurators.map(async (c) => {
          const res = await fetch(
            `/api/curator/analytics?curatorSlug=${encodeURIComponent(c.slug)}`,
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();
          return data.report as CuratorAnalyticsReport;
        }),
      );

      const successful = curatorReports
        .filter(
          (r): r is PromiseFulfilledResult<CuratorAnalyticsReport> =>
            r.status === "fulfilled",
        )
        .map((r) => r.value);

      setReports(successful);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load cross-curator data",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  // Aggregate cross-curator metrics
  const totalCrossRecoClicks = reports.reduce(
    (sum, r) => sum + (r.crossRecoClicks || 0),
    0,
  );
  const totalCrossShareVisits = reports.reduce(
    (sum, r) => sum + (r.shareVisits || 0),
    0,
  );
  const totalCrossAttrPurchases = reports.reduce(
    (sum, r) =>
      sum +
      Object.values(r.crossCuratorAttributions || {}).reduce((a, b) => a + b, 0),
    0,
  );

  // Merge all cross-reco click targets across curators
  const mergedClickTargets: Record<string, number> = {};
  for (const r of reports) {
    for (const [slug, count] of Object.entries(
      r.crossRecoClickTargets || {},
    )) {
      mergedClickTargets[slug] = (mergedClickTargets[slug] || 0) + count;
    }
  }

  // Merge all cross-curator attributions
  const mergedAttributions: Record<string, number> = {};
  for (const r of reports) {
    for (const [slug, count] of Object.entries(
      r.crossCuratorAttributions || {},
    )) {
      mergedAttributions[slug] =
        (mergedAttributions[slug] || 0) + count;
    }
  }

  // Cross-curator flow rate
  const recoClickToVisitRate =
    totalCrossRecoClicks > 0
      ? pct(totalCrossShareVisits, totalCrossRecoClicks)
      : "—";

  // Per-curator cross-reco breakdown
  const curatorBreakdown = reports
    .filter((r) => (r.crossRecoClicks || 0) > 0)
    .sort((a, b) => (b.crossRecoClicks || 0) - (a.crossRecoClicks || 0));

  // ── Loading ──
  if (loading && reports.length === 0) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">
            Cross-Curator Recommendations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered recommendation clicks, visits, and attributed purchases
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error && reports.length === 0) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">
            Cross-Curator Recommendations
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered recommendation clicks, visits, and attributed purchases
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">
            Failed to load cross-curator data
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">
              Cross-Curator Recommendations
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              AI-powered recommendation clicks, visits, and attributed purchases
              across curator storefronts
            </p>
          </div>
          <button
            onClick={fetchData}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Recommendation clicks
              </p>
              <p className="text-2xl font-black tracking-tight">
                {totalCrossRecoClicks.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Cards clicked across all storefronts
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-violet-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Click → Visit rate
              </p>
              <p className="text-2xl font-black tracking-tight">
                {recoClickToVisitRate}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {totalCrossShareVisits.toLocaleString()} visits from{" "}
                {totalCrossRecoClicks.toLocaleString()} clicks
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-sky-500">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Attributed purchases
              </p>
              <p className="text-2xl font-black tracking-tight">
                {totalCrossAttrPurchases.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Purchases traced to cross-curator referrals
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-emerald-500">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Active curators
              </p>
              <p className="text-2xl font-black tracking-tight">
                {curatorBreakdown.length}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Sending cross-curator recommendations
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Per-curator breakdown + Target map */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Per-curator cross-reco clicks */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <GitBranch className="h-4 w-4 text-primary" />
            Cross-reco clicks by source curator
          </h3>
          {curatorBreakdown.length > 0 ? (
            <div className="space-y-3">
              {curatorBreakdown.map((r) => {
                const maxClicks = Math.max(
                  ...curatorBreakdown.map((c) => c.crossRecoClicks || 0),
                  1,
                );
                return (
                  <div key={r.slug}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium capitalize">{r.slug}</span>
                      <span className="ml-2 shrink-0 text-muted-foreground tabular-nums">
                        {r.crossRecoClicks || 0} clicks
                        <span className="ml-1 text-[11px]">
                          ({pct(r.shareVisits || 0, r.crossRecoClicks || 0)}{" "}
                          visit rate)
                        </span>
                      </span>
                    </div>
                    <Bar
                      value={r.crossRecoClicks || 0}
                      max={maxClicks}
                      color="bg-violet-500"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No cross-curator recommendation clicks yet
            </p>
          )}
        </div>

        {/* Target curator breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-sky-500" />
            Clicks received by target curator
          </h3>
          {Object.keys(mergedClickTargets).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(mergedClickTargets)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 8)
                .map(([slug, count]) => {
                  const maxCount = Math.max(
                    ...Object.values(mergedClickTargets),
                    1,
                  );
                  return (
                    <div key={slug}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium capitalize">{slug}</span>
                        <span className="ml-2 shrink-0 font-medium tabular-nums">
                          {count}
                        </span>
                      </div>
                      <Bar
                        value={count}
                        max={maxCount}
                        color="bg-sky-500"
                      />
                    </div>
                  );
                })}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No cross-curator click targets yet
            </p>
          )}
        </div>
      </div>

      {/* Cross-curator attribution map */}
      {Object.keys(mergedAttributions).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">
            Cross-curator purchase attributions
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(mergedAttributions)
              .sort(([, a], [, b]) => b - a)
              .map(([slug, count]) => (
                <div
                  key={slug}
                  className="flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-xs font-bold text-emerald-600">
                    {count}
                  </div>
                  <div>
                    <p className="text-sm font-medium capitalize">{slug}</p>
                    <p className="text-[11px] text-muted-foreground">
                      attributed purchase{count === 1 ? "" : ""}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Cross-curator data tracked via{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
          cross_reco_click
        </code>{" "}
        events and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
          share_visit
        </code>{" "}
        referral attribution. Updates in near-real-time.
      </p>
    </div>
  );
}
