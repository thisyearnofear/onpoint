import React from "react";
import { Camera, Download, RotateCcw, Share2 } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { SafeImage } from "../../SafeImage";
import { ScorePaddles } from "../ScorePaddles";
import { computeStreak } from "../../../lib/stores/runway-history-store";
import type { RunwayEntry } from "../../../lib/stores/runway-history-store";
import { banterFor, scoreTier } from "../../../lib/runway-banter";
import { nextThemeLabel } from "../../../lib/utils/runway";
import { JudgeBubble } from "./JudgeBubble";
import { GetItButton } from "./GetItButton";
import { TypedText } from "./TypedText";
import { JUDGES, cardUrl } from "./types";
import type { DuelOutcome, OpponentState, ResultState, RoundState } from "./types";

const PILL = "rounded-full border px-2.5 py-0.5 font-mono text-xs font-bold uppercase tracking-[0.2em]";
const QUIET_LINK = "text-xs font-bold text-muted-foreground underline-offset-2 hover:text-foreground/70 hover:underline";
const OUTLINE_BTN = "inline-flex min-h-12 items-center gap-2 rounded-full border border-border px-6 text-sm font-bold text-foreground hover:border-foreground";

function ResultBadges({ result, entries, isNewBest }: { result: ResultState; entries: RunwayEntry[]; isNewBest: boolean }) {
  const streak = computeStreak(entries, Date.now());
  const tier = scoreTier(result.total);
  return (
    <div className="flex items-center gap-2">
      {streak > 1 && <span className={`${PILL} border-primary/40 text-primary`}>Day {streak} streak</span>}
      {isNewBest && <span className={`${PILL} border-[hsl(var(--accent))] text-[hsl(var(--accent))]`}>New best!</span>}
      {tier === "high" && <span className={`${PILL} border-amber-400/60 text-amber-300`}>Judges&apos; favourite</span>}
      {tier === "low" && <span className={`${PILL} border-border text-muted-foreground`}>Tough crowd</span>}
    </div>
  );
}

function DuelCard({
  result,
  opponent,
  duel,
  onRunItBack,
}: {
  result: ResultState;
  opponent: OpponentState;
  duel: DuelOutcome;
  onRunItBack: () => void;
}) {
  return (
    <div className="w-full border border-border bg-card px-4 py-3.5 text-center">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">The duel</p>
      <div className="mt-1.5 flex items-center justify-center gap-5">
        <div>
          <p className={`text-3xl font-black tabular-nums ${duel === "win" ? "text-[hsl(var(--accent))]" : "text-foreground"}`}>{result.total.toFixed(1)}</p>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">You</p>
        </div>
        <p className="font-mono text-xs font-bold text-muted-foreground">vs</p>
        <div>
          <p className={`text-3xl font-black tabular-nums ${duel === "lose" ? "text-[hsl(var(--accent))]" : "text-muted-foreground"}`}>{opponent.total.toFixed(1)}</p>
          <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Them</p>
        </div>
      </div>
      <p className="mt-2 text-sm font-bold text-foreground">
        {duel === "win" ? "You took it." : duel === "lose" ? "They keep the crown." : "Dead heat — run it back."}
      </p>
      {opponent.verdict && (
        <p className="mt-1.5 line-clamp-2 text-xs italic text-muted-foreground">
          Theirs: &ldquo;{opponent.verdict}&rdquo;
        </p>
      )}
      {duel !== "win" && (
        <button
          type="button"
          onClick={onRunItBack}
          className="mt-2.5 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[hsl(var(--accent))]/60 px-4 text-xs font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Run it back
        </button>
      )}
    </div>
  );
}

