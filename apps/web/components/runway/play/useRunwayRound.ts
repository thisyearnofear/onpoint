"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { StylistPersona } from "@repo/ai-client";
import { imageFileToJpegDataUrl, runwayPlayerId } from "../../../lib/utils/runway";
import { sampleById } from "../../../lib/runway-samples";
import { useRunwayHistory } from "../../../lib/stores/runway-history-store";
import { JUDGES, MIN_JUDGE_MS, REF_RE } from "./types";
import type { OpponentState, ResultState, RoundState, Stage } from "./types";

/**
 * The Runway round state machine: duel opponent loading, round creation,
 * photo/sample selection, judging, and the on-device history write.
 * Presentation, reveal effects and sharing live in sibling modules.
 */
export function useRunwayRound() {
  const params = useSearchParams();
  const initialJudge = (params.get("judge") || "").toLowerCase() as StylistPersona;
  const themeId = params.get("theme") || undefined;
  const rawRef = params.get("ref") || "";
  const shareRef = REF_RE.test(rawRef) ? rawRef : undefined;
  const hasSampleParam = Boolean(params.get("judge") || sampleById(params.get("sample")));

  const [stage, setStage] = useState<Stage>(initialJudge || hasSampleParam ? "round" : "intro");
  const [judge, setJudge] = useState<StylistPersona>(JUDGES.some((j) => j.key === initialJudge) ? initialJudge : "miranda");
  const [round, setRound] = useState<RoundState | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [judgeNote, setJudgeNote] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [busy, setBusy] = useState(false);
  const [isSample, setIsSample] = useState(false);
  const [opponent, setOpponent] = useState<OpponentState | null>(null);
  const [opponentLoaded, setOpponentLoaded] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const refSent = useRef(false);
  const judgingSince = useRef(0);

  const entries = useRunwayHistory((st) => st.entries);
  const addEntry = useRunwayHistory((st) => st.addEntry);

  // Load the duel opponent from ?ref=.
  useEffect(() => {
    if (!shareRef) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/runway/results/${shareRef}`, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) return;
        const body = await res.json();
        if (!cancelled) {
          setOpponent({ roundId: body.roundId, total: body.total, themeId: body.themeId, themeName: body.themeName, persona: body.persona, verdict: body.verdict });
        }
      } catch { /* duel is optional — play on without it */ }
      finally { if (!cancelled) setOpponentLoaded(true); }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A duel always uses the opponent's theme; ?theme= can still override it.
  const duelThemeId = themeId || opponent?.themeId;

  const startRound = useCallback(async (judgeKey: StylistPersona, tid?: string) => {
    setBusy(true);
    setJudgeNote(null);
    setResult(null);
    setPhotoData(null);
    try {
      const res = await fetch("/api/runway/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: runwayPlayerId(), judge: judgeKey, themeId: tid, ...(shareRef && !refSent.current ? { ref: shareRef } : {}) }),
      });
      const body = await res.json();
      if (res.status === 429 || body.status === "capped") {
        setJudgeNote(body.messages?.[0] || "That's enough for today.");
        setStage("capped");
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setRound({ roundId: body.roundId, deadline: body.deadline, theme: body.theme, persona: body.persona, messages: body.messages });
      refSent.current = true;
      setJudge(judgeKey);
      setStage("round");
    } catch {
      setStage("error");
    } finally {
      setBusy(false);
    }
  }, [shareRef]);

  // Auto-start when arriving with ?judge= (waits for the opponent's theme on duels)
  useEffect(() => {
    if (stage === "round" && !round && !started.current && (!shareRef || opponentLoaded)) {
      started.current = true;
      void startRound(judge, duelThemeId);
    }
  }, [stage, round, judge, duelThemeId, shareRef, opponentLoaded, startRound]);

  const pickFile = () => fileRef.current?.click();
  const pickCamera = () => camRef.current?.click();

  const pickSample = async (src: string) => {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const file = new File([blob], "sample.jpg", { type: blob.type || "image/jpeg" });
      setPhotoData(await imageFileToJpegDataUrl(file));
      setIsSample(true);
      setStage("preview");
    } catch {
      setJudgeNote("Could not load that sample — try another.");
    }
  };

  // Auto-pick a sample when arriving with ?sample=<id> once a round exists.
  useEffect(() => {
    const smp = sampleById(params.get("sample"));
    if (smp && stage === "round" && round && !photoData) void pickSample(smp.src);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, round]);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPhotoData(await imageFileToJpegDataUrl(file));
      setStage("preview");
    } catch {
      setJudgeNote("I could not read that photo. Try another.");
    }
  };

  const submit = async () => {
    if (!round || !photoData) return;
    judgingSince.current = Date.now();
    setStage("judging");
    const reveal = (fn: () => void) => {
      const wait = Math.max(0, MIN_JUDGE_MS - (Date.now() - judgingSince.current));
      window.setTimeout(fn, wait);
    };
    try {
      const res = await fetch(`/api/runway/rounds/${round.roundId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: runwayPlayerId(), photoData, ...(isSample ? { sample: true } : {}) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.status === "ok") {
        const r: ResultState = { ...body.result, fix: body.fix || null };
        reveal(() => {
          setResult(r);
          setStage("result");
        });
      } else {
        reveal(() => {
          setJudgeNote(body.messages?.[0] || "Try another photo.");
          setStage("preview");
        });
      }
    } catch {
      reveal(() => {
        setJudgeNote("The judges couldn't see that. Try again in a moment.");
        setStage("preview");
      });
    }
  };

  // write the round to on-device history once the result lands
  useEffect(() => {
    if (stage === "result" && round && result) {
      addEntry({
        roundId: round.roundId,
        themeId: round.theme.id,
        themeName: round.theme.name,
        judge: round.persona.key || judge,
        total: result.total,
        scores: result.scores,
        verdict: result.verdict,
        at: Date.now(),
      });
    }
  }, [stage, round, result, judge, addEntry]);

  /** Play again / run it back: drop the photo and deal a new round. */
  const replay = (opts: { theme?: string; resetAutostart?: boolean } = {}) => {
    if (opts.resetAutostart) started.current = false;
    setPhotoData(null);
    setIsSample(false);
    void startRound(judge, opts.theme);
  };

  return {
    stage, setStage, judge, setJudge, round, photoData, judgeNote, result, busy, isSample,
    opponent, shareRef, duelThemeId, entries,
    fileRef, camRef, pickFile, pickCamera, pickSample, onFile, submit, startRound, replay,
  };
}
