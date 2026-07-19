"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  GitBranch,
  Link2,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Bar, TrendSparkline } from "../../../../components/admin/TrendSparkline";

interface DayPoint {
  date: string;
  crossRecoClicks: number;
}

interface CrossRecoReport {
  crossRecoClicks: number;
  previous7DaysCrossRecoClicks: number;
  crossRecoClickTargets: Record<string, number>;
  crossCuratorAttributions: Record<string, number>;
  shareVisits: number;
  last7Days: DayPoint[];
  last30Days: DayPoint[];
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function CrossCuratorSummaryCard({ slug }: { slug: string }) {
  const [report, setReport] = useState<CrossRecoReport | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/curator/analytics?curatorSlug=${encodeURIComponent(slug)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      const r = data.report;
      if (r) {
        setReport({
          crossRecoClicks: r.crossRecoClicks || 0,
          previous7DaysCrossRecoClicks: r.previous7DaysCrossRecoClicks || 0,
          crossRecoClickTargets: r.crossRecoClickTargets || {},
          crossCuratorAttributions: r.crossCuratorAttributions || {},
          shareVisits: r.shareVisits || 0,
          last7Days: Array.isArray(r.last7Days)
            ? r.last7Days.map((d: Record<string, unknown>) => ({
                date: d.date as string,
                crossRecoClicks: (d.crossRecoClicks as number) || 0,
              }))
            : [],
          last30Days: Array.isArray(r.last30Days)
            ? r.last30Days.map((d: Record<string, unknown>) => ({
                date: d.date as string,
                crossRecoClicks: (d.crossRecoClicks as number) || 0,
              }))
            : [],
        });
      }
    } catch {
      // Graceful
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, [slug]);

  if (loading && !report) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <h2 className="font-bold">Cross-curator recommendations</h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!report) return null;

  const hasAnyData =
    report.crossRecoClicks > 0 ||
    Object.keys(report.crossRecoClickTargets).length > 0 ||
    Object.keys(report.crossCuratorAttributions).length > 0;

  if (!hasAnyData) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <h2 className="font-bold">Cross-curator recommendations</h2>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          No cross-curator recommendation activity yet. When shoppers see
          recommendation cards on this storefront and click through, the stats
          will appear here.
        </p>
      </div>
    );
  }

  const clickToVisitRate =
    report.crossRecoClicks > 0
      ? pct(report.shareVisits, report.crossRecoClicks)
      : "—";

  const totalAttributedPurchases = Object.values(
    report.crossCuratorAttributions,
  ).reduce((a, b) => a + b, 0);

  const sortedTargets = Object.entries(report.crossRecoClickTargets)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const sortedAttributions = Object.entries(report.crossCuratorAttributions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 6);

  const maxTargetClicks = Math.max(...sortedTargets.map(([, c]) => c), 1);

  // Data for TrendSparkline
  const data7d = report.last7Days.map((d) => d.crossRecoClicks);
  const data30d = (report.last30Days || []).map((d) => d.crossRecoClicks);
  const total7d = data7d.reduce((a, b) => a + b, 0);
  const total30d = data30d.reduce((a, b) => a + b, 0);
  const has30 = data30d.some((v) => v > 0);
  const hasSparkline = data7d.some((v) => v > 0) || has30;

  // Week-over-week comparison
  const prevWeekClicks = report.previous7DaysCrossRecoClicks || 0;
  const wowDelta = total7d - prevWeekClicks;
  const wowPct = prevWeekClicks > 0 ? Math.round((wowDelta / prevWeekClicks) * 100) : 0;
  const wowDirection = wowDelta > 0 ? "up" : wowDelta < 0 ? "down" : "flat";

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-info" />
          <h2 className="font-bold">Cross-curator recommendations</h2>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Summary stats */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Reco clicks sent</p>
            <Sparkles className="h-3.5 w-3.5 text-info" />
          </div>
          <p className="mt-1 text-xl font-black tabular-nums">
            {report.crossRecoClicks.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {clickToVisitRate} click → visit
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Clicks received</p>
            <ArrowRightLeft className="h-3.5 w-3.5 text-sky-500" />
          </div>
          <p className="mt-1 text-xl font-black tabular-nums">
            {Object.values(report.crossRecoClickTargets)
              .reduce((a, b) => a + b, 0)
              .toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            From other storefronts
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Attributed purchases
            </p>
            <TrendingUp className="h-3.5 w-3.5 text-success" />
          </div>
          <p className="mt-1 text-xl font-black tabular-nums">
            {totalAttributedPurchases.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Traced to cross-curator referrals
          </p>
        </div>
      </div>

      {/* Trend sparkline — 7d/30d */}
      {hasSparkline && (
        <TrendSparkline
          title="cross-curator clicks"
          data7d={data7d}
          data30d={data30d}
          dates7d={report.last7Days.map((d) => d.date)}
          dates30d={(report.last30Days || []).map((d) => d.date)}
          total7d={total7d}
          total30d={total30d}
          has30Data={has30}
          wow={{
            delta: wowDelta,
            pct: wowPct,
            direction: wowDirection,
            prevTotal: prevWeekClicks,
          }}
        />
      )}

      {/* Breakdowns */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {sortedTargets.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <GitBranch className="h-3.5 w-3.5" />
              Clicks sent to other curators
            </h3>
            <div className="space-y-2">
              {sortedTargets.map(([targetSlug, count]) => (
                <div key={targetSlug}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium capitalize">
                      {targetSlug}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {count}
                    </span>
                  </div>
                  <Bar value={count} max={maxTargetClicks} />
                </div>
              ))}
            </div>
          </div>
        )}

        {sortedAttributions.length > 0 && (
          <div>
            <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Link2 className="h-3.5 w-3.5" />
              Purchases attributed from
            </h3>
            <div className="space-y-2">
              {sortedAttributions.map(([sourceSlug, count]) => (
                <div
                  key={sourceSlug}
                  className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 px-3 py-2"
                >
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/10 text-[10px] font-bold text-success">
                    {count}
                  </div>
                  <span className="text-xs font-medium capitalize">
                    {sourceSlug}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
