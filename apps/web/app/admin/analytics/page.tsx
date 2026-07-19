"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Clock,
  Cpu,
  ImageIcon,
  Layers,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  TrendingUp,
  Eye,
  ShoppingBag,
  CreditCard,
  Share2,
  Users,
  MousePointerClick,
  ArrowRightLeft,
  Link2,
  GitBranch,
} from "lucide-react";
import { CrossCuratorRecommendationsSection } from "./CrossCuratorRecommendationsSection";
import { DeepLinkPersonaFunnelSection } from "./DeepLinkPersonaFunnelSection";
import { RetentionMetricsSection } from "./RetentionMetricsSection";
import { Bar } from "../../../components/admin/TrendSparkline";

interface ProviderOutcomeReport {
  total: number;
  byProvider: Record<string, number>;
  imageConditioned: { yes: number; no: number };
  fallbackReasons: Record<string, number>;
  errorClasses: Record<string, number>;
  avgLatencyMs: number | null;
  garmentSources: Record<string, number>;
  garmentCategories: Record<string, number>;
  last7Days: { date: string; total: number }[];
}

function formatMs(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${Math.round(ms)}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function labelize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/^replicate -/i, "Replicate")
    .replace(/^venice/i, "Venice")
    .replace(/^gemini/i, "Gemini");
}



// ── Stat card ──
function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  accent = "text-primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="text-2xl font-black tracking-tight">{value}</p>
          {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
        </div>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

// ── Table card ──
function BreakdownCard({
  title,
  data,
  total,
  maxItems = 8,
  emptyLabel = "No data yet",
}: {
  title: string;
  data: Record<string, number>;
  total: number;
  maxItems?: number;
  emptyLabel?: string;
}) {
  const entries = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxItems);

  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-3 text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground">{emptyLabel}</p>
      </div>
    );
  }

  const maxValue = entries[0]![1];

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="truncate text-muted-foreground">{labelize(key)}</span>
              <span className="ml-2 shrink-0 font-medium tabular-nums">
                {val}
                <span className="ml-1 text-[11px] text-muted-foreground">
                  ({pct(val, total)})
                </span>
              </span>
            </div>
            <Bar value={val} max={maxValue} color="bg-primary" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Daily chart bar ──
