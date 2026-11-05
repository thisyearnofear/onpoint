"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Volume2, VolumeX } from "lucide-react";
import { judgeDisplayName } from "./JudgeAvatar";
import { Confetti } from "./Confetti";
import { duelOutcome } from "../../lib/utils/runway";
import { setSoundEnabled, soundEnabled } from "../../lib/utils/runway-sound";
import { scoreTier } from "../../lib/runway-banter";
import { bestScore } from "../../lib/stores/runway-history-store";
import { useRunwayRound } from "./play/useRunwayRound";
import { useResultReveal } from "./play/useResultReveal";
import { useRunwayShare } from "./play/useRunwayShare";
import { IntroStage } from "./play/IntroStage";
import { RoundStage } from "./play/RoundStage";
import { PreviewStage } from "./play/PreviewStage";
import { JudgingStage } from "./play/JudgingStage";
import { ResultStage } from "./play/ResultStage";
import { CappedStage, ErrorStage } from "./play/TerminalStages";

/**
 * Runway game screen. State machine: ./play/useRunwayRound · reveal effects:
 * ./play/useResultReveal · sharing: ./play/useRunwayShare · one component per stage.
 */
export function RunwayPlay() {
  const r = useRunwayRound();
  const { stage, round, result, opponent, entries, judge } = r;

  const [soundOn, setSoundOn] = useState(true);
  useEffect(() => setSoundOn(soundEnabled()), []);

  const priorEntries = round ? entries.filter((e) => e.roundId !== round.roundId) : entries;
  const isNewBest = entries.length > 1 && result != null && result.total > (bestScore(priorEntries) ?? -1);
  const duel = opponent && result ? duelOutcome(result.total, opponent.total) : null;

  const reveal = useResultReveal({ stage, result, soundOn, duel, isNewBest });
  const { toast, share, saveCard } = useRunwayShare({ round, result, opponent, duel });

  const activeJudge = (round?.persona.key || judge) as typeof judge;
  const personaName = judgeDisplayName(activeJudge);

  const pickJudge = (key: typeof judge) => {
    r.setJudge(key);
    void r.startRound(key, r.duelThemeId);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <header className="relative z-10 flex items-baseline justify-between px-4 py-4">
        <Link href="/runway" className="font-mono text-xs font-bold uppercase leading-none tracking-[0.22em] text-primary">
          ← Runway
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              const next = !soundOn;
              setSoundOn(next);
              setSoundEnabled(next);
            }}
            aria-label={soundOn ? "Mute sound" : "Unmute sound"}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-zinc-600 hover:text-foreground/80"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <span className="font-mono text-xs font-bold uppercase leading-none tracking-[0.22em] text-muted-foreground">
            Judged by {personaName}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        {stage === "intro" && <IntroStage busy={r.busy} entries={entries} onPick={pickJudge} />}

        {stage === "round" && round && (
          <RoundStage
            round={round}
            judge={judge}
            personaName={personaName}
            opponent={opponent}
            onTakePhoto={r.pickCamera}
            onPickLibrary={r.pickFile}
            onPickSample={(src) => void r.pickSample(src)}
          />
        )}

        {stage === "preview" && r.photoData && (
          <PreviewStage
            photoData={r.photoData}
            isSample={r.isSample}
            judge={judge}
            personaName={personaName}
            judgeNote={r.judgeNote}
            onRetake={r.pickFile}
            onSubmit={() => void r.submit()}
          />
        )}

        {stage === "judging" && (
          <JudgingStage photoData={r.photoData} activeJudge={activeJudge} lineIdx={reveal.judgeLineIdx} reduceMotion={reveal.reduceMotion} />
        )}

        {stage === "result" && round && result && (
          <ResultStage
            round={round}
            result={result}
            photoData={r.photoData}
            judge={judge}
            personaName={personaName}
            entries={entries}
            isNewBest={isNewBest}
            isSample={r.isSample}
            opponent={opponent}
            duel={duel}
            shownTotal={reveal.shownTotal}
            banterShown={reveal.banterShown}
            onVerdictTyped={reveal.markVerdictTyped}
            onShare={() => void share()}
            onSaveCard={saveCard}
            onRunItBack={() => r.replay({ theme: opponent?.themeId })}
            onPlayAgain={() => r.replay({ resetAutostart: true })}
            onSwitchJudge={() => r.setStage("intro")}
          />
        )}

        {stage === "capped" && <CappedStage judge={judge} personaName={personaName} note={r.judgeNote} />}
        {stage === "error" && <ErrorStage judge={judge} personaName={personaName} onRetry={() => void r.startRound(judge, r.duelThemeId)} />}

        <Confetti fire={reveal.burst} variant={result && scoreTier(result.total) === "high" ? "gold" : "accent"} />

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zinc-700 bg-card px-4 py-2 text-sm font-bold text-foreground shadow-xl">
            {toast}
          </div>
        )}
      </main>

      <input ref={r.fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void r.onFile(e)} />
      <input ref={r.camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void r.onFile(e)} />
    </div>
  );
}
