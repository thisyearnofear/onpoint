/**
 * The one grammar for "this artifact can be bought" (ADR 0028): purchase is a
 * verb on an item, never a tab. Two shapes arrive here — a Runway fix, whose
 * URL the server already minted with its attribution params, and a bare
 * (curatorSlug, listingId) pair from a surface that built the link itself.
 *
 * If neither resolves, the door is `/curators` — never a disabled CTA, never a
 * bare link to the mock house catalog.
 */

export type GetItTarget = { label: string; href: string };

export const CURATORS_FALLBACK: GetItTarget = {
  label: "Ask a curator who stocks it",
  href: "/curators",
};

/** Labels keyed by apps/api/lib/runway/fix.js `kind`. Purchasable vs inspiration. */
export const GET_IT_LABELS: Record<string, string> = {
  listing: "Get it",
  look: "Get it",
  inspiration: "Try it on",
};

export function getItTarget(
  fix: { kind?: string; url?: string } | null | undefined,
): GetItTarget {
  const label = fix?.kind ? GET_IT_LABELS[fix.kind] : undefined;
  if (!label || !fix?.url) return CURATORS_FALLBACK;
  return { label, href: fix.url };
}

export function storefrontDoor(
  listing: { curatorSlug?: string | null; listingId?: string | null } | null | undefined,
): GetItTarget {
  if (!listing?.curatorSlug || !listing.listingId) return CURATORS_FALLBACK;
  return {
    label: "Get it",
    href: `/s/${encodeURIComponent(listing.curatorSlug)}?item=${encodeURIComponent(listing.listingId)}`,
  };
}
