"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { getApiBase } from "@/lib/utils/api-base";
import { LookCard, type LookCardData } from "../LookCard";
import { useFollows } from "./useFollows";

/**
 * "Fresh from your circle" — latest looks from followed curators/agents.
 * Empty state nudges to follow; no follows = 3 most recent live looks.
 */
export function FreshDrops() {
  const { follows } = useFollows();
  const [looks, setLooks] = useState<LookCardData[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const curator = follows.find((f) => f.kind === "curator");
        const qs = curator ? `?curator=${encodeURIComponent(curator.id)}&limit=6` : "?limit=6";
        const res = await fetch(`${getApiBase()}/api/looks${qs}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setLooks((data.looks || []).slice(0, 3));
          setLoaded(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [follows]);

  if (!loaded || looks.length === 0) return null;

  return (
    <section aria-label="Fresh from your circle" className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5" />
          {follows.length > 0 ? "Fresh from your circle" : "Fresh drops"}
        </h2>
        <Link href="/?tab=outfits" className="text-sm font-medium text-foreground/60 hover:text-foreground">
          All looks →
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {looks.map((look) => (
          <LookCard key={look.id} look={look} compact />
        ))}
      </div>
    </section>
  );
}
