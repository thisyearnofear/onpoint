"use client";

import { useState } from "react";
import { Download, TrendingDown, TrendingUp } from "lucide-react";

export interface TrendSparklineProps {
  /** e.g. "cross-curator clicks" */
  title: string;
  /** Optional suffix after the title, e.g. "(all curators)" */
  titleSuffix?: string;
  data7d: number[];
  data30d: number[];
  dates7d: string[];
  dates30d: string[];
  total7d: number;
  total30d: number;
  has30Data: boolean;
  /** Week-over-week comparison, only shown in 7d mode */
  wow?: {
    delta: number;
    pct: number;
    direction: "up" | "down" | "flat";
    prevTotal: number;
  };
}

// ── Helpers ──

/** Short label for a date: "Mon", "Tue", etc. */
export function dayLabel(iso: string): string {
  return new Date(iso + "T00:00:00").toLocaleDateString("en-KE", {
    weekday: "short",
  });
}

/** Compact date label for 30-day view: "6/1", "6/2", etc. */
export function shortDateLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Sub-components ──

/** Compute a simple moving average with the given window size. */
function sma(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - window + 1; j <= i; j++) sum += data[j] ?? 0;
      result.push(sum / window);
    }
  }
  return result;
}

/** Compute rolling standard deviation with the given window size. */
function rollingStd(data: number[], window: number): (number | null)[] {
  const result: (number | null)[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < window - 1) {
      result.push(null);
    } else {
      let sum = 0;
      for (let j = i - window + 1; j <= i; j++) sum += data[j] ?? 0;
      const mean = sum / window;
      let ssq = 0;
      for (let j = i - window + 1; j <= i; j++) ssq += ((data[j] ?? 0) - mean) ** 2;
      result.push(Math.sqrt(ssq / window));
    }
  }
  return result;
}

/** Mini sparkline rendered as an SVG polyline with optional SMA trend line. */
export function Sparkline({
  data,
  color = "rgb(139 92 246)",
  height = 36,
  width = 160,
  showTrend = false,
  trendWindow = 3,
}: {
  data: number[];
  color?: string;
  height?: number;
  width?: number;
  showTrend?: boolean;
  trendWindow?: number;
}) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const padY = 4;
  const effectiveH = height - padY * 2;

  const toY = (v: number) => padY + effectiveH - ((v - min) / range) * effectiveH;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1 || 1)) * width;
      const y = toY(v);
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = points + ` ${width},${height} 0,${height}`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${width}`;

  // SMA trend line + confidence band
  const smaData = showTrend ? sma(data, trendWindow) : [];
  const stdData = showTrend ? rollingStd(data, trendWindow) : [];
  const bandGap = 1.5; // 1.5σ confidence band

  const trendPoints = smaData
    .map((v, i) => {
      if (v === null) return null;
      const x = (i / (data.length - 1 || 1)) * width;
      const y = toY(v);
      return `${x},${y}`;
    })
    .filter(Boolean)
    .join(" ");

  // Confidence band polygon (upper σ boundary forward, lower σ boundary backward)
  const bandUpper = smaData
    .map((v, i) => {
      if (v === null || stdData[i] === null) return null;
      const x = (i / (data.length - 1 || 1)) * width;
      const y = toY(v + bandGap * (stdData[i] ?? 0));
      return `${x},${y}`;
    });
  const bandLower = smaData
    .map((v, i) => {
      if (v === null || stdData[i] === null) return null;
      const x = (i / (data.length - 1 || 1)) * width;
      const y = toY(v - bandGap * (stdData[i] ?? 0));
      return `${x},${y}`;
    });
  const upperPoints = bandUpper.filter(Boolean).join(" ");
  const lowerReversed = bandLower.filter(Boolean).reverse().join(" ");
  const bandPoints = upperPoints && lowerReversed ? `${upperPoints} ${lowerReversed}` : "";

  // Predicted next-week volume (extrapolate last SMA value)
  const lastSma = smaData.filter((v): v is number => v !== null);
  const predicted = lastSma.length > 1 ? lastSma[lastSma.length - 1] : null;
  const predictedY = predicted !== null && predicted !== undefined ? toY(predicted) : null;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showTrend && bandPoints && (
        <polygon
          points={bandPoints}
          fill="rgb(251 146 60)"
          opacity="0.08"
        />
      )}
      {showTrend && trendPoints && (
        <polyline
          points={trendPoints}
          fill="none"
          stroke="rgb(251 146 60)"
          strokeWidth="1.5"
          strokeDasharray="3 2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      )}
      {predictedY !== null && predictedY !== undefined && (
        <circle
          cx={width}
          cy={predictedY}
          r="2.5"
          fill="rgb(251 146 60)"
          opacity="0.8"
        />
      )}
    </svg>
  );
}

/** Horizontal progress bar. */
export function Bar({
  value,
  max,
  color = "bg-violet-500",
  height = "h-1.5",
}: {
  value: number;
  max: number;
  color?: string;
  height?: string;
}) {
  const p = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className={`${height} w-full overflow-hidden rounded-full bg-muted`}>
      <div
        className={`h-full rounded-full transition-all duration-500 ${color}`}
        style={{ width: `${Math.max(p, 2)}%` }}
      />
    </div>
  );
}

// ── Toggle button ──

function TimeRangeToggle({
  active,
  has30,
  onChange,
}: {
  active: "7d" | "30d";
  has30: boolean;
  onChange: (range: "7d" | "30d") => void;
}) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border bg-background">
      <button
        onClick={() => onChange("7d")}
        className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
          active === "7d"
            ? "bg-violet-500/15 text-violet-600"
            : "text-muted-foreground hover:bg-muted"
        }`}
      >
        7d
      </button>
      <button
        onClick={() => onChange("30d")}
        disabled={!has30}
        className={`px-2 py-0.5 text-[10px] font-medium transition-colors ${
          active === "30d"
            ? "bg-violet-500/15 text-violet-600"
            : "text-muted-foreground hover:bg-muted disabled:opacity-40"
        }`}
      >
        30d
      </button>
    </div>
  );
}

