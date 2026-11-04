"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, Download, RotateCcw, Send, Share2, Swords, Volume2, VolumeX } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { SafeImage } from "../SafeImage";
import { JudgeAvatar, judgeDisplayName } from "./JudgeAvatar";
import { ScorePaddles } from "./ScorePaddles";
import { CountdownRing } from "./CountdownRing";
import { Confetti } from "./Confetti";
import { imageFileToJpegDataUrl, runwayPlayerId, duelOutcome, nextThemeLabel } from "../../lib/utils/runway";
import { playReveal, playWin, playRoast, startTension, stopTension, setSoundEnabled, soundEnabled } from "../../lib/utils/runway-sound";
import { banterFor, scoreTier } from "../../lib/runway-banter";
import { bestScore, computeStreak, useRunwayHistory } from "../../lib/stores/runway-history-store";
import { RUNWAY_SAMPLES, OUTFIT_SAMPLES, sampleById } from "../../lib/runway-samples";
import type { StylistPersona } from "@repo/ai-client";

type Stage = "intro" | "round" | "preview" | "judging" | "result" | "capped" | "error";

interface RoundState {
  roundId: string;
  deadline: number;
  theme: { id: string; name: string; brief: string };
  persona: { key: string; name: string };
  messages: string[];
}

interface ResultState {
  scores: { theme: number; cohesion: number; styling: number };
  total: number;
  verdict: string;
  fixHint: string;
  late: boolean;
  fix?: { kind: string; title: string; imageUrl: string | null; url: string } | null;
}

/** The score being challenged, loaded from ?ref=<roundId> (a shared result). */
interface OpponentState {
  roundId: string;
  total: number;
  themeId: string;
  themeName: string;
  persona: string;
  verdict: string;
}

const JUDGE_LINES: Record<"miranda" | "edina" | "shaft", string[]> = {
  miranda: ["Interesting choice. We'll see.", "Hm. I wasn't expecting that.", "Hold still — I'm looking.", "This had better be good."],
  edina: ["Darling, show me everything.", "Ooh, I do love a surprise.", "Sweetie, the suspense!", "Don't keep me waiting."],
  shaft: ["Let's see what you brought.", "Confidence. I respect it.", "Alright — impress me.", "Time to deliver."],
};

const REF_RE = /^[a-f0-9]{12}$/;
const MIN_JUDGE_MS = 2400;

const JUDGES: Array<{ key: StylistPersona; name: string }> = [
  { key: "miranda", name: "Miranda" },
  { key: "edina", name: "Edina" },
  { key: "shaft", name: "Shaft" },
];

function JudgeBubble({ persona, name, showAvatar = true, children }: { persona: StylistPersona; name: string; showAvatar?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      {showAvatar ? <JudgeAvatar persona={persona} size="md" /> : <div className="w-10" />}
      <div className="max-w-md rounded-2xl rounded-tl-sm border border-zinc-800 bg-zinc-900/80 px-4 py-3">
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.22em] text-zinc-500">{name}</p>
        <div className="mt-1 text-sm leading-relaxed text-zinc-100">{children}</div>
      </div>
    </div>
  );
}

/** Verdict text typed in character-by-character; instant under reduced motion. */
function TypedText({ text, onDone }: { text: string; onDone?: () => void }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (reduce) { setN(text.length); return; }
    setN(0);
    const id = window.setInterval(() => setN((v) => Math.min(v + 1, text.length)), 14);
    return () => window.clearInterval(id);
  }, [text, reduce]);
  const done = n >= text.length;
  useEffect(() => {
    if (done) onDone?.();
  }, [done, onDone]);
  return <>{text.slice(0, n)}{!done && <span className="animate-pulse">▌</span>}</>;
}

