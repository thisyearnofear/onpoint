import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ShoppingBag,
  Eye,
  EyeOff,
  Camera,
  ExternalLink,
} from "lucide-react";

interface ListingRow {
  id: string;
  curatorSlug: string;
  skuId: string;
  sizes: Array<{ size: string; stock: number; price: number }>;
  photoKeys: string[];
  status: "live" | "paused" | "archived";
  createdAt: string;
  updatedAt: string;
  kit: {
    id: string;
    club: string;
    season: string;
    kitType: string;
  };
}

async function getListings(slug: string): Promise<ListingRow[]> {
  try {
    const res = await fetch(
      `/api/admin/proxy/curators/${encodeURIComponent(slug)}/listings`,
      { cache: "no-store" },
    );
    if (res.status === 404) return [];
    if (!res.ok) throw new Error(`Failed: ${res.status}`);
    const data = await res.json();
    return data.listings || [];
  } catch {
    return [];
  }
}

async function getCuratorName(slug: string): Promise<string | null> {
  try {
    const res = await fetch(
      `/api/admin/proxy/curators/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.curator?.name || null;
  } catch {
    return null;
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function totalStock(sizes: ListingRow["sizes"]) {
  return sizes.reduce((sum, s) => sum + (s.stock || 0), 0);
}

function minPrice(sizes: ListingRow["sizes"]) {
  if (!sizes.length) return null;
  return Math.min(...sizes.map((s) => s.price));
}

export default async function ListingListPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [listings, curatorName] = await Promise.all([
    getListings(slug),
    getCuratorName(slug),
  ]);

  if (!curatorName) {
    notFound();
  }

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
          {curatorName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Listings</span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Listings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} listing{listings.length !== 1 ? "s" : ""} for{" "}
            {curatorName}
          </p>
        </div>
      </div>

      {/* Empty state */}
      {listings.length === 0 ? (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-6 sm:p-10 text-center">
          {/* Illustration stack */}
          <div className="relative mb-2">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 ring-1 ring-primary/10">
              <ShoppingBag className="h-9 w-9 text-primary/60" />
            </div>
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted ring-2 ring-card">
              <Camera className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>

          <h2 className="mt-3 text-lg font-bold">No listings yet</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Listings appear here when {curatorName} sends photos through
            WhatsApp, or when stock is added via the agent API.
          </p>

          {/* Action links */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={`/admin/curators/${slug}`}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to {curatorName}
            </Link>
          </div>                  <p className="mt-6 sm:mt-8 text-xs text-muted-foreground/60">
            Once a listing is created, you can manage photos, sizes, and
            pricing here.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {listings.map((listing) => {
            const hasPhoto = listing.photoKeys.length > 0;
            const activeSizes = listing.sizes.filter((s) => s.stock > 0);
            const isLive = listing.status === "live";

            return (
              <Link
                key={listing.id}
                href={`/admin/curators/${slug}/listings/${listing.id}`}
                className="group block rounded-xl border border-border bg-card transition-all hover:border-primary/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-4 p-4">
                  {/* Photo preview */}
                  <div className="flex h-16 w-16 sm:h-20 sm:w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {hasPhoto ? (
                      <div className="flex h-full w-full items-center justify-center bg-muted text-xs text-muted-foreground">
                        <Camera className="h-5 w-5" />
                      </div>
                    ) : (
                      <Camera className="h-6 w-6 text-muted-foreground/40" />
                    )}
                  </div>

                  {/* Listing info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold group-hover:text-primary transition-colors">
                          {listing.kit.club}
                        </h3>
                        <p className="text-sm text-muted-foreground capitalize">
                          {listing.kit.kitType} &middot; {listing.kit.season}
                        </p>
                      </div>

                      {/* Status badge */}
                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                            isLive
                              ? "bg-success/10 text-success"
                              : listing.status === "paused"
                                ? "bg-warning/10 text-warning"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {isLive ? (
                            <Eye className="h-3 w-3" />
                          ) : (
                            <EyeOff className="h-3 w-3" />
                          )}
                          {listing.status}
                        </span>
                      </div>
                    </div>

                    {/* Size chips + price */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {listing.sizes.map((s) => (
                        <span
                          key={s.size}
                          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${
                            s.stock > 0
                              ? "border-border text-foreground"
                              : "border-border/50 text-muted-foreground/50 line-through"
                          }`}
                        >
                          {s.size}
                          {s.stock > 0 && (
                            <span className="ml-1 text-[10px] text-muted-foreground">
                              KES {s.price.toLocaleString()}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Meta row */}
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>
                        {activeSizes.length} size
                        {activeSizes.length !== 1 ? "s" : ""} in stock
                      </span>
                      <span>
                        {totalStock(listing.sizes)} units total
                      </span>
                      <span>Updated {formatDate(listing.updatedAt)}</span>
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="hidden shrink-0 items-center self-center sm:flex">
                    <ExternalLink className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
