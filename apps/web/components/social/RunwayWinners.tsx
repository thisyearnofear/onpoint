"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Crown, Timer } from "lucide-react";

interface LoopCard {
  id: string;
  cardUrl: string;
  theme: string | null;
  senderName: string | null;
  createdAt: string;
}

interface Today {
  theme?: { id: string; name: string; brief: string };
}

/** Seconds until next Monday 00:00 local (weekly ritual reset). */
function secondsToMonday(): number {
  const now = new Date();
  const next = new Date(now);
  next.setDate(now.getDate() + ((8 - now.getDay()) % 7 || 7));
  next.setHours(0, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

function fmtCountdown(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return d > 0 ? `${d}d ${h}h left` : `${h}h left`;
}

/**
 * Weekly Runway ritual: today's theme + countdown + recent winners rail.
 * Winners are recent public cards (the feed that already exists).
 */
export function RunwayWinners() {
  const [today, setToday] = useState<Today | null>(null);
  const [cards, setCards] = useState<LoopCard[]>([]);
  const [countdown, setCountdown] = useState("--");

  useEffect(() => {
    let active = true;
    fetch("/api/runway/today")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && data?.theme) setToday(data);
      })
      .catch(() => undefined);
    fetch("/api/loop/cards?limit=6")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (active && Array.isArray(data?.cards)) setCards(data.cards);
      })
      .catch(() => undefined);
    setCountdown(fmtCountdown(secondsToMonday()));
    const t = setInterval(() => setCountdown(fmtCountdown(secondsToMonday())), 60000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  return (
    <section aria-label="Runway this week" className="mt-10 rounded-2xl border border-primary/20 bg-primary/[0.04] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="inline-flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.22em] text-primary">
          <Crown className="h-3.5 w-3.5" />
          Runway · weekly ritual
        </p>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Timer className="h-3.5 w-3.5" />
          {countdown}
        </span>
      </div>
      {today?.theme && (
        <p className="mt-2 text-sm">
          This week: <span className="font-bold">{today.theme.name}</span>
          <span className="text-muted-foreground"> — {today.theme.brief}</span>
        </p>
      )}
      {cards.length > 0 ? (
        <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
          {cards.map((c) => (
            <a
              key={c.id}
              href={c.cardUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-xl border border-border bg-muted transition-transform hover:scale-[1.03] active:scale-95"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.cardUrl} alt={c.theme || "Runway winner"} className="aspect-square w-full object-cover" loading="lazy" />
              <p className="truncate px-1.5 py-1 text-[11px] font-medium">{c.senderName || c.theme || "Winner"}</p>
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">
          No winners yet this week — play Runway and take the crown.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href="/runway"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-primary px-5 text-xs font-bold text-white transition-transform hover:scale-[1.02] active:scale-95"
        >
          Play this week&apos;s theme
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <Link
          href="/runway/play"
          className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-border px-5 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
        >
          Quick play (3 min)
        </Link>
      </div>
    </section>
  );
}
