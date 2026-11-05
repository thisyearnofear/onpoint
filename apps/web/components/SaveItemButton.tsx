"use client";

import { useState } from "react";
import Link from "next/link";
import { Heart } from "lucide-react";

const LS_KEY = "onpoint:wishlist";

export function SaveItemButton({ item }: { item: { listingId: string; curatorSlug: string | null; title: string | null; imageUrl: string | null } }) {
  const [listUrl, setListUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy || listUrl) return;
    setBusy(true);
    try {
      const existing = typeof window !== "undefined" ? window.localStorage.getItem(LS_KEY) : null;
      const body = existing
        ? { listId: existing, item }
        : { kind: "want", items: [item] };
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      const id = data.id || existing;
      const url = data.url || (id ? `/w/${id}` : null);
      if (id && typeof window !== "undefined") window.localStorage.setItem(LS_KEY, id);
      if (url) setListUrl(url);
    } finally {
      setBusy(false);
    }
  };

  if (listUrl) {
    return (
      <Link href={listUrl} className="inline-flex min-h-10 items-center rounded-full border border-success/40 px-4 text-xs font-bold text-success">
        Saved — view your list
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void save()}
      disabled={busy}
      aria-label="Save to your list"
      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-border px-4 text-xs font-bold text-foreground transition-colors hover:border-foreground disabled:opacity-50"
    >
      <Heart className="h-3.5 w-3.5" />
      {busy ? "Saving…" : "Save"}
    </button>
  );
}
