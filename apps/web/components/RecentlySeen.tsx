"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const LS_KEY = "onpoint:recent";
const MAX = 8;

interface SeenEntry {
  kind: "card" | "list" | "shop";
  title: string;
  sub?: string | null;
  href: string;
}

export function RecordSeen({ entry }: { entry: SeenEntry }) {
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      const list: SeenEntry[] = raw ? JSON.parse(raw) : [];
      const next = [entry, ...list.filter((e) => e.href !== entry.href)].slice(0, MAX);
      window.localStorage.setItem(LS_KEY, JSON.stringify(next));
    } catch {
      /* private mode */
    }
  }, [entry]);
  return null;
}

export function RecentlySeenStrip() {
  const [items, setItems] = useState<SeenEntry[]>([]);
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LS_KEY);
      if (raw) setItems(JSON.parse(raw));
    } catch {
      /* private mode */
    }
  }, []);
  if (items.length === 0) return null;
  return (
    <div className="mt-8">
      <p className="font-mono text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">
        Recently seen
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((e) => (
          <Link
            key={e.href}
            href={e.href}
            className="inline-flex min-h-10 items-center rounded-full border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-foreground"
          >
            {e.kind === "card" ? "Card · " : e.kind === "list" ? "List · " : ""}{e.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
