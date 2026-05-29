"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Upload,
  Trash2,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ImageIcon,
  GripVertical,
} from "lucide-react";

interface SizeEntry {
  size: string;
  stock: number;
  price: number;
}

interface KitInfo {
  id: string;
  club: string;
  season: string;
  kitType: string;
}

interface Listing {
  id: string;
  curatorSlug: string;
  skuId: string;
  sizes: SizeEntry[];
  photoKeys: string[];
  status: "live" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
  kit: KitInfo;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_OPTIONS: Array<{ value: Listing["status"]; label: string }> = [
  { value: "live", label: "Live" },
  { value: "paused", label: "Hidden" },
  { value: "archived", label: "Archived" },
];

export default function ListingDetailPage({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = use(params);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Editable fields
  const [sizes, setSizes] = useState<SizeEntry[]>([]);
  const [status, setStatus] = useState<Listing["status"]>("live");
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  // ── Fetch listing data ─────────────────────────────────────
  const fetchListing = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/listings/${encodeURIComponent(id)}`,
      );
      if (!res.ok) throw new Error(`Failed: ${res.status}`);
      const data = await res.json();
      if (!data.listing) throw new Error("Listing not found");
      const found = data.listing;
      setListing(found);
      setSizes(found.sizes || []);
      setStatus(found.status);
      setPhotoKeys(found.photoKeys || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load listing");
    } finally {
      setLoading(false);
    }
  }, [slug, id]);

  useEffect(() => {
    fetchListing();
  }, [fetchListing]);

  // ── Save listing changes ───────────────────────────────────
  const handleSave = async (updatedPhotoKeys?: string[]) => {
    try {
      setSaving(true);
      setError(null);

      const body: Record<string, unknown> = { sizes, status };
      if (updatedPhotoKeys !== undefined) {
        body.photoKeys = updatedPhotoKeys;
      }

      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/listings/${id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Server error: ${res.status}`);
      }

      if (updatedPhotoKeys !== undefined) {
        setPhotoKeys(updatedPhotoKeys);
      }

      setSuccessMsg("Listing updated");
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  // ── Delete photo with inline confirmation ──────────────────
  const confirmDeletePhoto = async () => {
    if (!deletingKey) return;

    try {
      setError(null);

      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/listings/${id}/photos`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoKey: deletingKey }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Delete failed: ${res.status}`);
      }

