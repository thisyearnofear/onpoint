"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { playReveal, playWin, playRoast, startTension, stopTension } from "../../../lib/utils/runway-sound";
import { scoreTier } from "../../../lib/runway-banter";
import type { DuelOutcome, ResultState, Stage } from "./types";

/**
 * Everything that makes the verdict feel like a moment: judging heartbeat,
 * rotating judge lines, sound + confetti, score count-up, and the staggered
 * banter after the verdict finishes typing.
 */
export function useResultReveal(opts: {
  stage: Stage;
  result: ResultState | null;
  soundOn: boolean;
  duel: DuelOutcome | null;
  isNewBest: boolean;
}) {
  const { stage, result, soundOn, duel, isNewBest } = opts;
  const reduceMotion = useReducedMotion();
  const [burst, setBurst] = useState(false);
  const [verdictTyped, setVerdictTyped] = useState(false);
  const [banterShown, setBanterShown] = useState(0);
  const [shownTotal, setShownTotal] = useState(0);
  const [judgeLineIdx, setJudgeLineIdx] = useState(0);

  // a new round clears the previous reveal
  useEffect(() => {
    if (!result) {
      setBurst(false);
      setVerdictTyped(false);
      setBanterShown(0);
    }
  }, [result]);

  // ambient heartbeat while the judges confer
  useEffect(() => {
    if (stage !== "judging" || !soundOn) return;
    startTension();
    return () => stopTension();
  }, [stage, soundOn]);

  // the other two judges chime in once the verdict finishes typing
  useEffect(() => {
    if (!verdictTyped) return;
    const t1 = window.setTimeout(() => setBanterShown(1), 450);
    const t2 = window.setTimeout(() => setBanterShown(2), 1300);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [verdictTyped]);

  // sound + confetti once the verdict lands
  useEffect(() => {
    if (stage !== "result" || !result) return;
    if (soundOn) playReveal();
    const tier = scoreTier(result.total);
    if (tier === "high" || duel === "win" || isNewBest) {
      setBurst(true);
      if (soundOn) window.setTimeout(() => playWin(), 1300);
    } else if (tier === "low" && soundOn) {
      window.setTimeout(() => playRoast(), 1200);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, result]);

  // score count-up (skipped under reduced motion)
  useEffect(() => {
    if (stage !== "result" || !result) return;
    if (reduceMotion) {
      setShownTotal(result.total);
      return;
    }
    setShownTotal(0);
    const t0 = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setShownTotal(result.total * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [stage, result, reduceMotion]);

  // rotate the judges' reaction lines while conferring
  useEffect(() => {
    if (stage !== "judging") return;
    setJudgeLineIdx(0);
    const id = window.setInterval(() => setJudgeLineIdx((i) => i + 1), 1200);
    return () => window.clearInterval(id);
  }, [stage]);

  return {
    burst, shownTotal, judgeLineIdx, banterShown,
    markVerdictTyped: () => setVerdictTyped(true),
    reduceMotion,
  };
}
