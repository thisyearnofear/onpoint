"use client";

import Link from "next/link";
import { Heart, Shuffle, Sparkles, Users } from "lucide-react";
import { useState } from "react";
import { celebrateFirst } from "./firsts";

function vibrate(p: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(p);
  } catch {
    /* noop */
  }
}

/**
 * Post-try-on rail: every render ends with 4 forward paths, zero dead ends.
 * Challenge a friend (pair) · Remix · Save · Styled 3 ways.
 */
export function TryOnActionRail({
  curatorSlug,
  listingId,
  lookSlug,
  itemTitle,
  imageUrl,
}: {
  curatorSlug: string;
  listingId: string;
  lookSlug?: string | null;
  itemTitle?: string | null;
  imageUrl?: string | null;
}) {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (saving || saved) return;
    setSaving(true);
    try {
      const existing = typeof window !== "undefined" ? window.localStorage.getItem("onpoint:wishlist") : null;
      const body = existing
        ? {
            listId: existing,
            item: { listingId, curatorSlug, title: itemTitle || null, imageUrl: imageUrl || null },
          }
        : {
            kind: "want",
            items: [{ listingId, curatorSlug, title: itemTitle || null, imageUrl: imageUrl || null }],
          };
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.id && typeof window !== "undefined") {
          try {
            window.localStorage.setItem("onpoint:wishlist", data.id);
          } catch {
            /* ignore */
          }
        }
        setSaved(true);
        vibrate(10);
        celebrateFirst("save");
        void fetch("/api/loop/event", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "closet_add", meta: { listingId, curatorSlug } }),
        }).catch(() => undefined);
      }
    } finally {
      setSaving(false);
    }
  };

  const remixHref = lookSlug
    ? `/?tab=outfits&remix=${encodeURIComponent(lookSlug)}`
    : `/s/${encodeURIComponent(curatorSlug)}?item=${encodeURIComponent(listingId)}`;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-muted/20 p-4">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        Looking good — what&apos;s next?
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          href={`/pair?item=${encodeURIComponent(listingId)}&from=${encodeURIComponent(curatorSlug)}`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-3 text-xs font-bold text-background transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Users className="h-4 w-4" />
          Challenge a friend
        </Link>
        <Link
          href={remixHref}            onClick={() => {
              celebrateFirst("remix");
            void fetch("/api/loop/event", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "remix_open", meta: { lookSlug: lookSlug || null, listingId } }),
            }).catch(() => undefined);
          }}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Shuffle className="h-4 w-4" />
          Remix this fit
        </Link>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || saved}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95 disabled:opacity-60"
        >
          <Heart className={`h-4 w-4 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
          {saved ? "Saved ✓" : saving ? "Saving…" : "Save it"}
        </button>
        <Link
          href={`/s/${encodeURIComponent(curatorSlug)}?item=${encodeURIComponent(listingId)}#styled`}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 text-xs font-bold transition-transform hover:scale-[1.02] active:scale-95"
        >
          <Sparkles className="h-4 w-4" />
          Styled 3 ways
        </Link>
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">
        Duo cards share double — both links earn.
      </p>
    </div>
  );
}
