import { CANVAS_ITEMS, type FashionItem } from "@onpoint/shared-types";
import { getAgentApi } from "./agent-api";

const STORAGE_KEY = "onpoint:pending-try-on-item";

export interface TryOnSelection {
  id: string;
  name: string;
  description: string;
  price?: number;
  category?: string;
  imageUrl?: string;
  source?: string;
}

interface StorefrontListing {
  id: string;
  imageUrl?: string | null;
  sizes?: Array<{ price?: number | string }>;
  kit?: {
    club?: string;
    season?: string;
    kitType?: string;
  };
}

interface StorefrontResponse {
  curator?: { slug?: string; name?: string };
  listings?: StorefrontListing[];
}

export function fashionItemToTryOnSelection(
  item: FashionItem,
  source = "catalog",
): TryOnSelection {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    price: item.price,
    category: item.category,
    imageUrl: item.productSrc || item.cover,
    source,
  };
}

export function setPendingTryOnSelection(selection: TryOnSelection): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(selection));
}

export function consumePendingTryOnSelection(): TryOnSelection | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(stored) as TryOnSelection;
  } catch {
    return null;
  }
}

export function resolveTryOnSelection(
  itemId: string | null | undefined,
): TryOnSelection | null {
  if (!itemId) return null;

  const item =
    CANVAS_ITEMS.find((candidate) => candidate.id === itemId) ||
    CANVAS_ITEMS.find((candidate) => candidate.slug === itemId);

  return item ? fashionItemToTryOnSelection(item, "deep-link") : null;
}

function lowestListingPrice(listing: StorefrontListing): number | undefined {
  const prices = (listing.sizes || [])
    .map((size) => Number(size.price))
    .filter((price) => Number.isFinite(price) && price > 0);
  return prices.length ? Math.min(...prices) : undefined;
}

export async function resolveStorefrontTryOnSelection(
  curatorSlug: string | null | undefined,
  listingId: string | null | undefined,
): Promise<TryOnSelection | null> {
  if (!curatorSlug || !listingId) return null;

  const storefront = await getAgentApi<StorefrontResponse>(
    `/api/curator/${encodeURIComponent(curatorSlug)}/storefront`,
  );
  const listing = storefront.listings?.find((item) => item.id === listingId);
  if (!listing) return null;

  const kitName = [
    listing.kit?.club,
    listing.kit?.season,
    listing.kit?.kitType,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: listing.id,
    name: kitName || `Storefront item ${listing.id.slice(0, 8)}`,
    description:
      kitName ||
      `A live storefront listing from ${storefront.curator?.name || curatorSlug}.`,
    price: lowestListingPrice(listing),
    category: listing.kit?.kitType || "storefront",
    imageUrl: listing.imageUrl || undefined,
    source: `storefront:${storefront.curator?.slug || curatorSlug}`,
  };
}
