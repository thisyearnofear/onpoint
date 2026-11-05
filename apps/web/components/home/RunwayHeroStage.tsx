"use client";

import React, { useEffect, useState } from "react";
import { ScorePaddles } from "../runway/ScorePaddles";

interface Today {
  theme?: { id: string; name: string; brief: string };
}

/** Hero visual — the Runway stage: today's theme on a dark card + sample paddles. */
export function RunwayHeroStage() {
  const [today, setToday] = useState<Today | null>(null);
  useEffect(() => {
    let active = true;
    fetch("/api/runway/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.theme) setToday(data);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="dark relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 px-6 py-10 text-zinc-50 shadow-2xl">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.22),transparent_65%)]" />
      <div className="relative text-center">
        <p className="text-xs font-medium text-zinc-400">
          Today&rsquo;s theme
        </p>
        <p className="mt-2 text-3xl font-black tracking-[-0.03em]">
          {today?.theme?.name ?? "Dress to the theme"}
        </p>
        {today?.theme?.brief && (
          <p className="mx-auto mt-2 max-w-xs text-sm text-zinc-400">{today.theme.brief}</p>
        )}
        <div className="mt-8 flex justify-center">
          <ScorePaddles scores={{ theme: 8, cohesion: 7, styling: 6 }} total={7.0} judgeName="Miranda" size="sm" />
        </div>
      </div>
    </div>
  );
}