function DailyChart({ data }: { data: { date: string; total: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold">Last 7 days</h3>
      <div className="flex items-end gap-2" style={{ height: 120 }}>
        {data.map((day) => {
          const h = max > 0 ? (day.total / max) * 100 : 0;
          const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
            weekday: "short",
            month: "numeric",
            day: "numeric",
          });
          return (
            <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                {day.total}
              </span>
              <div
                className="w-full rounded-t-md bg-gradient-to-t from-primary/60 to-primary transition-all duration-500"
                style={{ height: `${Math.max(h, 4)}%` }}
              />
              <span className="text-[9px] text-muted-foreground">{dateLabel}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AnalyticsDashboardPage() {
  const [report, setReport] = useState<ProviderOutcomeReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchReport() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analytics/provider-outcomes");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data: ProviderOutcomeReport = await res.json();
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchReport();
  }, []);

  // ── Loading state ──
  if (loading && !report) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Provider Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Virtual try-on provider outcome metrics
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-border bg-card"
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error && !report) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Provider Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Virtual try-on provider outcome metrics
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-8 w-8 text-destructive" />
          <p className="font-medium text-destructive">Failed to load analytics</p>
          <p className="mt-1 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={fetchReport}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (report && report.total === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tight">Provider Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Virtual try-on provider outcome metrics
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
        <div className="rounded-xl border border-border bg-card p-12 text-center">
          <BarChart3 className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
          <h2 className="text-lg font-semibold">No provider outcomes recorded yet</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Aggregated metrics will appear here once users start using the virtual try-on feature.
          </p>
        </div>
      </div>
    );
  }

  if (!report) return null;
  const rpt = report;

  const successCount = Object.entries(rpt.errorClasses).reduce(
    (sum, [, count]) => sum + count,
    0,
  );
  const successRate = pct(rpt.total - successCount, rpt.total);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Provider Analytics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Virtual try-on provider outcome metrics
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

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Sparkles}
          label="Total try-ons"
          value={rpt.total.toLocaleString()}
          sub="All-time provider outcomes"
          accent="text-primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Success rate"
          value={successRate}
          sub={`${rpt.total - successCount} successful, ${successCount} errors`}
          accent="text-success"
        />
        <StatCard
          icon={Clock}
          label="Avg latency"
          value={formatMs(rpt.avgLatencyMs)}
          sub="Across all providers"
          accent="text-info"
        />
        <StatCard
          icon={ImageIcon}
          label="Image-conditioned"
          value={pct(rpt.imageConditioned.yes, rpt.total)}
          sub={`${rpt.imageConditioned.yes} yes · ${rpt.imageConditioned.no} no`}
          accent="text-warning"
        />
      </div>

      {/* Provider distribution + Daily chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard
          title="By provider"
          data={rpt.byProvider}
          total={rpt.total}
          maxItems={6}
          emptyLabel="No provider data yet"
        />
        <DailyChart data={rpt.last7Days} />
      </div>

      {/* Secondary breakdowns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <BreakdownCard
          title="Fallback reasons"
          data={rpt.fallbackReasons}
          total={rpt.total}
          maxItems={6}
          emptyLabel="No fallbacks recorded"
        />
        <BreakdownCard
          title="Error classes"
          data={rpt.errorClasses}
          total={rpt.total}
          maxItems={6}
          emptyLabel="No errors recorded"
        />
        <BreakdownCard
          title="Garment sources"
          data={rpt.garmentSources}
          total={rpt.total}
          maxItems={6}
          emptyLabel="No source data yet"
        />
      </div>

      {/* Categories */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BreakdownCard
          title="Garment categories"
          data={rpt.garmentCategories}
          total={rpt.total}
          maxItems={8}
          emptyLabel="No category data yet"
        />
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Image conditioning</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Image-conditioned</span>
                <span className="font-medium tabular-nums">
                  {report.imageConditioned.yes}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({pct(report.imageConditioned.yes, report.total)})
                  </span>
                </span>
              </div>
              <Bar
                value={report.imageConditioned.yes}
                max={Math.max(report.imageConditioned.yes, report.imageConditioned.no)}
                color="bg-primary"
              />
            </div>
            <div>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="text-muted-foreground">AI generated / analysis only</span>
                <span className="font-medium tabular-nums">
                  {report.imageConditioned.no}
                  <span className="ml-1 text-[11px] text-muted-foreground">
                    ({pct(report.imageConditioned.no, report.total)})
                  </span>
                </span>
              </div>
              <Bar
                value={report.imageConditioned.no}
                max={Math.max(report.imageConditioned.yes, report.imageConditioned.no)}
                color="bg-muted-foreground/40"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Footer note */}
      <p className="text-[11px] text-muted-foreground">
        Data aggregated in Redis from <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">virtual_try_on_provider_outcome</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 font-mono text-[10px]">virtual_try_on_provider_error</code> events. Updates in near-real-time.
      </p>

      {/* ════════════════════ AI Persona Funnel ════════════════════ */}
      <DeepLinkPersonaFunnelSection />

      {/* ════════════════════ Curator Funnel Analytics ════════════════════ */}
      <CuratorFunnelAnalyticsSection />

      {/* ════════════════════ Cross-Curator Recommendations ════════════════════ */}
      <CrossCuratorRecommendationsSection />

      {/* ════════════════════ Retention Metrics ════════════════════ */}
      <RetentionMetricsSection />
    </div>
  );
}

// ── Curator Funnel Analytics Section ───────────────────────────────────

interface CuratorFunnelOverview {
  totalCurators: number;
  totalPageViews: number;
  totalTryOns: number;
  totalShares: number;
  totalShareVisits: number;
  totalLeads: number;
  totalPurchases: number;
  topCurators: Array<{ slug: string; name: string; pageViews: number; purchases: number }>;
  last7Days: { date: string; totalViews: number; totalPurchases: number }[];
}

