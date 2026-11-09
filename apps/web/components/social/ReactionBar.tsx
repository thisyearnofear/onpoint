"use client";

import { useCallback, useEffect, useState } from "react";
import { markFirst } from "./firsts";

const EMOJIS = [
  { emoji: "🔥", label: "need this" },
  { emoji: "😍", label: "love it" },
  { emoji: "💾", label: "save" },
] as const;

function storageKey(targetType: string, targetId: string) {
  return `onpoint:reactions:${targetType}:${targetId}`;
}

function readCounts(targetType: string, targetId: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(`${storageKey(targetType, targetId)}:counts`);
    if (raw) return JSON.parse(raw) as Record<string, number>;
  } catch {
    /* ignore */
  }
  return {};
}

function readMine(targetType: string, targetId: string): Set<string> {
  try {
    const raw = localStorage.getItem(storageKey(targetType, targetId));
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    /* ignore */
  }
  return new Set();
}

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(pattern);
  } catch {
    /* noop */
  }
}

/**
 * One-tap reactions (🔥 need this / 😍 love / 💾 save).
 * Optimistic + localStorage dedupe; server join via /api/loop/event.
 * Works for looks, polaroids, pair cards — anything with a stable id.
 */
export function ReactionBar({
  targetType,
  targetId,
  lookSlug,
  compact = false,
}: {
  targetType: "look" | "polaroid" | "pair" | "card";
  targetId: string;
  /** Real look slug for funnel joins (synthetic p-<id> ok for polaroids). */
  lookSlug?: string | null;
  compact?: boolean;
}) {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCounts(readCounts(targetType, targetId));
    setMine(readMine(targetType, targetId));
  }, [targetType, targetId]);

  const react = useCallback(
    (emoji: string) => {
      if (mine.has(emoji)) return;
      const nextMine = new Set(mine).add(emoji);
      const nextCounts = { ...counts, [emoji]: (counts[emoji] || 0) + 1 };
      setMine(nextMine);
      setCounts(nextCounts);
      try {
        localStorage.setItem(storageKey(targetType, targetId), JSON.stringify([...nextMine]));
        localStorage.setItem(`${storageKey(targetType, targetId)}:counts`, JSON.stringify(nextCounts));
      } catch {
        /* ignore */
      }
      vibrate(10);
      markFirst("vote");
      void fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "reaction",
          meta: { emoji, targetType, targetId, lookSlug: lookSlug || undefined },
        }),
      }).catch(() => undefined);
    },
    [mine, counts, targetType, targetId, lookSlug],
  );

  return (
    <div className={`flex items-center gap-1 ${compact ? "" : "gap-2"}`} role="group" aria-label="React">
      {EMOJIS.map(({ emoji, label }) => {
        const active = mine.has(emoji);
        const count = counts[emoji] || 0;
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              react(emoji);
            }}
            disabled={active}
            aria-label={label}
            aria-pressed={active}
            className={`inline-flex min-h-9 items-center gap-1 rounded-full border px-2.5 text-sm transition-all active:scale-95 ${
              active
                ? "border-primary bg-primary/10 scale-105"
                : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground"
            } ${compact ? "py-1 text-xs" : "py-1.5"}`}
          >
            <span className="leading-none">{emoji}</span>
            {count > 0 && <span className="text-xs font-bold tabular-nums">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
