"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScorePaddles } from "./ScorePaddles";

interface Today {
  theme?: { id: string; name: string; brief: string };
}

/** Homepage teaser band — dark stage, today's theme, mini static paddles. */
export function RunwayTeaser() {
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

  const theme = today?.theme;

  return (
    <section className="dark bg-zinc-950 text-zinc-50">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_65%)]" />
        <div className="container relative mx-auto px-4 py-14 md:py-20">
          <div className="mx-auto grid max-w-5xl items-center gap-10 md:grid-cols-2">
            <div className="text-center md:text-left">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-primary">
                New · Runway
              </p>
              <h2 className="mt-3 text-3xl font-black leading-[1.02] tracking-[-0.04em] md:text-5xl">
                Dress to the theme.
                <span className="block text-primary">You have 3 minutes.</span>
              </h2>
              {theme && (
                <p className="mt-4 text-sm text-zinc-400">
                  Today&rsquo;s theme: <span className="font-bold text-zinc-100">{theme.name}</span>
                </p>
              )}
              <Link
                href="/runway"
                className="mt-7 inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-primary px-7 text-base font-bold text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90"
              >
                Play Runway
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="flex justify-center">
              <ScorePaddles scores={{ theme: 8, cohesion: 7, styling: 6 }} total={7.0} judgeName="Miranda" size="sm" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
