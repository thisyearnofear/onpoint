/**
 * Server-side price verification for M-Pesa payments.
 *
 * The storefront computes `amount` in the browser and posts it. Nothing on the
 * server used to check it, so a tampered request could pay 1 KES for a 3000 KES
 * kit, and because the STK callback compares against that same client-chosen
 * amount, the order would still be confirmed and ledgered. This looks up the
 * real price from the API's public storefront and requires an exact match.
 *
 * Fails CLOSED: if the price cannot be verified, the payment is not started.
 */
import { getApiBase } from "../utils/api-base";

export type PriceCheck =
  | { ok: true; price: number }
  | { ok: false; status: 400 | 404 | 409 | 503; error: string };

interface StorefrontSize {
  size?: unknown;
  stock?: unknown;
  price?: unknown;
}
interface StorefrontListing {
  id?: unknown;
  sizes?: unknown;
}

export async function verifyListingPrice(params: {
  curatorSlug: string;
  listingId: string;
  size: string;
  amount: number;
}): Promise<PriceCheck> {
  const { curatorSlug, listingId, size, amount } = params;

  let res: Response;
  try {
    res = await fetch(
      `${getApiBase()}/api/curator/${encodeURIComponent(curatorSlug)}/storefront`,
      { cache: "no-store", signal: AbortSignal.timeout(5000) },
    );
  } catch {
    return { ok: false, status: 503, error: "Could not verify the price right now. Please try again." };
  }

  if (res.status === 404) return { ok: false, status: 404, error: "Curator not found" };
  if (!res.ok) {
    return { ok: false, status: 503, error: "Could not verify the price right now. Please try again." };
  }

  const data = (await res.json().catch(() => null)) as { listings?: unknown } | null;
  const listings = Array.isArray(data?.listings) ? (data!.listings as StorefrontListing[]) : [];
  const listing = listings.find((l) => l.id === listingId);
  if (!listing) return { ok: false, status: 404, error: "Listing not found" };

  const sizes = Array.isArray(listing.sizes) ? (listing.sizes as StorefrontSize[]) : [];
  const wanted = size.trim().toLowerCase();
  const entry = sizes.find((s) => typeof s.size === "string" && s.size.trim().toLowerCase() === wanted);
  if (!entry) return { ok: false, status: 400, error: "Unknown size for this listing" };

  if (!(Number(entry.stock) > 0)) return { ok: false, status: 409, error: "This size is out of stock" };

  const price = Number(entry.price);
  if (!Number.isFinite(price) || price <= 0) {
    return { ok: false, status: 409, error: "This listing has no valid price" };
  }

  // Payments are whole shillings (see cleanAmount), so compare rounded values.
  if (Math.round(price) !== Math.round(amount)) {
    return { ok: false, status: 409, error: "The amount does not match the listing price. Refresh and try again." };
  }

  return { ok: true, price };
}
