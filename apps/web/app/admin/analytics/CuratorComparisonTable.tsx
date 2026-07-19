"use client";

import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { Sparkline } from "../../../components/admin/TrendSparkline";

interface DayPoint {
  date: string;
  crossRecoClicks: number;
}

interface CuratorAnalyticsReport {
  slug: string;
  crossRecoClicks: number;
  previous7DaysCrossRecoClicks: number;
  crossRecoClickTargets: Record<string, number>;
  crossCuratorAttributions: Record<string, number>;
  shareVisits: number;
  last7Days: DayPoint[];
  last30Days: DayPoint[];
}

interface CuratorComparisonTableProps {
  reports: CuratorAnalyticsReport[];
  curatorNames: Record<string, string>;
}

function pct(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

export function CuratorComparisonTable({
  reports,
  curatorNames,
}: CuratorComparisonTableProps) {
  // Sort by cross-reco clicks descending, include all curators
  const sorted = [...reports]
    .sort((a, b) => (b.crossRecoClicks || 0) - (a.crossRecoClicks || 0));

  if (sorted.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-info" />
          Curator Comparison
        </h3>
        <p className="py-4 text-center text-xs text-muted-foreground">
          No cross-curator recommendation activity yet
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-info" />
          Curator Comparison
        </h3>
        <span className="text-xs text-muted-foreground">
          {sorted.length} curator{sorted.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border">
            <tr className="text-left text-xs text-muted-foreground">
              <th className="pb-2 pr-3 font-medium">Curator</th>
              <th className="pb-2 px-3 font-medium">Trend (7d)</th>
              <th className="pb-2 px-3 font-medium text-right">Clicks</th>
              <th className="pb-2 px-3 font-medium text-right">Click→Visit</th>
              <th className="pb-2 pl-3 font-medium text-right">WoW Change</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted.map((r) => {
              const data7d = r.last7Days.map((d) => d.crossRecoClicks);
              const total7d = data7d.reduce((a, b) => a + b, 0);
              const prevClicks = r.previous7DaysCrossRecoClicks || 0;
              const wowDelta = total7d - prevClicks;
              const wowPct = prevClicks > 0 ? Math.round((wowDelta / prevClicks) * 100) : 0;
              const visitRate = r.crossRecoClicks > 0
                ? pct(r.shareVisits || 0, r.crossRecoClicks)
                : "—";
              const displayName = curatorNames[r.slug] || r.slug;

              return (
                <tr key={r.slug} className="hover:bg-muted/30 transition-colors">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info/10 text-[10px] font-bold text-violet-600 uppercase">
                        {displayName.charAt(0)}
                      </div>
                      <span className="font-medium capitalize">{displayName}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="w-[100px]">
                      {data7d.some((v) => v > 0) ? (
                        <Sparkline
                          data={data7d}
                          width={100}
                          height={28}
                          color="rgb(139 92 246)"
                          showTrend
                          trendWindow={3}
                        />
                      ) : (
                        <span className="text-[11px] text-muted-foreground">No data</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums font-medium">
                    {(r.crossRecoClicks || 0).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-muted-foreground">
                    {visitRate}
                  </td>
                  <td className="py-3 pl-3 text-right">
                    {(prevClicks > 0 || total7d > 0) ? (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          wowDelta > 0
                            ? "text-success"
                            : wowDelta < 0
                              ? "text-error"
                              : "text-muted-foreground"
                        }`}
                      >
                        {wowDelta > 0 ? (
                          <TrendingUp className="h-3 w-3" />
                        ) : wowDelta < 0 ? (
                          <TrendingDown className="h-3 w-3" />
                        ) : null}
                        {prevClicks === 0
                          ? "new"
                          : `${wowDelta > 0 ? "+" : ""}${wowPct}%`}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-px w-3 border-t border-dashed border-orange-400" />
          SMA(3) trend
        </span>
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-2.5 w-2.5 text-success" />
          <TrendingDown className="h-2.5 w-2.5 text-error" />
          Week-over-week change
        </span>
      </div>
    </div>
  );
}