/** Export the active date/clicks data as a CSV file download. */
function ExportCsvButton({
  dates,
  clicks,
  label,
}: {
  dates: string[];
  clicks: number[];
  label: string;
}) {
  function handleExport() {
    const rows = [
      ["date", "clicks"],
      ...dates.map((d, i) => [d, String(clicks[i] || 0)]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${label.replace(/[^a-z0-9]+/gi, "-").replace(/-+$/, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={handleExport}
      className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-muted"
      title="Download CSV"
    >
      <Download className="h-3 w-3" />
      CSV
    </button>
  );
}

// ── Main composite component ──

export function TrendSparkline({
  title,
  titleSuffix,
  data7d,
  data30d,
  dates7d,
  dates30d,
  total7d,
  total30d,
  has30Data,
  wow,
}: TrendSparklineProps) {
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");

  const activeClicks = timeRange === "7d" ? data7d : data30d;
  const activeTotal = timeRange === "7d" ? total7d : total30d;
  const activeMax = Math.max(...activeClicks, 1);
  const activeDates = timeRange === "7d" ? dates7d : dates30d;
  const activeHasData = activeClicks.some((v) => v > 0);

  // Trend prediction (extrapolate last SMA value as next-week estimate)
  const trendWindow = timeRange === "7d" ? 3 : 5;
  const smaData = sma(activeClicks, trendWindow);
  const validSma = smaData.filter((v): v is number => v !== null);
  const predicted = validSma.length > 1 ? validSma[validSma.length - 1] : null;

  if (!activeHasData) return null;

  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      {/* Header: title + toggle */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-semibold text-muted-foreground">
              {timeRange === "7d" ? "Last 7 days" : "Last 30 days"} — {title}
              {titleSuffix ? ` ${titleSuffix}` : ""}
            </p>
            <TimeRangeToggle
              active={timeRange}
              has30={has30Data}
              onChange={setTimeRange}
            />
            <ExportCsvButton
              dates={activeDates}
              clicks={activeClicks}
              label={`${title}-${timeRange}`}
            />
          </div>
          {/* Total + WoW badge */}
          <div className="mt-0.5 flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground">
              {activeTotal.toLocaleString()} total clicks
              {timeRange === "7d" ? " this week" : " this month"}
            </span>
            {timeRange === "7d" && wow && (wow.prevTotal > 0 || total7d > 0) && (
              <span
                className={`inline-flex items-center gap-0.5 font-medium ${
                  wow.direction === "up"
                    ? "text-emerald-600"
                    : wow.direction === "down"
                      ? "text-red-500"
                      : "text-muted-foreground"
                }`}
              >
                {wow.direction === "up" ? (
                  <TrendingUp className="h-3 w-3" />
                ) : wow.direction === "down" ? (
                  <TrendingDown className="h-3 w-3" />
                ) : null}
                {wow.direction === "flat"
                  ? "vs prev week"
                  : wow.prevTotal === 0
                    ? "new this week"
                    : `${wow.delta > 0 ? "+" : ""}${wow.pct}% vs prev week`}
              </span>
            )}
          </div>
        </div>
        <Sparkline
          data={activeClicks}
          width={timeRange === "30d" ? 200 : 120}
          height={36}
          showTrend
          trendWindow={trendWindow}
        />
      </div>

      {/* Trend legend + prediction */}
      {predicted !== null && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px]">
          <span className="inline-flex items-center gap-1 text-muted-foreground/60">
            <span className="inline-block h-px w-3 border-t border-dashed border-orange-400" />
            SMA({trendWindow})
          </span>
          <span className="inline-flex items-center gap-1 text-muted-foreground/60">
            <span className="inline-block h-2 w-3 rounded-sm bg-orange-400/20" />
            ±1.5σ band
          </span>
          <span className="text-orange-500/80 font-medium">
            ~{Math.round(predicted ?? 0)} clicks/day predicted
          </span>
        </div>
      )}

      {/* Day labels */}
      <div className="mt-2 flex justify-between text-[10px] text-muted-foreground/60">
        {timeRange === "7d"
          ? dates7d.map((d) => (
              <span key={d} className="tabular-nums">
                {dayLabel(d)}
              </span>
            ))
          : dates30d
              .filter((_, i) => i % 5 === 0)
              .map((d) => (
                <span key={d} className="tabular-nums">
                  {shortDateLabel(d)}
                </span>
              ))}
      </div>

      {/* Bar chart */}
      <div
        className="mt-3 flex items-end gap-px"
        style={{ height: timeRange === "7d" ? 40 : 44 }}
      >
        {activeClicks.map((v, i) => {
          const h = ((v || 0) / activeMax) * (timeRange === "7d" ? 36 : 40) + 4;
          return (
            <div key={i} className="group relative flex-1">
              <div
                className="mx-auto w-full rounded-t-sm bg-violet-500/80 transition-all duration-300 group-hover:bg-violet-500"
                style={{
                  height: `${h}px`,
                  maxWidth: timeRange === "30d" ? 12 : 24,
                }}
              />
              <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded bg-popover px-2 py-1 text-[10px] font-medium opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {v || 0} click{(v || 0) === 1 ? "" : "s"}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