export function RunwayPlay() {
  const params = useSearchParams();
  const initialJudge = (params.get("judge") || "").toLowerCase() as StylistPersona;
  const themeId = params.get("theme") || undefined;

  const hasSampleParam = Boolean(params.get("judge") || sampleById(params.get("sample")));
  const [stage, setStage] = useState<Stage>(initialJudge || hasSampleParam ? "round" : "intro");
  const [judge, setJudge] = useState<StylistPersona>(JUDGES.some((j) => j.key === initialJudge) ? initialJudge : "miranda");
  const [round, setRound] = useState<RoundState | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [judgeNote, setJudgeNote] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [judgeLineIdx, setJudgeLineIdx] = useState(0);
  const [shownTotal, setShownTotal] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);
  const rawRef = params.get("ref") || "";
  const refSent = useRef(false);
  const judgingSince = useRef(0);
  const reduceMotion = useReducedMotion();
  const entries = useRunwayHistory((st) => st.entries);
  const addEntry = useRunwayHistory((st) => st.addEntry);
  const [isSample, setIsSample] = useState(false);
  const [opponent, setOpponent] = useState<OpponentState | null>(null);
  const [opponentLoaded, setOpponentLoaded] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [burst, setBurst] = useState(false);
  const [verdictTyped, setVerdictTyped] = useState(false);
  const [banterShown, setBanterShown] = useState(0);
  const shareRef = REF_RE.test(rawRef) ? rawRef : undefined;

  // Hydrate the sound preference and load the duel opponent from ?ref=.
  useEffect(() => {
    setSoundOn(soundEnabled());
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
    setBurst(false);
    setVerdictTyped(false);
    setBanterShown(0);
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
  }, []);

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

  const priorEntries = round ? entries.filter((e) => e.roundId !== round.roundId) : entries;
  const isNewBest = entries.length > 1 && result != null && result.total > (bestScore(priorEntries) ?? -1);
  const duel = opponent && result ? duelOutcome(result.total, opponent.total) : null;

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

  const cardUrl = (format: "story" | "feed") => `/runway/card/${round?.roundId}.png?format=${format}`;

  const recordShare = (channel: "native" | "copy" | "download") => {
    if (!round) return;
    fetch(`/api/runway/rounds/${round.roundId}/share`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel, playerId: runwayPlayerId() }),
    }).catch(() => undefined);
  };

  const share = async () => {
    if (!round || !result) return;
    const url = `${window.location.origin}/runway/r/${round.roundId}`;
    const text = opponent
      ? duel === "win"
        ? `I just beat a ${opponent.total.toFixed(1)} with a ${result.total.toFixed(1)} on ${round.theme.name}. Rematch?`
        : duel === "lose"
          ? `${result.total.toFixed(1)} vs their ${opponent.total.toFixed(1)} on ${round.theme.name}. Run it back — or take them on?`
          : `We tied at ${result.total.toFixed(1)} on ${round.theme.name}. Someone has to break this.`
      : `I got ${result.total.toFixed(1)} on ${round.theme.name}. Can you beat it?`;
    try {
      const res = await fetch(cardUrl("story"));
      if (res.ok) {
        const blob = await res.blob();
        const file = new File([blob], "runway.png", { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text, url });
          recordShare("native");
          return;
        }
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: "Runway", text, url });
        recordShare("native");
        return;
      }
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      recordShare("copy");
      setToast("Challenge link copied");
    } catch {
      setToast(url);
    }
    window.setTimeout(() => setToast(null), 2200);
  };

  const saveCard = () => {
    if (!round) return;
    const a = document.createElement("a");
    a.href = cardUrl("story");
    a.download = `runway-${round.roundId}.png`;
    a.click();
    recordShare("download");
    setToast("Story card saved");
    window.setTimeout(() => setToast(null), 2200);
  };

  const personaName = judgeDisplayName(round?.persona.key || judge);

  return (
    <div className="dark flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <header className="relative z-10 flex items-baseline justify-between px-4 py-4">
        <Link href="/runway" className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-primary">
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
            className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
          >
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
          <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-zinc-500">
            Judged by {personaName}
          </span>
        </div>
      </header>

      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
        {stage === "intro" && (
          <>
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Pick your judge</p>
            <div className="flex gap-4">
              {JUDGES.map((j) => (
                <button
                  key={j.key}
                  type="button"
                  onClick={() => {
                    setJudge(j.key);
                    void startRound(j.key, duelThemeId);
                  }}
                  disabled={busy}
                  className="flex min-h-[96px] w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <JudgeAvatar persona={j.key} size="lg" />
                  <span className="text-sm font-bold">{j.name}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                const j = JUDGES[Math.floor(Math.random() * JUDGES.length)]!;
                setJudge(j.key);
                void startRound(j.key, duelThemeId);
              }}
              disabled={busy}
              className="text-xs font-bold text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
            >
              Surprise me — any judge
            </button>
            {busy && <p className="text-sm text-zinc-400">Dealing a theme…</p>}
            {entries.length > 0 && (
              <div className="flex w-full max-w-sm flex-col items-center gap-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-400">
                  {computeStreak(entries, Date.now()) > 0 ? `Streak ${computeStreak(entries, Date.now())} · ` : ""}
                  Best {Math.max(...entries.map((e) => e.total)).toFixed(1)} · {entries.length} round{entries.length === 1 ? "" : "s"}
                </p>
                <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">Last verdict</p>
                  <div className="mt-1 flex items-center justify-between text-sm">
                    <span className="font-bold text-zinc-100">{entries[0]?.themeName}</span>
                    <span className="text-zinc-400">{entries[0]?.total.toFixed(1)}/10 · {judgeDisplayName(entries[0]?.judge as StylistPersona)}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {stage === "round" && round && (
          <>
            <div className="flex w-full flex-col gap-3">
              <JudgeBubble persona={judge} name={personaName}>{round.messages[0]}</JudgeBubble>
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The theme</p>
              <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{round.theme.name}</h1>
              <p className="mt-1 hidden text-sm text-zinc-400 sm:block">{round.theme.brief}</p>
              <p className="mt-1 text-sm font-bold text-zinc-200">Raid your closet. One full-length photo.</p>
            </div>
            {opponent && (
              <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10 px-4 py-1.5">
                <Swords className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
                <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
                  Duel — beat {opponent.total.toFixed(1)}
                </span>
              </div>
            )}
            <div className="scale-90 sm:scale-100"><CountdownRing deadline={round.deadline} /></div>
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={pickCamera}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <Camera className="h-5 w-5" />
                Take photo
              </button>
              <button type="button" onClick={pickFile} className="inline-flex min-h-12 items-center justify-center rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500">
                From library
              </button>
            </div>
            <p className="text-xs text-zinc-500">Your photo is judged and discarded — never stored.</p>
            <div id="sample-outfits" className="w-full max-w-md">
              <p className="mb-1.5 pl-4 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500">No photo? Tap a look — judges score it too</p>
              <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
                {RUNWAY_SAMPLES.map((smp) => (
                  <button
                    key={smp.id}
                    type="button"
                    onClick={() => void pickSample(smp.src)}
                    title={smp.label}
                    className="group h-20 w-16 shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60 hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={smp.src} alt={smp.label} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
                {OUTFIT_SAMPLES.map((smp) => (
                  <button
                    key={smp.id}
                    type="button"
                    onClick={() => void pickSample(smp.src)}
                    title={smp.label}
                    className="group h-20 w-16 shrink-0 snap-start overflow-hidden rounded-xl border border-zinc-700/60 bg-zinc-200/90 hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={smp.src} alt={smp.label} className="h-full w-full object-cover" loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {stage === "preview" && photoData && (
          <>
            {judgeNote && <JudgeBubble persona={judge} name={personaName}>{judgeNote}</JudgeBubble>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoData} alt="Your outfit" className="max-h-72 w-auto rounded-2xl border border-zinc-800 object-contain" />
              {isSample && (
                <span className="absolute left-2 top-2 rounded-full bg-zinc-950/80 px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-300">
                  Sample outfit
                </span>
              )}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={pickFile}
                className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500"
              >
                <RotateCcw className="h-4 w-4" /> Retake
              </button>
              <button
                type="button"
                onClick={() => void submit()}
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
              >
                <Send className="h-4 w-4" /> Send to the judges
              </button>
            </div>
          </>
        )}

        {stage === "judging" && (
          <>
            <div className="flex items-end gap-5">
              {JUDGES.map((j) => {
                const active = j.key === (round?.persona.key || judge);
                return (
                  <div
                    key={j.key}
                    className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                      active ? "scale-110" : "translate-y-1 opacity-50"
                    } ${!reduceMotion && active ? "animate-pulse" : ""}`}
                  >
                    <div className={active ? "rounded-full ring-2 ring-primary ring-offset-2 ring-offset-zinc-950" : ""}>
                      <JudgeAvatar persona={j.key} size="lg" />
                    </div>
                    <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-500">{j.name}</span>
                  </div>
                );
              })}
            </div>
            <p className="max-w-xs text-center text-sm font-bold text-zinc-300">
              {(() => { const k = ((round?.persona.key || judge) as "miranda" | "edina" | "shaft"); const lines = JUDGE_LINES[k] || JUDGE_LINES.miranda; return lines[judgeLineIdx % lines.length]; })()}
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500">The judges are conferring…</p>
          </>
        )}

        {stage === "result" && round && result && (
          <div className="flex w-full flex-col items-center gap-6 lg:max-w-4xl lg:flex-row lg:items-start lg:justify-center lg:gap-12">
            {photoData && (
              <figure className="w-44 shrink-0 -rotate-3 rounded-lg border border-zinc-700 bg-zinc-100 p-2 pb-3 shadow-2xl shadow-black/50 lg:mt-10 lg:w-64">
                {/* local preview only — the judged photo is never stored or re-uploaded */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photoData} alt={`Your outfit for ${round.theme.name}`} className="aspect-[3/4] w-full rounded object-cover" />
                <figcaption className="mt-2 text-center text-sm italic text-zinc-700">{round.theme.name}</figcaption>
              </figure>
            )}
            <div className="flex w-full max-w-lg flex-col items-center gap-6">
              <div className="flex items-center gap-3">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                  Runway · {round.theme.name}
                </p>
                {result.late && (
                  <span className="rounded-full border border-[hsl(var(--accent))] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent))]">
                    Late
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {computeStreak(entries, Date.now()) > 1 && (
                  <span className="rounded-full border border-primary/40 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-primary">
                    Day {computeStreak(entries, Date.now())} streak
                  </span>
                )}
                {isNewBest && (
                  <span className="rounded-full border border-[hsl(var(--accent))] px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--accent))]">
                    New best!
                  </span>
                )}
                {scoreTier(result.total) === "high" && (
                  <span className="rounded-full border border-amber-400/60 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-amber-300">
                    Judges&apos; favourite
                  </span>
                )}
                {scoreTier(result.total) === "low" && (
                  <span className="rounded-full border border-zinc-700 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-zinc-400">
                    Tough crowd
                  </span>
                )}
              </div>
              <ScorePaddles scores={result.scores} total={shownTotal} judgeName={personaName} animated />
              {duel && opponent && (
                <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 px-4 py-3.5 text-center">
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500">The duel</p>
                  <div className="mt-1.5 flex items-center justify-center gap-5">
                    <div>
                      <p className={`text-3xl font-black tabular-nums ${duel === "win" ? "text-[hsl(var(--accent))]" : "text-zinc-50"}`}>{result.total.toFixed(1)}</p>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">You</p>
                    </div>
                    <p className="font-mono text-xs font-bold text-zinc-600">vs</p>
                    <div>
                      <p className={`text-3xl font-black tabular-nums ${duel === "lose" ? "text-[hsl(var(--accent))]" : "text-zinc-400"}`}>{opponent.total.toFixed(1)}</p>
                      <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-zinc-500">Them</p>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-bold text-zinc-100">
                    {duel === "win" ? "You took it." : duel === "lose" ? "They keep the crown." : "Dead heat — run it back."}
                  </p>
                  {opponent.verdict && (
                    <p className="mt-1.5 line-clamp-2 text-xs italic text-zinc-500">
                      Theirs: &ldquo;{opponent.verdict}&rdquo;
                    </p>
                  )}
                  {duel !== "win" && (
                    <button
                      type="button"
                      onClick={() => { setPhotoData(null); setIsSample(false); void startRound(judge, opponent.themeId); }}
                      className="mt-2.5 inline-flex min-h-10 items-center gap-1.5 rounded-full border border-[hsl(var(--accent))]/60 px-4 text-xs font-bold text-[hsl(var(--accent))] hover:bg-[hsl(var(--accent))]/10"
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Run it back
                    </button>
                  )}
                </div>
              )}
              <JudgeBubble persona={judge} name={personaName}>
                <TypedText text={result.verdict} onDone={() => setVerdictTyped(true)} />
              </JudgeBubble>
              {JUDGES.filter((j) => j.key !== (round.persona.key || judge)).map((rj, i) =>
                banterShown > i ? (
                  <JudgeBubble key={rj.key} persona={rj.key} name={`${rj.name} reacts`}>
                    {banterFor(rj.key, scoreTier(result.total), round.roundId)}
                  </JudgeBubble>
                ) : null,
              )}
              {result.fix && (
              <div className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
                <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The fix</p>
                <div className="mt-2 flex items-center gap-4">
                  {result.fix.imageUrl && (
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
                      <SafeImage sources={[result.fix.imageUrl]} alt={result.fix.title} fill unoptimized className="object-cover" fallbackIconSize={24} />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-zinc-400">{result.fixHint}</p>
                    <p className="truncate text-base font-bold text-zinc-50">{result.fix.title}</p>
                    <a
                      href={result.fix.url}
                      className="mt-2 inline-flex min-h-11 items-center rounded-full bg-primary px-5 text-sm font-bold text-white hover:bg-primary/90"
                    >
                      {result.fix.kind === "inspiration" ? "Get the look" : "See it on you"}
                    </a>
                  </div>
                </div>
              </div>
            )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={cardUrl("feed")} alt="Your Runway result card" className="h-44 w-auto rounded-xl border border-zinc-800" />
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void share()}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
                >
                  <Share2 className="h-4 w-4" /> Challenge a friend
                </button>
                <button
                  type="button"
                  onClick={saveCard}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500"
                >
                  <Download className="h-4 w-4" /> Save story card
                </button>
                {isSample && (
                  <button
                    type="button"
                    onClick={() => { started.current = false; setPhotoData(null); setIsSample(false); void startRound(judge); }}
                    className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500"
                  >
                    <Camera className="h-4 w-4" /> Try your own photo
                  </button>
                )}
              </div>
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => { started.current = false; setPhotoData(null); setIsSample(false); void startRound(judge); }}
                  className="text-xs font-bold text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  Play again
                </button>
                <button
                  type="button"
                  onClick={() => setStage("intro")}
                  className="text-xs font-bold text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
                >
                  Switch judge
                </button>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                New theme in {nextThemeLabel(Date.now())}
              </p>
            </div>
          </div>
        )}

        {stage === "capped" && (
          <>
            <JudgeBubble persona={judge} name={personaName}>{judgeNote}</JudgeBubble>
            <Link href="/runway" className="inline-flex min-h-12 items-center rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500">
              Back to Runway
            </Link>
          </>
        )}

        {stage === "error" && (
          <>
            <JudgeBubble persona={judge} name={personaName}>The line went quiet. Try again in a moment.</JudgeBubble>
            <button
              type="button"
              onClick={() => void startRound(judge, duelThemeId)}
              className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
            >
              Try again
            </button>
          </>
        )}

        <Confetti fire={burst} variant={result && scoreTier(result.total) === "high" ? "gold" : "accent"} />

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 shadow-xl">
            {toast}
          </div>
        )}
      </main>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
      <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => void onFile(e)} />
    </div>
  );
}