      setDeletingKey(null);
      await fetchListing();
      setSuccessMsg("Photo removed");
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete photo");
      setDeletingKey(null);
    }
  };

  // ── Drag-and-drop reorder ──────────────────────────────────
  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const handleDrop = async (dropIndex: number) => {
    const fromIndex = dragIndex;
    setDragIndex(null);

    if (fromIndex === null || fromIndex === dropIndex) return;

    const reordered = [...photoKeys];
    const [moved] = reordered.splice(fromIndex, 1);
    if (moved === undefined) return;
    reordered.splice(dropIndex, 0, moved);

    setPhotoKeys(reordered);
    await handleSave(reordered);
  };

  // ── Upload photo to R2 via Hetzner ─────────────────────────
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are supported");
      return;
    }

    const MAX_BYTES = 10 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setError(`Image too large: ${(file.size / 1024 / 1024).toFixed(1)}MB. Maximum is 10MB.`);
      return;
    }

    try {
      setUploading(true);
      setError(null);

      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch(
        `/api/admin/proxy/curators/${encodeURIComponent(slug)}/listings/${id}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo: base64 }),
        },
      );

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Upload failed: ${res.status}`);
      }

      await fetchListing();
      setSuccessMsg("Photo uploaded");
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Size management ────────────────────────────────────────
  const addSize = () => {
    setSizes([...sizes, { size: "", stock: 0, price: 0 }]);
  };

  const updateSize = (index: number, field: keyof SizeEntry, value: string | number) => {
    setSizes((prev) =>
      prev.map((item, i) =>
        i !== index
          ? item
          : {
              size: field === "size" ? (value as string) : item.size,
              stock: field === "stock" ? (value as number) : item.stock,
              price: field === "price" ? (value as number) : item.price,
            },
      ),
    );
  };

  const removeSize = (index: number) => {
    setSizes(sizes.filter((_, i) => i !== index));
  };

  const photoUrl = (key: string) => {
    const publicUrl = (typeof process !== "undefined" && process.env.NEXT_PUBLIC_R2_PUBLIC_URL) || "";
    if (!publicUrl) return null;
    return `${publicUrl.replace(/\/$/, "")}/${key}`;
  };

  // ── Render ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !listing) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border p-8 text-center">
        <AlertCircle className="h-10 w-10 text-destructive" />
        <p className="text-sm text-muted-foreground">{error}</p>
        <button
          onClick={fetchListing}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link
          href="/admin/curators"
          className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Curators
        </Link>
        <span>/</span>
        <Link
          href={`/admin/curators/${slug}`}
          className="hover:text-foreground transition-colors"
        >
          {listing.kit.club}
        </Link>
        <span>/</span>
        <Link
          href={`/admin/curators/${slug}/listings`}
          className="hover:text-foreground transition-colors"
        >
          Listings
        </Link>
        <span>/</span>
        <span className="text-foreground truncate max-w-[120px]">
          {listing.kit.kitType}
        </span>
      </div>

      {/* Success toast */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400">
          <CheckCircle2 className="h-4 w-4" />
          {successMsg}
        </div>
      )}

      {/* Error toast */}
      {error && listing && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-400">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column — Photos + Kit info */}
        <div className="space-y-6 lg:col-span-1">
          {/* Kit info card */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-bold">Kit Details</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Club</span>
                <span className="font-medium">{listing.kit.club}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Type</span>
                <span className="font-medium capitalize">{listing.kit.kitType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Season</span>
                <span className="font-medium">{listing.kit.season}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">SKU</span>
                <code className="text-xs">{listing.kit.id}</code>
              </div>
            </div>
          </div>

          {/* Photo grid */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Photos</h2>
              {photoKeys.length > 1 && (
                <span className="text-[10px] text-muted-foreground">
                  Drag to reorder
                </span>
              )}
            </div>

            {photoKeys.length > 0 && (
              <div className="mb-4 grid grid-cols-2 gap-2">
                {photoKeys.map((key, i) => (
                  <div
                    key={key}
                    draggable
                    onDragStart={() => handleDragStart(i)}
                    onDragOver={handleDragOver}
                    onDrop={() => handleDrop(i)}
                    className={`group relative aspect-square overflow-hidden rounded-lg bg-muted transition-shadow ${
                      dragIndex === i
                        ? "opacity-50 ring-2 ring-primary"
                        : "hover:shadow-md"
                    }`}
                  >
                    {/* Delete confirmation overlay */}
                    {deletingKey === key ? (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/70 p-2">
                        <p className="text-center text-xs font-medium text-white">
                          Delete this photo?
                        </p>
                        <div className="flex w-full gap-2 sm:w-auto">
                          <button
                            onClick={confirmDeletePhoto}
                            className="flex-1 sm:flex-none rounded-md bg-red-500 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeletingKey(null)}
                            className="flex-1 sm:flex-none rounded-md bg-white/20 px-4 py-1.5 text-xs font-medium text-white hover:bg-white/30"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {photoUrl(key) ? (
                          <img
                            src={photoUrl(key)!}
                            alt={`Listing photo ${i + 1}`}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = `data:image/svg+xml,${encodeURIComponent(
                                `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#f0f0f0" width="100" height="100"/><text x="50" y="55" text-anchor="middle" fill="#999" font-size="10">Failed</text></svg>`
                              )}`;
                            }}
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-muted">
                            <ImageIcon className="h-6 w-6 text-muted-foreground/40" />
                          </div>
                        )}

                        {/* Drag grip */}
                        <div className="absolute left-1 top-1 rounded-md bg-black/40 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100">
                          <GripVertical className="h-3 w-3" />
                        </div>

                        {/* Hover overlay */}
                        <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 transition-colors group-hover:bg-black/40">
                          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white opacity-0 transition-opacity group-hover:opacity-100">
                            Photo {i + 1}
                          </span>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              setDeletingKey(key);
                            }}
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/80 px-2.5 py-1 text-[10px] font-medium text-white opacity-0 transition-all hover:bg-red-500 group-hover:opacity-100"
                            title="Delete photo"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}

            {photoKeys.length === 0 && (
              <div className="mb-4 flex h-32 items-center justify-center rounded-lg border border-dashed border-border bg-muted/30">
                <div className="text-center">
                  <ImageIcon className="mx-auto h-6 w-6 text-muted-foreground/40" />
                  <p className="mt-1 text-xs text-muted-foreground">No photos yet</p>
                </div>
              </div>
            )}

            {/* Upload button */}
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload photo
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoUpload}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        {/* Right column — Status + Sizes + Save */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status */}
          <div className="rounded-xl border border-border bg-card p-5">
            <h2 className="mb-4 font-bold">Status</h2>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setStatus(opt.value)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                    status === opt.value
                      ? opt.value === "live"
                        ? "border-emerald-500 bg-emerald-500/10 text-emerald-600"
                        : opt.value === "paused"
                          ? "border-amber-500 bg-amber-500/10 text-amber-600"
                          : "border-muted-foreground bg-muted text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.value === "live" ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {status === "live"
                ? "Visible on the storefront and available for purchase."
                : status === "paused"
                  ? "Hidden from the storefront. Customers won't see it."
                  : "Archived. No longer available."}
            </p>
          </div>

          {/* Sizes */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold">Sizes &amp; Pricing</h2>
              <button
                onClick={addSize}
                className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
              >
                + Add size
              </button>
            </div>

            {sizes.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No sizes configured. Add at least one size to make this listing
                available.
              </p>
            ) : (
              <div className="space-y-2">
                {sizes.map((s, i) => (
                  <div
                    key={i}
                    className="flex flex-wrap items-end gap-2 sm:gap-3 rounded-lg border border-border bg-muted/30 p-2.5 sm:p-3"
                  >
                    <div className="w-14 sm:w-16">
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase">
                        Size
                      </label>
                      <input
                        type="text"
                        value={s.size}
                        onChange={(e) => updateSize(i, "size", e.target.value)}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm font-medium focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="M"
                      />
                    </div>
                    <div className="flex-1 min-w-[70px] sm:min-w-[80px]">
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase">
                        Price (KES)
                      </label>
                      <input
                        type="number"
                        value={s.price || ""}
                        onChange={(e) => updateSize(i, "price", parseInt(e.target.value) || 0)}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="2500"
                      />
                    </div>
                    <div className="w-16 sm:w-20">
                      <label className="mb-1 block text-[10px] font-medium text-muted-foreground uppercase">
                        Stock
                      </label>
                      <input
                        type="number"
                        value={s.stock || ""}
                        onChange={(e) => updateSize(i, "stock", parseInt(e.target.value) || 0)}
                        className="w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="4"
                      />
                    </div>
                    <button
                      onClick={() => removeSize(i)}
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                      title="Remove size"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Save + meta */}
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="text-xs text-muted-foreground">
                <p>Created {formatDate(listing.createdAt)}</p>
                <p>Updated {formatDate(listing.updatedAt)}</p>
              </div>
              <button
                onClick={() => handleSave()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Save changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
