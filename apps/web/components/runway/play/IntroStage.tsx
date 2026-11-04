import React from "react";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeAvatar, judgeDisplayName } from "../JudgeAvatar";
import { computeStreak } from "../../../lib/stores/runway-history-store";
import type { RunwayEntry } from "../../../lib/stores/runway-history-store";
import { JUDGES } from "./types";

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
    <>
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Pick your judge</p>
      <div className="flex gap-4">
        {JUDGES.map((j) => (
          <button
            key={j.key}
            type="button"
            onClick={() => onPick(j.key)}
            disabled={busy}
            className="flex min-h-[96px] w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card/60 transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <JudgeAvatar persona={j.key} size="lg" />
            <span className="text-sm font-bold">{j.name}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onPick(JUDGES[Math.floor(Math.random() * JUDGES.length)]!.key)}
        disabled={busy}
        className="text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground/70 hover:underline"
      >
        Surprise me — any judge
      </button>
      {busy && <p className="text-sm text-muted-foreground">Dealing a theme…</p>}
      {entries.length > 0 && (
        <div className="flex w-full max-w-sm flex-col items-center gap-3">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            {streak > 0 ? `Streak ${streak} · ` : ""}
            Best {Math.max(...entries.map((e) => e.total)).toFixed(1)} · {entries.length} round{entries.length === 1 ? "" : "s"}
          </p>
          <div className="w-full rounded-2xl border border-border bg-card/60 px-4 py-3">
            <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Last verdict</p>
            <div className="mt-1 flex items-center justify-between text-sm">
              <span className="font-bold text-foreground">{entries[0]?.themeName}</span>
              <span className="text-muted-foreground">{entries[0]?.total.toFixed(1)}/10 · {judgeDisplayName(entries[0]?.judge as StylistPersona)}</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
