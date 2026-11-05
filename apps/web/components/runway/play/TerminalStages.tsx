import React from "react";
import Link from "next/link";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeBubble } from "./JudgeBubble";

export function CappedStage({ judge, personaName, note }: { judge: StylistPersona; personaName: string; note: string | null }) {
  return (
    <>
      <JudgeBubble persona={judge} name={personaName}>{note}</JudgeBubble>
      <Link href="/runway" className="inline-flex min-h-12 items-center rounded-full border border-border px-6 text-sm font-bold text-foreground hover:border-foreground">
        Back to Runway
      </Link>
    </>
  );
}

export function ErrorStage({ judge, personaName, onRetry }: { judge: StylistPersona; personaName: string; onRetry: () => void }) {
  return (
    <>
      <JudgeBubble persona={judge} name={personaName}>The line went quiet. Try again in a moment.</JudgeBubble>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-sm font-bold text-white hover:bg-primary/90"
      >
        Try again
      </button>
    </>
  );
}
