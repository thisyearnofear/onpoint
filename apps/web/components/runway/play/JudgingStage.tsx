import React from "react";
import { motion } from "framer-motion";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeAvatar } from "../JudgeAvatar";
import { JUDGES, JUDGE_LINES } from "./types";

export function JudgingStage({
  photoData,
  activeJudge,
  lineIdx,
  reduceMotion,
}: {
  photoData: string | null;
  activeJudge: StylistPersona;
  lineIdx: number;
  reduceMotion: boolean | null;
}) {
  const lines = JUDGE_LINES[activeJudge as keyof typeof JUDGE_LINES] || JUDGE_LINES.miranda;
  return (
    <>
      {photoData && (
        <div className="relative h-40 w-32 overflow-hidden rounded-xl border border-border bg-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoData} alt="Your outfit under review" className="h-full w-full object-cover opacity-80" />
          {!reduceMotion && (
            <motion.div
              aria-hidden
              className="absolute inset-x-0 h-12 bg-gradient-to-b from-transparent via-primary/40 to-transparent"
              initial={{ top: "-30%" }}
              animate={{ top: "110%" }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            />
          )}
        </div>
      )}
      <div className="flex items-end gap-5">
        {JUDGES.map((j) => {
          const active = j.key === activeJudge;
          return (
            <div
              key={j.key}
              className={`flex flex-col items-center gap-2 transition-all duration-300 ${
                active ? "scale-110" : "translate-y-1 opacity-50"
              } ${!reduceMotion && active ? "animate-pulse" : ""}`}
            >
              <div className={active ? "rounded-full ring-2 ring-primary ring-offset-2 ring-offset-background" : ""}>
                <JudgeAvatar persona={j.key} size="lg" />
              </div>
              <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{j.name}</span>
            </div>
          );
        })}
      </div>
      <p className="max-w-xs text-center text-sm font-bold text-foreground/70">{lines[lineIdx % lines.length]}</p>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">The judges are conferring…</p>
    </>
  );
}
