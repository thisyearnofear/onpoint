"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Link2, RefreshCw, Sparkles, Users, CheckCircle2, XCircle } from "lucide-react";
import { Bar, Sparkline } from "../../../components/admin/TrendSparkline";

interface DeepLinkPersonaReport {
  totalSelected: number;
  totalOutcomes: number;
  totalCompleted: number;
  totalAbandoned: number;
  completionRate: string;
  avgDurationMs: number | null;
  byPersona: Record<
    string,
    {
      selected: number;
      completed: number;
      abandoned: number;
      completionRate: string;
      daily: { date: string; selected: number; completed: number }[];
    }
  >;
  byCurator: Record<string, number>;
  last7Days: { date: string; selected: number; completed: number }[];
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Persona color mapping (matches persona-config.ts token colors)
const PERSONA_COLORS: Record<string, string> = {
  miranda: "bg-slate-500",
  edina: "bg-purple-500",
  shaft: "bg-orange-500",
  luxury: "bg-amber-500",
  streetwear: "bg-blue-500",
  sustainable: "bg-emerald-500",
};

const PERSONA_TEXT_COLORS: Record<string, string> = {
  miranda: "text-slate-500",
  edina: "text-purple-500",
  shaft: "text-orange-500",
  luxury: "text-amber-500",
  streetwear: "text-blue-500",
  sustainable: "text-emerald-500",
};

const PERSONA_SVG_COLORS: Record<string, string> = {
  miranda: "rgb(100 116 139)",
  edina: "rgb(168 85 247)",
  shaft: "rgb(249 115 22)",
  luxury: "rgb(245 158 11)",
  streetwear: "rgb(59 130 246)",
  sustainable: "rgb(16 185 129)",
};

export function DeepLinkPersonaFunnelSection() {
  const [report, setReport] = useState<DeepLinkPersonaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/deep-link-personas");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setReport(await res.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load deep-link persona analytics",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
  }, []);

  // ── Loading ──
  if (loading && !report) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">AI Persona Funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deep-link persona selection → critique completion rates
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-card" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error && !report) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">AI Persona Funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Deep-link persona selection → critique completion rates
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load persona funnel</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Analytics requires UPSTASH_REDIS_REST_URL to be configured.
          </p>
        </div>
      </div>
    );
  }

  if (!report) return null;
  const rpt = report;

  const personaEntries = Object.entries(rpt.byPersona).sort(
    ([, a], [, b]) => b.selected - a.selected,
  );

  const curatorEntries = Object.entries(rpt.byCurator).sort(
    ([, a], [, b]) => b - a,
  );

  // Daily chart
  const maxDailySelected = Math.max(...rpt.last7Days.map((d) => d.selected), 1);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">AI Persona Funnel</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Deep-link persona selection → critique completion rates
            </p>
          </div>
          <button
            onClick={fetchReport}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total selections</p>
              <p className="text-2xl font-black tracking-tight">
                {rpt.totalSelected.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">From storefront cards</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <Link2 className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Completion rate</p>
              <p className="text-2xl font-black tracking-tight">{rpt.completionRate}</p>
              <p className="text-[11px] text-muted-foreground">
                {rpt.totalCompleted} completed / {rpt.totalOutcomes} total
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Avg critique time</p>
              <p className="text-2xl font-black tracking-tight">
                {formatMs(rpt.avgDurationMs)}
              </p>
              <p className="text-[11px] text-muted-foreground">Selection to critique</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-violet-500">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Abandoned</p>
              <p className="text-2xl font-black tracking-tight">
                {rpt.totalAbandoned.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Selected but no critique</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-amber-500">
              <XCircle className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Persona breakdown with sparklines + Daily chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* By persona — with daily sparklines */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">By persona</h3>
          {personaEntries.length > 0 ? (
            <div className="space-y-4">
              {personaEntries.map(([persona, stats]) => {
                const color = PERSONA_COLORS[persona] || "bg-primary";
                const textColor = PERSONA_TEXT_COLORS[persona] || "text-primary";
                const svgColor = PERSONA_SVG_COLORS[persona] || "rgb(139 92 246)";

                // Build sparkline data from daily series
                const selectedData = (stats.daily || []).map((d) => d.selected);
                const completedData = (stats.daily || []).map((d) => d.completed);
                const hasDailyData = selectedData.some((v) => v > 0);

                return (
                  <div key={persona} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2 w-2 rounded-full ${color}`} />
                        <span className={`font-medium ${textColor}`}>
                          {labelize(persona)}
                        </span>
                      </span>
                      <span className="ml-2 shrink-0 tabular-nums">
                        {stats.selected} selected
                        <span className="ml-1.5 text-[11px] text-muted-foreground">
                          {stats.completionRate} completed
                        </span>
                      </span>
                    </div>

                    {/* Progress bar */}
                    <div className="relative">
                      <Bar
                        value={stats.selected}
                        max={personaEntries[0]![1].selected}
                        color={color}
                        height="h-1.5"
                      />
                      {stats.selected > 0 && (
                        <div
                          className="absolute top-0 h-1.5 rounded-full bg-emerald-500/60"
                          style={{
                            width: `${(stats.completed / Math.max(stats.selected, 1)) * 100}%`,
                            maxWidth: `${(stats.selected / personaEntries[0]![1].selected) * 100}%`,
                          }}
                        />
                      )}
                    </div>

                    {/* Daily sparkline */}
                    {hasDailyData && (
                      <div className="flex items-center gap-2 pt-0.5">
                        <Sparkline
                          data={selectedData}
                          color={svgColor}
                          width={100}
                          height={20}
                          showTrend={selectedData.length >= 3}
                          trendWindow={3}
                        />
                        {completedData.some((v) => v > 0) && (
                          <Sparkline
                            data={completedData}
                            color="rgb(16 185 129)"
                            width={60}
                            height={20}
                          />
                        )}
                        <span className="text-[9px] text-muted-foreground">
                          7d trend
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No persona selections yet
            </p>
          )}
        </div>

        {/* Daily chart */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">Last 7 days</h3>
          {rpt.last7Days.length > 0 ? (
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {rpt.last7Days.map((day) => {
                const selH = (day.selected / maxDailySelected) * 100;
                const compH = day.selected > 0 ? (day.completed / maxDailySelected) * 100 : 0;
                const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                });
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                      {day.selected}
                    </span>
                    <div className="relative w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/30 transition-all duration-500"
                        style={{ height: `${Math.max(selH, 4)}%` }}
                      />
                      {day.completed > 0 && (
                        <div
                          className="absolute bottom-0 w-full rounded-t-md bg-emerald-500 transition-all duration-500"
                          style={{ height: `${Math.max(compH, 2)}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{dateLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">No daily data yet</p>
          )}
          <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-primary/30" /> Selected
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> Completed
            </span>
          </div>
        </div>
      </div>

      {/* By curator */}
      {curatorEntries.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">By curator</h3>
          <div className="space-y-2">
            {curatorEntries.map(([curator, count]) => (
              <div key={curator}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium capitalize">{curator}</span>
                  </span>
                  <span className="tabular-nums text-muted-foreground">
                    {count} selection{count === 1 ? "" : "s"}
                  </span>
                </div>
                <Bar
                  value={count}
                  max={curatorEntries[0]![1]}
                  color="bg-primary"
                  height="h-1.5"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Data aggregated in Redis from{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
          deep_link_persona_selected
        </code>{" "}
        and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">
          deep_link_persona_outcome
        </code>{" "}
        events. Updates in near-real-time.
      </p>
    </div>
  );
}
