"use client";

import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

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

/** Mini sparkline rendered as an SVG polyline. */
export function Sparkline({
  data,
  color = "rgb(139 92 246)",
  height = 36,
  width = 160,
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

  const areaPoints = points + ` ${width},${height} 0,${height}`;
  const gradientId = `spark-${color.replace(/[^a-z0-9]/gi, "")}-${width}`;

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
        />
      </div>

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
