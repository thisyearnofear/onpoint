"use client";

import { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  GitBranch,
  Link2,
  RefreshCw,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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

function Bar({
  value,
  max,
  color = "bg-violet-500",
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(p, 2)}%` }}
      />
    </div>
  );
}

/** Mini sparkline rendered as an SVG polyline. */
function Sparkline({
  data,
  color = "rgb(139 92 246)", // violet-500
  height = 32,
  width = 120,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 4;
  const effectiveH = height - padY * 2;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = padY + effectiveH - ((v - min) / range) * effectiveH;
      return `${x},${y}`;
    })
    .join(" ");

  // Area fill path (closes at bottom)
  const areaPoints = points + ` ${width},${height} 0,${height}`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`spark-fill-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon
        points={areaPoints}
        fill={`url(#spark-fill-${color.replace(/[^a-z0-9]/gi, "")})`}
      />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Short label for a date: "Mon", "Tue", etc. */
function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "short",
  });
}

/** Compact date label for 30-day view: "6/1", "6/2", etc. */
function shortDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
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
          <Sparkles className="h-4 w-4 text-violet-500" />
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
          <Sparkles className="h-4 w-4 text-violet-500" />
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

  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");

  // Sparkline data based on selected range
  const clicks30 = (report.last30Days || []).map((d) => d.crossRecoClicks);
  const dailyClicks = timeRange === "7d"
    ? report.last7Days.map((d) => d.crossRecoClicks)
    : clicks30;
  const totalLast7 = report.last7Days.reduce((a, b) => a + b.crossRecoClicks, 0);
  const totalLast30 = clicks30.reduce((a, b) => a + b, 0);
  const activeTotal = timeRange === "7d" ? totalLast7 : totalLast30;
  const hasSparklineData = dailyClicks.some((v) => v > 0);
  const activeDates = timeRange === "7d" ? report.last7Days : (report.last30Days || []);
  const has30 = clicks30.some((v) => v > 0);

  // Week-over-week comparison
  const prevWeekClicks = report.previous7DaysCrossRecoClicks || 0;
  const wowDelta = totalLast7 - prevWeekClicks;
  const wowPct = prevWeekClicks > 0 ? Math.round((wowDelta / prevWeekClicks) * 100) : 0;
  const wowDirection = wowDelta > 0 ? "up" : wowDelta < 0 ? "down" : "flat";

  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-500" />
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

      {/* Summary stats + daily sparkline */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Reco clicks sent</p>
            <Sparkles className="h-3.5 w-3.5 text-violet-500" />
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
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="mt-1 text-xl font-black tabular-nums">
            {totalAttributedPurchases.toLocaleString()}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Traced to cross-curator referrals
          </p>
        </div>
      </div>

      {/* Daily sparkline — 7d/30d cross-reco click trend */}
      {hasSparklineData && (
        <div className="mt-4 rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  {timeRange === "7d" ? "Last 7 days" : "Last 30 days"} — cross-curator clicks
                </p>
                {/* 7d / 30d toggle */}
                <div className="flex overflow-hidden rounded-md border border-border bg-background">
                  <button
                    onClick={() => setTimeRange("7d")}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      timeRange === "7d"
                        ? "bg-violet-500/15 text-violet-600"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    7d
                  </button>
                  <button
                    onClick={() => setTimeRange("30d")}
                    disabled={!has30}
                    className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
                      timeRange === "30d"
                        ? "bg-violet-500/15 text-violet-600"
                        : "text-muted-foreground hover:bg-muted disabled:opacity-40"
                    }`}
                  >
                    30d
                  </button>
                </div>
              </div>
              <div className="mt-0.5 flex items-center gap-2 text-[11px]">
                <span className="text-muted-foreground">
                  {activeTotal.toLocaleString()} total clicks{timeRange === "7d" ? " this week" : " this month"}
                </span>
                {timeRange === "7d" && (prevWeekClicks > 0 || totalLast7 > 0) && (
                  <span
                    className={`inline-flex items-center gap-0.5 font-medium ${
                      wowDirection === "up"
                        ? "text-emerald-600"
                        : wowDirection === "down"
                          ? "text-red-500"
                          : "text-muted-foreground"
                    }`}
                  >
                    {wowDirection === "up" ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : wowDirection === "down" ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : null}
                    {wowDirection === "flat"
                      ? "vs prev week"
                      : prevWeekClicks === 0
                        ? "new this week"
                        : `${wowDelta > 0 ? "+" : ""}${wowPct}% vs prev week`}
                  </span>
                )}
              </div>
            </div>
            <Sparkline data={dailyClicks} width={timeRange === "30d" ? 200 : 120} />
          </div>
          {/* Day labels under the sparkline */}
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/60">
            {timeRange === "7d"
              ? report.last7Days.map((d) => (
                  <span key={d.date} className="tabular-nums">
                    {dayLabel(d.date)}
                  </span>
                ))
              : (report.last30Days || []).filter((_, i) => i % 5 === 0).map((d) => (
                  <span key={d.date} className="tabular-nums">
                    {shortDateLabel(d.date)}
                  </span>
                ))
            }
          </div>
          {/* Bar chart underneath for precise values */}
          <div className="mt-3 flex items-end gap-1" style={{ height: 40 }}>
            {dailyClicks.map((v, i) => {
              const maxDay = Math.max(...dailyClicks, 1);
              const h = (v / maxDay) * 36 + 4;
              return (
                <div key={i} className="group relative flex-1">
                  <div
                    className="mx-auto w-full max-w-[24px] rounded-t-sm bg-violet-500/80 transition-all duration-300 group-hover:bg-violet-500"
                    style={{ height: `${h}px` }}
                  />
                  {/* Tooltip on hover */}
                  <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                    {v} click{v === 1 ? "" : "s"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdowns */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {/* Clicks sent → targets */}
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

        {/* Clicks received → sources */}
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
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-[10px] font-bold text-emerald-600">
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
