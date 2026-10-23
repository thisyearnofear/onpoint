"use client";

import React from "react";
import Link from "next/link";
import { JudgeAvatar } from "./JudgeAvatar";
import type { StylistPersona } from "@repo/ai-client";

export function JudgePick({
  judges,
  themeId,
}: {
  judges: Array<{ key: StylistPersona; name: string; sample?: string }>;
  themeId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {judges.map((j) => (
        <Link
          key={j.key}
          href={`/runway/play?judge=${j.key}${themeId ? `&theme=${themeId}` : ""}`}
          className="flex min-h-[88px] items-center gap-4 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4 text-left transition-colors hover:border-primary/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <JudgeAvatar persona={j.key} size="lg" />
          <div className="min-w-0">
            <p className="text-base font-bold text-zinc-50">{j.name}</p>
            {j.sample && <p className="mt-0.5 truncate text-xs text-zinc-400">“{j.sample}”</p>}
          </div>
        </Link>
      ))}
    </div>
  );
}
