import React from "react";
import type { LucideIcon } from "lucide-react";
import { CheckCircle2 } from "lucide-react";
import { Spinner } from "./Spinner";

export interface StagedWaitStage {
  /** Seconds after mount at which this stage activates. */
  at: number;
  label: string;
  detail?: string;
  icon?: LucideIcon;
}

export interface StagedWaitProps {
  /** Headline, e.g. "Building your fit profile". */
  title: string;
  /** Optional left column — typically the user's photo with a scanline. */
  media?: React.ReactNode;
  stages: StagedWaitStage[];
  /** Rotating notes, one every `lineEveryMs`. Keep them honest, not hype. */
  lines?: string[];
  lineEveryMs?: number;
  /** Asymptotic time constant for the progress bar (seconds). ~63% at tau. */
  tauSeconds?: number;
  /** Progress ceiling — the bar only finishes when the result lands. */
  progressCap?: number;
  /** Force a stage index (e.g. an early local step pins stage 0). */
  stageIndex?: number;
  /** Override the progress fill (0–100). */
  progress?: number;
  /** Drop the card chrome — for embedding inside another surface (e.g. an image frame). */
  bare?: boolean;
  className?: string;
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The one long-wait pattern (>5s, typically 30–120s generations).
 * Upstream gives no progress signal, so stages activate on a timer paced
 * to what actually happens; the bar is asymptotic and never claims 100%.
 *
 * Voice rules for `lines`: honest notes and styling tips, present tense,
 * no fake precision, no apologies.
 */
export function StagedWait({
  title,
  media,
  stages,
  lines,
  lineEveryMs = 8000,
  tauSeconds = 30,
  progressCap = 95,
  stageIndex: stageIndexOverride,
  progress: progressOverride,
  bare = false,
  className = "",
}: StagedWaitProps) {
  const [elapsed, setElapsed] = React.useState(0);

  React.useEffect(() => {
    const started = Date.now();
    const tick = setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const stageIndex =
    stageIndexOverride ??
    stages.reduce((acc, stage, i) => (elapsed >= stage.at ? i : acc), 0);
  const progress =
    progressOverride ??
    Math.min(progressCap, Math.round((1 - Math.exp(-elapsed / tauSeconds)) * 100));
  const line =
    lines && lines.length > 0
      ? lines[Math.floor(elapsed / (lineEveryMs / 1000)) % lines.length]
      : null;

  return (
    <div
      className={
        bare
          ? `flex h-full flex-col justify-center p-4 ${className}`
          : `overflow-hidden border border-border bg-card ${className}`
      }
    >
      <div className={`grid gap-0 ${media ? "sm:grid-cols-[180px_1fr]" : ""}`}>
        {media && (
          <div className="relative h-44 overflow-hidden bg-muted sm:h-auto sm:min-h-[240px]">
            {media}
            {/* scan line — the only motion on the media */}
            <div className="absolute inset-x-3 top-4 h-px animate-pulse bg-primary/80" />
          </div>
        )}
        <div className={`space-y-4 ${bare ? "" : "p-4"}`}>
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-bold text-foreground">{title}</p>
            <span className="font-mono text-xs text-muted-foreground" aria-live="off">
              {formatElapsed(elapsed)}
            </span>
          </div>

          <div className="grid gap-2">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const done = index < stageIndex;
              const active = index === stageIndex;
              return (
                <div
                  key={stage.label}
                  className={`flex items-center gap-2.5 border px-3 py-2 transition-colors duration-500 ${
                    active
                      ? "border-primary/40 bg-primary/5"
                      : "border-border/60 bg-transparent"
                  } ${done || active ? "" : "opacity-50"}`}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                      done
                        ? "border-primary bg-primary text-primary-foreground"
                        : active
                          ? "border-primary text-primary"
                          : "border-border text-muted-foreground"
                    }`}
                  >
                    {done ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : Icon ? (
                      <Icon className="h-3 w-3" />
                    ) : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{stage.label}</p>
                    {stage.detail && (
                      <p className="truncate text-xs text-muted-foreground">{stage.detail}</p>
                    )}
                  </div>
                  {active && <Spinner size="sm" />}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {line && (
              <p key={line} className="animate-fade-in text-xs leading-relaxed text-muted-foreground">
                {line}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
