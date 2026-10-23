"use client";

import React from "react";
import type { StylistPersona } from "@repo/ai-client";

// Static colour map (Tailwind can't compile dynamic class names). Values
// mirror the persona tokens in lib/utils/persona-config.ts.
const STYLE: Record<string, { bg: string; text: string; letter: string; name: string }> = {
  miranda: { bg: "bg-slate-500/15", text: "text-slate-300", letter: "M", name: "Miranda" },
  edina: { bg: "bg-purple-500/15", text: "text-purple-300", letter: "E", name: "Edina" },
  shaft: { bg: "bg-orange-500/15", text: "text-orange-300", letter: "S", name: "Shaft" },
};

export const JUDGE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE).map(([k, v]) => [k, v.name]),
);

export function judgeDisplayName(key: string): string {
  return STYLE[key]?.name || key.charAt(0).toUpperCase() + key.slice(1);
}

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-xl",
  xl: "h-20 w-20 text-3xl",
} as const;

/** Monogram judge avatar — M/E/S in the persona's colour tokens. */
export function JudgeAvatar({
  persona,
  size = "md",
  className = "",
}: {
  persona: StylistPersona | string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const s = STYLE[persona] || { bg: "bg-zinc-800", text: "text-zinc-300", letter: "?" };
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full font-black ${SIZES[size]} ${s.bg} ${s.text} ${className}`}
    >
      {s.letter}
    </div>
  );
}
