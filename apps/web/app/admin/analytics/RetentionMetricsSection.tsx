"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Bookmark,
  ImageIcon,
  RefreshCw,
  Share2,
  TrendingUp,
  BarChart3,
  Users,
  Smartphone,
  Download,
  ClipboardList,
  ExternalLink,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { Bar } from "../../../components/admin/TrendSparkline";

interface RetentionReport {
  totalSaves: number;
  totalCardOpens: number;
  totalShares: number;
  shareRate: string;
  byShareMethod: Record<string, number>;
  bySaveSource: Record<string, number>;
  bySavePersona: Record<string, number>;
  bySharePersona: Record<string, number>;
  last7Days: { date: string; saves: number; cardOpens: number; shares: number }[];
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^Farcaster$/i, "Farcaster")
    .replace(/^Twitter$/i, "Twitter")
    .replace(/^Native.?share$/i, "Native Share");
}

// ── Share method icon mapping ──
const METHOD_ICONS: Record<string, React.ElementType> = {
  farcaster: Users,
  twitter: ExternalLink,
  download: Download,
  copy: ClipboardList,
  native_share: Smartphone,
};

const METHOD_COLORS: Record<string, string> = {
  farcaster: "bg-info",
  twitter: "bg-sky-500",
  download: "bg-success",
  copy: "bg-warning",
  native_share: "bg-blue-500",
};

