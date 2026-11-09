"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Vote } from "lucide-react";
import { SafeImage } from "../SafeImage";
import { celebrateFirst } from "./firsts";

export interface FaceoffOption {
  slug: string;
  title: string;
  imageUrl: string | null;
}

/**
 * Embedded "which styling?" vote. Votes post to /api/loop/event as
 * mini_faceoff_vote (client-optimistic, no auth wall).
 */
export function MiniFaceoff({ lookSlug, a, b }: { lookSlug: string; a: FaceoffOption; b: FaceoffOption }) {
  const [voted, setVoted] = useState<string | null>(() => {
    try {
      return localStorage.getItem(`onpoint:faceoff:${lookSlug}`);
    } catch {
      return null;
    }
  });
  const [counts, setCounts] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(`onpoint:faceoff:${lookSlug}:counts`);
      if (raw) return JSON.parse(raw) as Record<string, number>;
    } catch {
      /* ignore */
    }
    return {};
  });

  const vote = (slug: string) => {
    if (voted) return;
    setVoted(slug);
    const next = { ...counts, [slug]: (counts[slug] || 0) + 1 };
    setCounts(next);
    try {
      localStorage.setItem(`onpoint:faceoff:${lookSlug}`, slug);
      localStorage.setItem(`onpoint:faceoff:${lookSlug}:counts`, JSON.stringify(next));
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(12);
    } catch {
      /* ignore */
    }
    celebrateFirst("vote");
    void fetch("/api/loop/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "mini_faceoff_vote", meta: { lookSlug, pick: slug, a: a.slug, b: b.slug } }),
    }).catch(() => undefined);
  };

  const total = (counts[a.slug] || 0) + (counts[b.slug] || 0);
  const pct = (s: string) => (total > 0 ? Math.round(((counts[s] || 0) / total) * 100) : 50);

  return (
    <div className="mt-8 rounded-2xl border border-primary/20 bg-primary/[0.04] p-4">
      <p className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.18em] text-primary">
        <Vote className="h-3.5 w-3.5" />
        Which styling wins?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {[a, b].map((opt) => (
          <button
            key={opt.slug}
            type="button"
            onClick={() => vote(opt.slug)}
            disabled={Boolean(voted)}
            className={`overflow-hidden rounded-xl border-2 text-left transition-all active:scale-[0.98] ${
              voted
                ? voted === opt.slug
                  ? "border-green-500/60"
                  : "border-border opacity-70"
                : "border-border hover:border-primary/50"
            }`}
          >
            <div className="relative aspect-square bg-muted">
              <SafeImage sources={[opt.imageUrl]} alt={opt.title} fill unoptimized className="object-cover" />
            </div>
            <div className="bg-background px-2.5 py-2">
              <p className="truncate text-xs font-bold">{opt.title}</p>
              {voted && (
                <div className="mt-1.5">
                  <div className="flex justify-between text-[11px] font-bold">
                    <span>{pct(opt.slug)}%</span>
                    <span className="text-muted-foreground">{counts[opt.slug] || 0} votes</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={`h-full rounded-full ${voted === opt.slug ? "bg-green-500" : "bg-muted-foreground/40"}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct(opt.slug)}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
      {!voted && <p className="mt-2 text-center text-[11px] text-muted-foreground">Tap to vote — no sign-in needed.</p>}
    </div>
  );
}
