"use client";

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, Check, X } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";

interface StorefrontListing {
  id: string;
  title: string | null;
  inventoryType: string;
  sizes: Array<{ size: string; stock: number; price: number }>;
  kit?: { club: string; kitType: string; season?: string; crestUrl?: string | null } | null;
}

interface CuratorLookCreatorProps {
  curatorSlug: string;
  curatorName: string;
  whatsapp: string;
  listings: StorefrontListing[];
}

export function CuratorLookCreator({
  curatorSlug,
  curatorName,
  whatsapp,
  listings,
}: CuratorLookCreatorProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; slug?: string; error?: string } | null>(null);

  const liveListings = listings.filter((l) => l.inventoryType !== "digital");
  const hasEnough = liveListings.length >= 2;

  if (!hasEnough) return null;

  function toggleListing(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        if (heroId === id) setHeroId(next[0] || null);
        return next;
      }
      const next = [...prev, id];
      if (!heroId) setHeroId(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!title.trim() || selectedIds.length < 2 || !heroId) return;
    setSubmitting(true);
    setResult(null);

    try {
      const res = await fetch(`${getApiBase()}/api/looks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-curator-slug": curatorSlug,
          "x-curator-whatsapp": whatsapp,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          listingIds: selectedIds,
          heroListingId: heroId,
          curatorSlug,
          tags: tags
            .split(",")
            .map((t) => t.trim().toLowerCase())
            .filter(Boolean),
        }),
      });

      const data = await res.json();
      if (res.ok && data.slug) {
        setResult({ ok: true, slug: data.slug });
        setTitle("");
        setDescription("");
        setSelectedIds([]);
        setHeroId(null);
        setTags("");
      } else {
        setResult({ ok: false, error: data.error || "Failed to create look" });
      }
    } catch (err) {
      setResult({ ok: false, error: String(err) });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-border bg-muted/20 p-5">
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <span className="inline-flex items-center gap-2 text-sm font-bold">
          <Sparkles className="h-4 w-4 text-foreground/60" />
          Create a Styled Look
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {!open && (
        <p className="mt-2 text-xs text-muted-foreground">
          Compose your inventory into a shareable style board. Visitors can try on the hero piece and get an Instagram-ready collage card.
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Look title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Weekend Street Fit"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Description (optional)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A relaxed weekend look..."
              rows={2}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Tags (comma-separated)
            </label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="streetwear, casual, summer"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-foreground/20"
            />
          </div>

          {/* Item picker */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Select items ({selectedIds.length} selected) *
            </label>
            <div className="space-y-1.5">
              {liveListings.map((listing) => {
                const selected = selectedIds.includes(listing.id);
                const isHero = heroId === listing.id;
                const label = listing.title || (listing.kit ? `${listing.kit.club} ${listing.kit.kitType}` : "Item");
                return (
                  <div
                    key={listing.id}
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                      selected
                        ? "border-foreground/30 bg-foreground/5"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleListing(listing.id)}
                      className="flex flex-1 items-center gap-2 text-left"
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                          selected ? "border-foreground bg-foreground text-background" : "border-border"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                      </span>
                      <span className="flex-1">{label}</span>
                    </button>
                    {selected && (
                      <button
                        type="button"
                        onClick={() => setHeroId(listing.id)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase transition-colors ${
                          isHero
                            ? "bg-foreground text-background"
                            : "border border-border text-muted-foreground hover:bg-muted"
                        }`}
                      >
                        {isHero ? "Hero" : "Set hero"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Pick at least 2 items. The hero piece gets the try-on render.
            </p>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || selectedIds.length < 2 || !heroId}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2 text-sm font-bold text-background transition-colors hover:bg-foreground/90 disabled:opacity-40"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Create look
                </>
              )}
            </button>
          </div>

          {/* Result */}
          {result && (
            <div
              className={`flex items-start gap-2 rounded-lg p-3 text-sm ${
                result.ok ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-red-500/10 text-red-700 dark:text-red-400"
              }`}
            >
              {result.ok ? (
                <>
                  <Check className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-medium">Look created!</p>
                    <a
                      href={`/look/${result.slug}`}
                      className="text-xs underline"
                    >
                      View at /look/{result.slug}
                    </a>
                  </div>
                </>
              ) : (
                <>
                  <X className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{result.error}</span>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
