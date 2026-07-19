"use client";

import { useState, useEffect, useRef } from "react";
import { Sparkles, ChevronDown, ChevronUp, Loader2, Check, X, Upload, ImageIcon } from "lucide-react";
import { getApiBase } from "../../lib/utils/api-base";
import { SafeImage } from "../SafeImage";

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
  /** When provided, the component operates in edit mode for this look */
  editSlug?: string;
}

export function CuratorLookCreator({
  curatorSlug,
  curatorName,
  whatsapp,
  listings,
  editSlug,
}: CuratorLookCreatorProps) {
  const isEditMode = Boolean(editSlug);
  const [open, setOpen] = useState(isEditMode);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [heroId, setHeroId] = useState<string | null>(null);
  const [tags, setTags] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [existingCoverUrl, setExistingCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; slug?: string; error?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const liveListings = listings.filter((l) => l.inventoryType !== "digital");
  const hasEnough = liveListings.length >= 2;

  // Filter listings by search query (title or kit club)
  const filteredListings = itemSearch.trim()
    ? liveListings.filter((l) => {
        const q = itemSearch.toLowerCase();
        const title = (l.title || "").toLowerCase();
        const club = (l.kit?.club || "").toLowerCase();
        const kitType = (l.kit?.kitType || "").toLowerCase();
        return title.includes(q) || club.includes(q) || kitType.includes(q);
      })
    : liveListings;

  // ── Edit mode: fetch existing look and pre-fill the form ──
  useEffect(() => {
    if (!editSlug) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`${getApiBase()}/api/looks/${editSlug}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data) {
          setTitle(data.title || "");
          setDescription(data.description || "");
          setSelectedIds(data.listingIds || []);
          setHeroId(data.heroListingId || (data.listingIds?.[0] ?? null));
          setTags(Array.isArray(data.tags) ? data.tags.join(", ") : "");
          setExistingCoverUrl(data.coverImageUrl || null);
          setOpen(true);
        } else {
          setResult({ ok: false, error: data.error || "Failed to load look" });
        }
      } catch (err) {
        if (!cancelled) setResult({ ok: false, error: String(err) });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editSlug]);

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

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCoverImage(typeof reader.result === "string" ? reader.result : null);
    };
    reader.readAsDataURL(file);
  }

  function clearCoverImage() {
    setCoverImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const parsedTags = tags
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  // ── Preview data: build a LookCard-like preview from current form state ──
  const heroListing = liveListings.find((l) => l.id === heroId) || liveListings.find((l) => selectedIds.includes(l.id));
  const heroImageUrl = heroListing?.kit?.crestUrl || null;
  const previewImageSources = [
    coverImage,
    existingCoverUrl,
    heroImageUrl,
  ];

  async function handleSubmit() {
    if (!title.trim() || selectedIds.length < 2 || !heroId) return;
    setSubmitting(true);
    setResult(null);

    const authHeaders = {
      "x-curator-slug": curatorSlug,
      "x-curator-whatsapp": whatsapp,
    };

    try {
      if (isEditMode && editSlug) {
        // ── Edit mode: PATCH then optionally upload cover image ──
        const res = await fetch(`${getApiBase()}/api/looks/${editSlug}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            tags: parsedTags,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setResult({ ok: false, error: data.error || "Failed to update look" });
          return;
        }

        // Upload cover image if a new one was selected
        if (coverImage) {
          const imgRes = await fetch(`${getApiBase()}/api/looks/${editSlug}/image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders,
            },
            body: JSON.stringify({ image: coverImage }),
          });
          if (!imgRes.ok) {
            const imgData = await imgRes.json().catch(() => ({}));
            setResult({ ok: false, error: imgData.error || "Look updated but cover image upload failed" });
            return;
          }
        }

        setResult({ ok: true, slug: editSlug });
        setCoverImage(null);
        setExistingCoverUrl(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } else {
        // ── Create mode: POST with optional coverImage in body ──
        const res = await fetch(`${getApiBase()}/api/looks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders,
          },
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            listingIds: selectedIds,
            heroListingId: heroId,
            curatorSlug,
            tags: parsedTags,
            coverImage: coverImage || undefined,
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
          setCoverImage(null);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } else {
          setResult({ ok: false, error: data.error || "Failed to create look" });
        }
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
          {isEditMode ? "Edit Styled Look" : "Create a Styled Look"}
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
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading look...
            </div>
          )}

          {!loading && (
            <>
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

              {/* Cover image upload */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Cover image (optional)
                </label>
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                    {coverImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImage}
                        alt="Cover preview"
                        className="h-full w-full object-cover"
                      />
                    ) : existingCoverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={existingCoverUrl}
                        alt="Current cover"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center">
                        <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {coverImage || existingCoverUrl ? "Change image" : "Upload image"}
                    </button>
                    {(coverImage || existingCoverUrl) && (
                      <button
                        type="button"
                        onClick={clearCoverImage}
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" />
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {isEditMode
                    ? "Upload a new image to replace the current cover."
                    : "Shown as the card image on the /looks page (overrides the hero item image)."}
                </p>
              </div>

              {/* Item picker */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Select items ({selectedIds.length} selected) *
                </label>
                {liveListings.length > 5 && (
                  <input
                    type="text"
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    placeholder="Search items..."
                    className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
                  />
                )}
                <div className="space-y-1.5">
                  {filteredListings.map((listing) => {
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
                  {filteredListings.length === 0 && (
                    <p className="py-2 text-xs text-muted-foreground">
                      No items match &ldquo;{itemSearch}&rdquo;
                    </p>
                  )}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  Pick at least 2 items. The hero piece gets the try-on render.
                </p>
              </div>

              {/* Live preview */}
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Preview
                </label>
                <div className="mx-auto max-w-[220px] overflow-hidden rounded-2xl border border-border">
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    <SafeImage
                      sources={previewImageSources}
                      alt={title.trim() || "Look preview"}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                  <div className="space-y-2 p-3">
                    <div>
                      <h3 className="text-sm font-bold leading-tight">
                        {title.trim() || "Untitled look"}
                      </h3>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Styled by {curatorName || curatorSlug} · {selectedIds.length} pieces
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {parsedTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
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
                      {isEditMode ? "Updating..." : "Creating..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      {isEditMode ? "Update Look" : "Create look"}
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
                        <p className="font-medium">
                          {isEditMode ? "Look updated!" : "Look created!"}
                        </p>
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
            </>
          )}
        </div>
      )}
    </div>
  );
}
