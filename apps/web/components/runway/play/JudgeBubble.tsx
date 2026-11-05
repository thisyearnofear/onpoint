import React from "react";
import type { StylistPersona } from "@repo/ai-client";
import { JudgeAvatar } from "../JudgeAvatar";

export function JudgeBubble({
  persona,
  name,
  showAvatar = true,
  children,
}: {
  persona: StylistPersona;
  name: string;
  showAvatar?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {showAvatar ? <JudgeAvatar persona={persona} size="md" /> : <div className="w-10" />}
      <div className="max-w-md rounded-2xl rounded-tl-sm border border-border bg-card/80 px-4 py-3">
        <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">{name}</p>
        <div className="mt-1 text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}