export function RetentionMetricsSection() {
  const [report, setReport] = useState<RetentionReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingDigest, setSendingDigest] = useState(false);
  const [digestSent, setDigestSent] = useState(false);
  const [digestError, setDigestError] = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/retention");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setReport(await res.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load retention metrics",
      );
    } finally {
      setLoading(false);
    }
  }

  async function sendDigest() {
    setSendingDigest(true);
    setDigestSent(false);
    setDigestError(null);
    try {
      const res = await fetch("/api/cron/retention-digest", { method: "POST" });
      const data = await res.json();
      if (res.ok && data?.sent) {
        setDigestSent(true);
      } else {
        setDigestError(data?.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      setDigestError(err instanceof Error ? err.message : "Failed to send digest");
    } finally {
      setSendingDigest(false);
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
          <h2 className="text-xl font-black tracking-tight">Retention Metrics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Look saves, style card opens, and share channel performance
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
          <h2 className="text-xl font-black tracking-tight">Retention Metrics</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Look saves, style card opens, and share channel performance
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load retention metrics</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Requires UPSTASH_REDIS_REST_URL to be configured.
          </p>
        </div>
      </div>
    );
  }

  if (!report) return null;
  const rpt = report;

  const shareMethodEntries = Object.entries(rpt.byShareMethod).sort(
    ([, a], [, b]) => b - a,
  );
  const saveSourceEntries = Object.entries(rpt.bySaveSource).sort(
    ([, a], [, b]) => b - a,
  );
  const savePersonaEntries = Object.entries(rpt.bySavePersona).sort(
    ([, a], [, b]) => b - a,
  );
  const sharePersonaEntries = Object.entries(rpt.bySharePersona).sort(
    ([, a], [, b]) => b - a,
  );

  const hasShareData = shareMethodEntries.length > 0;
  const hasSaveSourceData = saveSourceEntries.length > 0;

  const maxDailySaves = Math.max(...rpt.last7Days.map((d) => d.saves), 1);
  const maxDailyShares = Math.max(...rpt.last7Days.map((d) => d.shares), 1);

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Retention Metrics</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Look saves, style card opens, and share channel performance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={sendDigest}
              disabled={sendingDigest}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {sendingDigest ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Mail className="h-3.5 w-3.5" />
              )}
              {sendingDigest ? "Sending..." : "Send digest"}
            </button>
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
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Looks saved</p>
              <p className="text-2xl font-black tracking-tight">
                {rpt.totalSaves.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">From try-on results</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-primary">
              <Bookmark className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Style cards opened</p>
              <p className="text-2xl font-black tracking-tight">
                {rpt.totalCardOpens.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">Polaroid preview views</p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-info">
              <ImageIcon className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total shares</p>
              <p className="text-2xl font-black tracking-tight">
                {rpt.totalShares.toLocaleString()}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {rpt.shareRate !== "—"
                  ? `${rpt.shareRate} of card opens`
                  : "No card opens yet"}
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-success">
              <Share2 className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Share rate</p>
              <p className="text-2xl font-black tracking-tight">{rpt.shareRate}</p>
              <p className="text-[11px] text-muted-foreground">
                Shares ÷ style card opens
              </p>
            </div>
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-warning">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Daily chart + Share method breakdown */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Daily trend */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">Last 7 days</h3>
          {rpt.last7Days.length > 0 ? (
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {rpt.last7Days.map((day) => {
                const saveH = (day.saves / maxDailySaves) * 100;
                const shareH = maxDailyShares > 0
                  ? (day.shares / maxDailyShares) * 100
                  : 0;
                const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short",
                  month: "numeric",
                  day: "numeric",
                });
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                      {day.saves}
                    </span>
                    <div className="relative w-full flex-1 flex items-end">
                      {/* Save bar */}
                      <div
                        className="w-full rounded-t-md bg-primary/40 transition-all duration-500"
                        style={{ height: `${Math.max(saveH, 4)}%` }}
                      />
                      {/* Share overlay bar */}
                      {day.shares > 0 && (
                        <div
                          className="absolute bottom-0 w-full rounded-t-md bg-success transition-all duration-500"
                          style={{ height: `${Math.max(shareH, 2)}%` }}
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
              <span className="inline-block h-2 w-2 rounded-sm bg-primary/40" /> Saves
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm bg-success" /> Shares
            </span>
          </div>
        </div>

        {/* Share method breakdown */}
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Share channels</h3>
          {hasShareData ? (
            <div className="space-y-3">
              {shareMethodEntries.map(([method, count]) => {
                const Icon = METHOD_ICONS[method] || Share2;
                const color = METHOD_COLORS[method] || "bg-primary";
                return (
                  <div key={method}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2">
                        <Icon className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{labelize(method)}</span>
                      </span>
                      <span className="tabular-nums">
                        {count.toLocaleString()}
                        <span className="ml-1 text-[11px] text-muted-foreground">
                          ({pct(count, rpt.totalShares)})
                        </span>
                      </span>
                    </div>
                    <Bar
                      value={count}
                      max={shareMethodEntries[0]![1]}
                      color={color}
                      height="h-2"
                    />
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No shares recorded yet
            </p>
          )}
        </div>
      </div>

      {/* Secondary breakdowns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* By save source */}
        {hasSaveSourceData && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Save source</h3>
            <div className="space-y-2">
              {saveSourceEntries.map(([source, count]) => (
                <div key={source}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{labelize(source)}</span>
                    <span className="tabular-nums">
                      {count.toLocaleString()}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({pct(count, rpt.totalSaves)})
                      </span>
                    </span>
                  </div>
                  <Bar
                    value={count}
                    max={saveSourceEntries[0]![1]}
                    color="bg-primary"
                    height="h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By save persona */}
        {savePersonaEntries.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Saves by persona</h3>
            <div className="space-y-2">
              {savePersonaEntries.map(([persona, count]) => (
                <div key={persona}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{labelize(persona)}</span>
                    <span className="tabular-nums">
                      {count.toLocaleString()}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({pct(count, rpt.totalSaves)})
                      </span>
                    </span>
                  </div>
                  <Bar
                    value={count}
                    max={savePersonaEntries[0]![1]}
                    color="bg-info"
                    height="h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* By share persona */}
        {sharePersonaEntries.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-3 text-sm font-semibold">Shares by persona</h3>
            <div className="space-y-2">
              {sharePersonaEntries.map(([persona, count]) => (
                <div key={persona}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{labelize(persona)}</span>
                    <span className="tabular-nums">
                      {count.toLocaleString()}
                      <span className="ml-1 text-[11px] text-muted-foreground">
                        ({pct(count, rpt.totalShares)})
                      </span>
                    </span>
                  </div>
                  <Bar
                    value={count}
                    max={sharePersonaEntries[0]![1]}
                    color="bg-success"
                    height="h-1.5"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state for main section */}
      {!hasShareData && !hasSaveSourceData && rpt.totalSaves === 0 && rpt.totalShares === 0 && (
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No retention data yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Metrics will appear here once users start saving looks and sharing style cards.
          </p>
        </div>
      )}

      {/* Digest sent/error feedback */}
      {digestSent && (
        <div className="rounded-lg bg-success/10 border border-success/20 p-3 flex items-center gap-2 text-sm">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span className="text-success dark:text-emerald-300">
            Digest sent! Check your admin inbox.
          </span>
        </div>
      )}
      {digestError && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 flex items-center gap-2 text-sm">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <span className="text-destructive">
            Failed to send digest: {digestError}
          </span>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Data aggregated in Redis from{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">look_saved</code>,{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">style_card_opened</code>, and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">style_card_share</code> events.
        Updates in near-real-time.
      </p>
    </div>
  );
}
