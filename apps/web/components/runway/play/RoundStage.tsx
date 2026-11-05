import React from "react";
import { Camera, Swords } from "lucide-react";
import type { StylistPersona } from "@repo/ai-client";
import { CountdownRing } from "../CountdownRing";
import { RUNWAY_SAMPLES, OUTFIT_SAMPLES } from "../../../lib/runway-samples";
import { JudgeBubble } from "./JudgeBubble";
import type { OpponentState, RoundState } from "./types";

export function RoundStage({
  round,
  judge,
  personaName,
  opponent,
  onTakePhoto,
  onPickLibrary,
  onPickSample,
}: {
  round: RoundState;
  judge: StylistPersona;
  personaName: string;
  opponent: OpponentState | null;
  onTakePhoto: () => void;
  onPickLibrary: () => void;
  onPickSample: (src: string) => void;
}) {
  return (
    <>
      <div className="flex w-full flex-col gap-3">
        <JudgeBubble persona={judge} name={personaName}>{round.messages[0]}</JudgeBubble>
      </div>
      <div className="text-center">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">The theme</p>
        <h1 className="mt-1 text-3xl font-black tracking-[-0.04em] sm:text-4xl">{round.theme.name}</h1>
        <p className="mt-1 hidden text-sm text-muted-foreground sm:block">{round.theme.brief}</p>
        <p className="mt-1 text-sm font-bold text-foreground/80">Raid your closet. One full-length photo.</p>
      </div>
      {opponent && (
        <div className="flex items-center gap-2 rounded-full border border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10 px-4 py-1.5">
          <Swords className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
          <span className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-[hsl(var(--accent))]">
            Duel — beat {opponent.total.toFixed(1)}
          </span>
        </div>
      )}
      <div className="scale-90 sm:scale-100"><CountdownRing deadline={round.deadline} /></div>
      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={onTakePhoto}
          className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Camera className="h-5 w-5" />
          Take photo
        </button>
        <button type="button" onClick={onPickLibrary} className="inline-flex min-h-12 items-center justify-center rounded-full border border-border px-6 text-sm font-bold text-foreground hover:border-foreground">
          From library
        </button>
      </div>
      <p className="text-xs text-muted-foreground">Your photo is judged and discarded — never stored.</p>
      <div id="sample-outfits" className="w-full max-w-md">
        <p className="mb-1.5 pl-4 font-mono text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">No photo? Tap a look — judges score it too</p>
        <div className="-mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 pb-1">
          {RUNWAY_SAMPLES.map((smp) => (
            <button
              key={smp.id}
              type="button"
              onClick={() => onPickSample(smp.src)}
              title={smp.label}
              className="group h-20 w-16 shrink-0 snap-start overflow-hidden border border-border bg-card hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={smp.src} alt={smp.label} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
          {OUTFIT_SAMPLES.map((smp) => (
            <button
              key={smp.id}
              type="button"
              onClick={() => onPickSample(smp.src)}
              title={smp.label}
              className="group h-20 w-16 shrink-0 snap-start overflow-hidden border border-border bg-muted hover:border-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={smp.src} alt={smp.label} className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
