import React from "react";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeAvatar, judgeDisplayName } from "../JudgeAvatar";
import { computeStreak } from "../../../lib/stores/runway-history-store";
import type { RunwayEntry } from "../../../lib/stores/runway-history-store";
import { JUDGES, JUDGE_LINES } from "./types";

export function IntroStage({
  busy,
  entries,
  onPick,
}: {
  busy: boolean;
  entries: RunwayEntry[];
  onPick: (judge: StylistPersona) => void;
}) {
  const streak = computeStreak(entries, Date.now());
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">Runway</p>
        <h1 className="mt-2 font-display text-3xl tracking-[-0.02em] sm:text-4xl">Pick your judge.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Three minutes, one photo, one verdict.
        </p>
      </div>

      <div className="grid w-full grid-cols-3 gap-3">
        {JUDGES.map((j) => (
          <button
            key={j.key}
            type="button"
            onClick={() => onPick(j.key)}
            disabled={busy}
            className="group flex flex-col items-center gap-3 border border-border bg-card px-3 py-5 transition-colors hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
          >
            <JudgeAvatar persona={j.key} size="lg" />
            <span className="text-sm font-bold text-foreground">{j.name}</span>
            <span className="text-xs italic leading-snug text-muted-foreground">
              &ldquo;{(JUDGE_LINES[j.key as keyof typeof JUDGE_LINES] || JUDGE_LINES.miranda)[0]}&rdquo;
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onPick(JUDGES[Math.floor(Math.random() * JUDGES.length)]!.key)}
        disabled={busy}
        className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Surprise me — any judge
      </button>
      {busy && <p className="text-sm text-muted-foreground">Dealing a theme…</p>}

      {entries.length > 0 && (
        <div className="w-full max-w-sm">
          <p className="text-center font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {streak > 0 ? `Streak ${streak} · ` : ""}
            Best {Math.max(...entries.map((e) => e.total)).toFixed(1)} · {entries.length} round{entries.length === 1 ? "" : "s"}
          </p>
          <div className="mt-3 border border-border bg-card px-4 py-3">
            <p className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Last verdict</p>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-sm">
              <span className="truncate font-bold text-foreground">{entries[0]?.themeName}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">{entries[0]?.total.toFixed(1)}/10 · {judgeDisplayName(entries[0]?.judge as StylistPersona)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
