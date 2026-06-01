/**
 * Cross-Curator Recommendation Engine
 *
 * Determines which curators' catalogs complement each other based on
 * vertical compatibility, then returns curated picks with attribution data.
 *
 * Vertical compatibility map:
 *   Sportswear ↔ Streetwear (sneaker/street culture pairing)
 *   Ankara ↔ Tailor (formal African occasion wear)
 *   Vintage ↔ Streetwear (retro streetwear finds)
 *   Luxury ↔ everything (premium accessories pair universally)
 *   Sportswear ↔ Vintage (retro sportswear finds)
 */

/** Which verticals pair well with a given vertical. */
const VERTICAL_COMPAT: Record<string, string[]> = {
  football: ["streetwear", "sneakers", "retro", "vintage"],
  sportswear: ["streetwear", "sneakers", "retro", "vintage"],
  "premier-league": ["streetwear", "sneakers", "retro"],
  streetwear: ["sneakers", "retro", "vintage", "sportswear", "football"],
  sneakers: ["streetwear", "retro", "sportswear"],
  ankara: ["tailoring", "formal", "occasion", "african-print"],
  "african-print": ["ankara", "tailoring", "occasion"],
  occasion: ["ankara", "african-print", "tailoring", "luxury", "high-fashion"],
  vintage: ["retro", "streetwear", "thrift", "sportswear"],
  thrift: ["vintage", "retro", "streetwear"],
  retro: ["vintage", "streetwear", "sportswear", "thrift"],
  tailoring: ["formal", "occasion", "ankara", "luxury"],
  formal: ["tailoring", "occasion", "luxury", "high-fashion"],
  luxury: ["high-fashion", "accessories", "tailoring", "formal", "occasion"],
  "high-fashion": ["luxury", "accessories", "formal", "occasion"],
  accessories: ["luxury", "high-fashion"],
};

export interface CrossCuratorPick {
  listingId: string;
  curatorSlug: string;
  curatorName: string;
  curatorAvatar?: string;
  curatorColor: string;
  itemTitle: string;
  itemSubtitle: string;
  imageUrl: string | null;
  lowestPrice: number | null;
  compatibilityScore: number;
  matchReason: string;
}

/**
 * Compute vertical compatibility score between two curators.
 * Returns 0–100 (higher = more complementary).
 */
export function computeVerticalCompatibility(
  sourceVerticals: string[],
  targetVerticals: string[],
): number {
  if (!sourceVerticals.length || !targetVerticals.length) return 0;

  let totalScore = 0;
  let pairs = 0;

  for (const sv of sourceVerticals) {
    const compatible = VERTICAL_COMPAT[sv] || [];
    for (const tv of targetVerticals) {
      if (compatible.includes(tv)) {
        totalScore += 100;
      } else if (sv === tv) {
        // Same vertical = low complementarity (we want cross-sell, not same-sell)
        totalScore += 10;
      }
      pairs++;
    }
  }

  return pairs === 0 ? 0 : Math.round(totalScore / pairs);
}

/**
 * Generate a human-readable match reason for why this curator's items
 * complement the current storefront.
 */
export function getMatchReason(
  sourceVerticals: string[],
  targetVerticals: string[],
): string {
  const overlaps: string[] = [];
  for (const sv of sourceVerticals) {
    const compatible = VERTICAL_COMPAT[sv] || [];
    for (const tv of targetVerticals) {
      if (compatible.includes(tv) && !overlaps.includes(tv)) {
        overlaps.push(tv);
      }
    }
  }

  if (overlaps.length === 0) return "Curated for your style";

  const primary = overlaps.slice(0, 2).join(" & ");
  return `Pairs well with ${primary}`;
}