function CuratorFunnelAnalyticsSection() {
  const [overview, setOverview] = useState<CuratorFunnelOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchFunnel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/curator/analytics");
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setOverview(data.overview || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load curator analytics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFunnel();
  }, []);

  // ── Loading ──
  if (loading && !overview) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">Curator Funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Storefront-to-purchase conversion metrics
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
  if (error && !overview) {
    return (
      <div className="mt-8 space-y-4">
        <div className="border-t border-border pt-6">
          <h2 className="text-xl font-black tracking-tight">Curator Funnel</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Storefront-to-purchase conversion metrics
          </p>
        </div>
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-6 w-6 text-destructive" />
          <p className="text-sm font-medium text-destructive">Failed to load curator funnel</p>
          <p className="mt-1 text-xs text-muted-foreground">{error}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            Analytics requires UPSTASH_REDIS_REST_URL to be configured.
          </p>
        </div>
      </div>
    );
  }

  if (!overview) return null;
  const ov = overview;

  const funnelRate = (num: number, denom: number): string =>
    denom > 0 ? `${Math.round((num / denom) * 100)}%` : "—";

  return (
    <div className="mt-8 space-y-6">
      {/* Header */}
      <div className="border-t border-border pt-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight">Curator Funnel</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Storefront-to-purchase conversion metrics
            </p>
          </div>
          <button
            onClick={fetchFunnel}
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
        <StatCard
          icon={Eye}
          label="Page views"
          value={ov.totalPageViews.toLocaleString()}
          sub={`${ov.totalCurators} curator${ov.totalCurators === 1 ? "" : "s"}`}
          accent="text-primary"
        />
        <StatCard
          icon={MousePointerClick}
          label="Try-ons"
          value={ov.totalTryOns.toLocaleString()}
          sub={`${funnelRate(ov.totalTryOns, ov.totalPageViews)} of views`}
          accent="text-info"
        />
        <StatCard
          icon={Share2}
          label="Shares / visits"
          value={`${ov.totalShares.toLocaleString()} / ${ov.totalShareVisits.toLocaleString()}`}
          sub={`Share→visit rate: ${funnelRate(ov.totalShareVisits, ov.totalShares)}`}
          accent="text-sky-500"
        />
        <StatCard
          icon={ShoppingBag}
          label="Purchases"
          value={ov.totalPurchases.toLocaleString()}
          sub={`${ov.totalLeads.toLocaleString()} leads`}
          accent="text-success"
        />
      </div>

      {/* Funnel rates + daily chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">Funnel conversion</h3>
          <div className="space-y-4">
            {[
              { label: "View → Try-on", value: ov.totalTryOns, total: ov.totalPageViews, color: "bg-info" },
              { label: "Try-on → Purchase", value: ov.totalPurchases, total: ov.totalTryOns, color: "bg-success" },
              { label: "View → Purchase", value: ov.totalPurchases, total: ov.totalPageViews, color: "bg-primary" },
              { label: "Share → Visit", value: ov.totalShareVisits, total: ov.totalShares, color: "bg-sky-500" },
              { label: "Lead → Purchase", value: ov.totalPurchases, total: ov.totalLeads, color: "bg-warning" },
            ].map((step) => {
              const pctVal = step.total > 0 ? (step.value / step.total) * 100 : 0;
              return (
                <div key={step.label}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{step.label}</span>
                    <span className="font-medium tabular-nums">
                      {step.value.toLocaleString()}{" "}
                      <span className="text-[11px] text-muted-foreground">
                        / {step.total.toLocaleString()}
                      </span>
                      <span className="ml-1 text-[11px] font-bold">
                        ({pctVal.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <Bar value={step.value} max={step.total} color={step.color} height="h-2" />
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="mb-4 text-sm font-semibold">Last 7 days</h3>
          {ov.last7Days.length > 0 ? (
            <div className="flex items-end gap-2" style={{ height: 120 }}>
              {ov.last7Days.map((day) => {
                const maxViews = Math.max(...ov.last7Days.map((d) => d.totalViews), 1);
                const maxPurchases = Math.max(...ov.last7Days.map((d) => d.totalPurchases), 1);
                const viewH = (day.totalViews / maxViews) * 100;
                const purchH = (day.totalPurchases / maxPurchases) * 100;
                const dateLabel = new Date(day.date + "T00:00:00").toLocaleDateString("en-US", {
                  weekday: "short", month: "numeric", day: "numeric",
                });
                return (
                  <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                      {day.totalViews}
                    </span>
                    <div className="relative w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-md bg-primary/40 transition-all duration-500"
                        style={{ height: `${Math.max(viewH, 4)}%` }}
                      />
                      {day.totalPurchases > 0 && (
                        <div
                          className="absolute bottom-0 w-full rounded-t-md bg-success transition-all duration-500"
                          style={{ height: `${Math.max(purchH, 2)}%` }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground">{dateLabel}</span>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground py-8 text-center">No daily data yet</p>
          )}
        </div>
      </div>

      {/* Top curators */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 text-sm font-semibold">Top curators by views</h3>
        {ov.topCurators.length > 0 ? (
          <div className="space-y-3">
            {ov.topCurators.map((curator, i) => {
              const maxPv = Math.max(...ov.topCurators.map((c) => c.pageViews), 1);
              return (
                <div key={curator.slug} className="flex items-center gap-3">
                  <span className="w-5 text-center text-xs font-bold text-muted-foreground">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium truncate">{curator.name}</span>
                      <span className="ml-2 shrink-0 text-muted-foreground tabular-nums">
                        {curator.pageViews.toLocaleString()} views · {curator.purchases} purchases
                      </span>
                    </div>
                    <Bar value={curator.pageViews} max={maxPv} color="bg-primary" height="h-2" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-4 text-center">No curator activity yet</p>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Curator funnel data aggregated in Redis from client-side tracking and server events.
        Updates in near-real-time. Requires UPSTASH_REDIS_REST_URL configuration.
      </p>
    </div>
  );
}
