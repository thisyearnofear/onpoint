"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Shuffle, X } from "lucide-react";
import { getApiBase } from "@/lib/utils/api-base";

/**
 * When arriving via ?remix=<lookSlug>, show a banner with the source look
 * and a one-tap path to make it yours. Dismissable; logs remix_open.
 */
export function RemixBanner() {
  const [slug, setSlug] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const remix = params.get("remix");
      if (!remix || !/^[a-z0-9-]{2,120}$/.test(remix)) return;
      setSlug(remix);
      void fetch(`${getApiBase()}/api/looks/${encodeURIComponent(remix)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.title) setTitle(data.title);
        })
        .catch(() => undefined);
      void fetch("/api/loop/event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "remix_open", meta: { lookSlug: remix } }),
      }).catch(() => undefined);
    } catch {
      /* ignore */
    }
  }, []);

  if (!slug || dismissed) return null;

  return (
    <div className="mb-4 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/[0.06] px-4 py-3">
      <Shuffle className="h-4 w-4 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm">
        Remixing <span className="font-bold">{title || slug}</span>
        <span className="text-muted-foreground"> — pick the pieces, swap one, share it back.</span>
      </p>
      <Link
        href={`/look/${encodeURIComponent(slug)}`}
        className="shrink-0 rounded-full bg-foreground px-3 py-1.5 text-xs font-bold text-background"
      >
        View source
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss remix"
        className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
