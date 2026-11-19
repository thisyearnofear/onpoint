import React from "react";
import type { StylistPersona } from "@repo/ai-client";

// Static colour map (Tailwind can't compile dynamic class names). Values
// mirror the persona tokens in lib/utils/persona-config.ts.
const STYLE: Record<string, { bg: string; text: string; letter: string; name: string; img?: string }> = {
  miranda: { bg: "bg-slate-500/15", text: "text-slate-700 dark:text-slate-300", letter: "M", name: "Miranda", img: "/judges/miranda.webp" },
  edina: { bg: "bg-purple-500/15", text: "text-purple-700 dark:text-purple-300", letter: "E", name: "Edina", img: "/judges/edina.webp" },
  shaft: { bg: "bg-orange-500/15", text: "text-orange-700 dark:text-orange-300", letter: "S", name: "Shaft", img: "/judges/shaft.webp" },
  luxury: { bg: "bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", letter: "L", name: "Anna", img: "/judges/luxury.webp" },
  streetwear: { bg: "bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", letter: "V", name: "Virgil", img: "/judges/streetwear.webp" },
  sustainable: { bg: "bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", letter: "S", name: "Stella", img: "/judges/sustainable.webp" },
};

export const JUDGE_NAMES: Record<string, string> = Object.fromEntries(
  Object.entries(STYLE).map(([k, v]) => [k, v.name]),
);

export function judgeDisplayName(key: string): string {
  return STYLE[key]?.name || key.charAt(0).toUpperCase() + key.slice(1);
}

const SIZES = {
  xs: "h-6 w-6 text-xs",
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
  const s = STYLE[persona] || { bg: "bg-muted", text: "text-muted-foreground", letter: "?" };
  return (
    <div
      aria-hidden
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full font-black ${SIZES[size]} ${s.bg} ${s.text} ${className}`}
    >
      {s.img ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny static portraits; next/image adds no value at avatar sizes
        <img src={s.img} alt="" className="h-full w-full object-cover object-[50%_18%]" />
      ) : (
        s.letter
      )}
    </div>
  );
}