function FixCard({ result }: { result: ResultState }) {
  const fix = result.fix;
  if (!fix) return null;
  return (
    <div className="w-full border border-border bg-card p-4">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">The fix</p>
      <div className="mt-2 flex items-center gap-4">
        {fix.imageUrl && (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden border border-border bg-card">
            <SafeImage sources={[fix.imageUrl]} alt={fix.title} fill unoptimized className="object-cover" fallbackIconSize={24} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">{result.fixHint}</p>
          <p className="truncate text-base font-bold text-foreground">{fix.title}</p>
          <GetItButton fix={fix} />
        </div>
      </div>
    </div>
  );
}

export function ResultStage({
  round,
  result,
  photoData,
  judge,
  personaName,
  entries,
  isNewBest,
  isSample,
  opponent,
  duel,
  shownTotal,
  banterShown,
  onVerdictTyped,
  onShare,
  onSaveCard,
  onRunItBack,
  onPlayAgain,
  onSwitchJudge,
}: {
  round: RoundState;
  result: ResultState;
  photoData: string | null;
  judge: StylistPersona;
  personaName: string;
  entries: RunwayEntry[];
  isNewBest: boolean;
  isSample: boolean;
  opponent: OpponentState | null;
  duel: DuelOutcome | null;
  shownTotal: number;
  banterShown: number;
  onVerdictTyped: () => void;
  onShare: () => void;
  onSaveCard: () => void;
  onRunItBack: () => void;
  onPlayAgain: () => void;
  onSwitchJudge: () => void;
}) {
  const tier = scoreTier(result.total);
  const judgeKey = round.persona.key || judge;
  return (
    <div className="flex w-full flex-col items-center gap-6 lg:max-w-4xl lg:flex-row lg:items-start lg:justify-center lg:gap-12">
      {photoData && (
        <figure className="sticky top-3 z-30 w-36 shrink-0 -rotate-3 self-start rounded-lg border border-border bg-zinc-100 p-2 pb-3 shadow-2xl shadow-black/50 lg:top-10 lg:mt-10 lg:w-64">
          {/* local preview only — the judged photo is never stored or re-uploaded */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoData} alt={`Your outfit for ${round.theme.name}`} className="aspect-[3/4] w-full rounded object-cover" />
          <figcaption className="mt-2 text-center text-sm italic text-zinc-700">{round.theme.name}</figcaption>
        </figure>
      )}
      <div className="flex w-full max-w-lg flex-col items-center gap-6">
        <div className="flex items-center gap-3">
          <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
            Runway · {round.theme.name}
          </p>
          {result.late && <span className={`${PILL} border-[hsl(var(--accent))] text-[hsl(var(--accent))]`}>Late</span>}
        </div>
        <ResultBadges result={result} entries={entries} isNewBest={isNewBest} />
        <ScorePaddles scores={result.scores} total={shownTotal} judgeName={personaName} animated />
        {duel && opponent && <DuelCard result={result} opponent={opponent} duel={duel} onRunItBack={onRunItBack} />}
        <JudgeBubble persona={judge} name={personaName}>
          <TypedText text={result.verdict} onDone={onVerdictTyped} />
        </JudgeBubble>
        {JUDGES.filter((j) => j.key !== judgeKey).map((rj, i) =>
          banterShown > i ? (
            <JudgeBubble key={rj.key} persona={rj.key} name={`${rj.name} reacts`}>
              {banterFor(rj.key, tier, round.roundId)}
            </JudgeBubble>
          ) : null,
        )}
        <FixCard result={result} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cardUrl(round.roundId, "feed")} alt="Your Runway result card" className="h-44 w-auto border border-border" />
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onShare}
            className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
          >
            <Share2 className="h-4 w-4" /> Challenge a friend
          </button>
          <button type="button" onClick={onSaveCard} className={OUTLINE_BTN}>
            <Download className="h-4 w-4" /> Save story card
          </button>
          {isSample && (
            <button type="button" onClick={onPlayAgain} className={OUTLINE_BTN}>
              <Camera className="h-4 w-4" /> Try your own photo
            </button>
          )}
        </div>
        <div className="flex items-center gap-4">
          <button type="button" onClick={onPlayAgain} className={QUIET_LINK}>Play again</button>
          <button type="button" onClick={onSwitchJudge} className={QUIET_LINK}>Switch judge</button>
        </div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-muted-foreground">
          New theme in {nextThemeLabel(Date.now())}
        </p>
      </div>
    </div>
  );
}
