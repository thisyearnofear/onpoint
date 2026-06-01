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
import { Bar, TrendSparkline } from "../../../components/admin/TrendSparkline";
import { CuratorComparisonTable } from "./CuratorComparisonTable";

interface DayPoint {
  date: string;
  crossRecoClicks: number;
}

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
  previous7DaysCrossRecoClicks: number;
  crossRecoClickTargets: Record<string, number>;
  crossCuratorAttributions: Record<string, number>;
  crossShareVisits: Record<string, number>;
  last7Days: DayPoint[];
  last30Days: DayPoint[];
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

export function CrossCuratorRecommendationsSection() {
  const [reports, setReports] = useState<CuratorAnalyticsReport[]>([]);
  const [overview, setOverview] = useState<CuratorOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
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
  const totalCrossAttrPurchases = reports.reduce<number>(
    (sum, r) =>
      sum +
      Object.values(r.crossCuratorAttributions || {}).reduce<number>((a, b) => a + b, 0),
    0,
  );

  const mergedClickTargets: Record<string, number> = {};
  for (const r of reports) {
    for (const [slug, count] of Object.entries(r.crossRecoClickTargets || {})) {
      mergedClickTargets[slug] = (mergedClickTargets[slug] || 0) + (count || 0);
    }
  }

  const mergedAttributions: Record<string, number> = {};
  for (const r of reports) {
    for (const [slug, count] of Object.entries(r.crossCuratorAttributions || {})) {
      mergedAttributions[slug] = (mergedAttributions[slug] || 0) + (count || 0);
    }
  }

  // Aggregate 7-day cross-reco clicks
  const dailyClickMap7: Record<string, number> = {};
  for (const r of reports) {
    if (!Array.isArray(r.last7Days)) continue;
    for (const d of r.last7Days) {
      dailyClickMap7[d.date] = (dailyClickMap7[d.date] || 0) + ((d as DayPoint).crossRecoClicks || 0);
    }
  }
  const dates7 = Object.keys(dailyClickMap7).sort();
  const clicks7 = dates7.map((d) => dailyClickMap7[d] || 0);
  const total7 = clicks7.reduce<number>((a, b) => a + b, 0);

  // Aggregate 30-day cross-reco clicks
  const dailyClickMap30: Record<string, number> = {};
  for (const r of reports) {
    if (!Array.isArray(r.last30Days)) continue;
    for (const d of r.last30Days) {
      dailyClickMap30[d.date] = (dailyClickMap30[d.date] || 0) + ((d as DayPoint).crossRecoClicks || 0);
    }
  }
  const dates30 = Object.keys(dailyClickMap30).sort();
  const clicks30 = dates30.map((d) => dailyClickMap30[d] || 0);
  const total30 = clicks30.reduce<number>((a, b) => a + b, 0);
  const has30 = clicks30.some((v) => v > 0);

  // WoW comparison
  const totalPrevWeek = reports.reduce<number>(
    (sum, r) => sum + (r.previous7DaysCrossRecoClicks || 0),
    0,
  );
  const wowDelta = total7 - totalPrevWeek;
  const wowPct = totalPrevWeek > 0 ? Math.round((wowDelta / totalPrevWeek) * 100) : 0;
  const wowDirection = wowDelta > 0 ? "up" : wowDelta < 0 ? "down" : "flat";

  const recoClickToVisitRate =
    totalCrossRecoClicks > 0
      ? pct(totalCrossShareVisits, totalCrossRecoClicks)
      : "—";

  const curatorBreakdown = reports
    .filter((r) => (r.crossRecoClicks || 0) > 0)
    .sort((a, b) => (b.crossRecoClicks || 0) - (a.crossRecoClicks || 0));

  const hasData = clicks7.some((v) => v > 0) || has30;

  // Build curator name map from overview
  const curatorNames: Record<string, string> = {};
  if (overview?.topCurators) {
    for (const c of overview.topCurators) {
      curatorNames[c.slug] = c.name;
    }
  }

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

      {/* Trend sparkline — 7d/30d aggregated across all curators */}
      {hasData && (
        <TrendSparkline
          title="cross-curator clicks"
          titleSuffix="(all curators)"
          data7d={clicks7}
          data30d={clicks30}
          dates7d={dates7}
          dates30d={dates30}
          total7d={total7}
          total30d={total30}
          has30Data={has30}
          wow={{
            delta: wowDelta,
            pct: wowPct,
            direction: wowDirection,
            prevTotal: totalPrevWeek,
          }}
        />
      )}

      {/* Curator comparison table */}
      {reports.length > 0 && (
        <CuratorComparisonTable
          reports={reports}
          curatorNames={curatorNames}
        />
      )}

      {/* Per-curator breakdown + Target map */}
      <div className="grid gap-4 lg:grid-cols-2">
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
                      height="h-2"
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

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Link2 className="h-4 w-4 text-sky-500" />
            Clicks received by target curator
          </h3>
          {Object.keys(mergedClickTargets).length > 0 ? (
            <div className="space-y-3">
              {Object.entries(mergedClickTargets)
                .sort(([, a], [, b]) => (b || 0) - (a || 0))
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
                        height="h-2"
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
                      attributed purchase{count === 1 ? "" : "s"}
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
