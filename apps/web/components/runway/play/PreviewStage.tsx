import React from "react";
import { RotateCcw, Send } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeBubble } from "./JudgeBubble";

export function PreviewStage({
  photoData,
  isSample,
  judge,
  personaName,
  judgeNote,
  onRetake,
  onSubmit,
}: {
  photoData: string;
  isSample: boolean;
  judge: StylistPersona;
  personaName: string;
  judgeNote: string | null;
  onRetake: () => void;
  onSubmit: () => void;
}) {
  return (
    <>
      {judgeNote && <JudgeBubble persona={judge} name={personaName}>{judgeNote}</JudgeBubble>}
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoData} alt="Your outfit" className="max-h-72 w-auto rounded-2xl border border-border object-contain" />
        {isSample && (
          <span className="absolute left-2 top-2 rounded-full bg-background/80 px-2.5 py-1 font-mono text-xs font-bold uppercase tracking-[0.18em] text-foreground/70">
            Sample outfit
          </span>
        )}
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetake}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border border-zinc-700 px-6 text-sm font-bold text-foreground hover:border-zinc-500"
        >
          <RotateCcw className="h-4 w-4" /> Retake
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-lg shadow-primary/20 hover:bg-primary/90"
        >
          <Send className="h-4 w-4" /> Send to the judges
        </button>
      </div>
    </>
  );
}
