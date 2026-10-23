"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Camera, RotateCcw, Send, Share2, Users } from "lucide-react";
import { SafeImage } from "../SafeImage";
import { JudgeAvatar, judgeDisplayName } from "./JudgeAvatar";
import { ScorePaddles } from "./ScorePaddles";
import { CountdownRing } from "./CountdownRing";
import { imageFileToJpegDataUrl, runwayPlayerId } from "../../lib/utils/runway";
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

export function RunwayPlay() {
  const params = useSearchParams();
  const initialJudge = (params.get("judge") || "").toLowerCase() as StylistPersona;
  const themeId = params.get("theme") || undefined;

  const [stage, setStage] = useState<Stage>(initialJudge ? "round" : "intro");
  const [judge, setJudge] = useState<StylistPersona>(JUDGES.some((j) => j.key === initialJudge) ? initialJudge : "miranda");
  const [round, setRound] = useState<RoundState | null>(null);
  const [photoData, setPhotoData] = useState<string | null>(null);
  const [judgeNote, setJudgeNote] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const startRound = useCallback(async (judgeKey: StylistPersona, tid?: string) => {
    setBusy(true);
    setJudgeNote(null);
    setResult(null);
    setPhotoData(null);
    try {
      const res = await fetch("/api/runway/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: runwayPlayerId(), judge: judgeKey, themeId: tid }),
      });
      const body = await res.json();
      if (res.status === 429 || body.status === "capped") {
        setJudgeNote(body.messages?.[0] || "That's enough for today.");
        setStage("capped");
        return;
      }
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      setRound({ roundId: body.roundId, deadline: body.deadline, theme: body.theme, persona: body.persona, messages: body.messages });
      setJudge(judgeKey);
      setStage("round");
    } catch {
      setStage("error");
    } finally {
      setBusy(false);
    }
  }, []);

  // Auto-start when arriving with ?judge=
  useEffect(() => {
    if (stage === "round" && !round && !started.current) {
      started.current = true;
      void startRound(judge, themeId);
    }
  }, [stage, round, judge, themeId, startRound]);

  const pickFile = () => fileRef.current?.click();

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
    setStage("judging");
    try {
      const res = await fetch(`/api/runway/rounds/${round.roundId}/photo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: runwayPlayerId(), photoData }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
      if (body.status === "ok") {
        setResult({ ...body.result, fix: body.fix || null });
        setStage("result");
      } else {
        setJudgeNote(body.messages?.[0] || "Try another photo.");
        setStage("preview");
      }
    } catch {
      setJudgeNote("The judges couldn't see that. Try again in a moment.");
      setStage("preview");
    }
  };

  const share = async () => {
    if (!round || !result) return;
    const url = `${window.location.origin}/runway/r/${round.roundId}`;
    const text = `I got ${result.total.toFixed(1)} on ${round.theme.name}. Can you beat it?`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Runway", text, url });
        return;
      }
      throw new Error("no share api");
    } catch {
      try {
        await navigator.clipboard.writeText(`${text} ${url}`);
        setToast("Challenge link copied");
      } catch {
        setToast(url);
      }
      window.setTimeout(() => setToast(null), 2200);
    }
  };

  const personaName = judgeDisplayName(round?.persona.key || judge);

  return (
    <div className="dark flex min-h-screen flex-col bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
      <header className="relative z-10 flex items-baseline justify-between px-4 py-4">
        <Link href="/runway" className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-primary">
          ← Runway
        </Link>
        <span className="font-mono text-[10px] font-bold uppercase leading-none tracking-[0.22em] text-zinc-500">
          Judged by {personaName}
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
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
                    void startRound(j.key, themeId);
                  }}
                  disabled={busy}
                  className="flex min-h-[96px] w-24 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 transition-colors hover:border-primary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <JudgeAvatar persona={j.key} size="lg" />
                  <span className="text-sm font-bold">{j.name}</span>
                </button>
              ))}
            </div>
            {busy && <p className="text-sm text-zinc-400">Dealing a theme…</p>}
          </>
        )}

        {stage === "round" && round && (
          <>
            <div className="flex w-full flex-col gap-3">
              <JudgeBubble persona={judge} name={personaName}>{round.messages[0]}</JudgeBubble>
            </div>
            <div className="text-center">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">The theme</p>
              <h1 className="mt-1 text-4xl font-black tracking-[-0.04em]">{round.theme.name}</h1>
              <p className="mt-1 text-sm text-zinc-400">{round.theme.brief}</p>
              <p className="mt-2 text-sm font-bold text-zinc-200">Raid your closet. One full-length photo.</p>
            </div>
            <CountdownRing deadline={round.deadline} />
            <button
              type="button"
              onClick={pickFile}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-8 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Camera className="h-5 w-5" />
              I&rsquo;m dressed — add photo
            </button>
            <p className="text-xs text-zinc-500">Your photo is judged and discarded — never stored.</p>
          </>
        )}

        {stage === "preview" && photoData && (
          <>
            {judgeNote && <JudgeBubble persona={judge} name={personaName}>{judgeNote}</JudgeBubble>}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoData} alt="Your outfit" className="max-h-72 w-auto rounded-2xl border border-zinc-800 object-contain" />
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
            <div className="flex gap-3 opacity-40">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col items-center">
                  <div className="h-32 w-24 animate-pulse rounded-2xl border border-zinc-700 bg-zinc-900" style={{ animationDelay: `${i * 150}ms` }} />
                  <div className="h-6 w-1 bg-zinc-700" />
                </div>
              ))}
            </div>
            <p className="text-sm font-bold text-zinc-300">The judges are conferring…</p>
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
              <ScorePaddles scores={result.scores} total={result.total} judgeName={personaName} animated />
              <JudgeBubble persona={judge} name={personaName}>{result.verdict}</JudgeBubble>
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
                      See it on you
                    </a>
                  </div>
                </div>
              </div>
            )}
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
                  onClick={() => { started.current = false; setPhotoData(null); void startRound(judge); }}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500"
                >
                  <RotateCcw className="h-4 w-4" /> Play again
                </button>
                <button
                  type="button"
                  onClick={() => setStage("intro")}
                  className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-zinc-100 hover:border-zinc-500"
                >
                  <Users className="h-4 w-4" /> Switch judge
                </button>
              </div>
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
              onClick={() => void startRound(judge, themeId)}
              className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
            >
              Try again
            </button>
          </>
        )}

        {toast && (
          <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-bold text-zinc-100 shadow-xl">
            {toast}
          </div>
        )}
      </main>

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void onFile(e)} />
    </div>
  );
}
