import type { LookCardData } from "../../components/LookCard";

export function engagementScore(look: LookCardData): number {
  return (
    (look.tryOnCount || 0) * 3 +
    (look.shareCount || 0) * 2 +
    (look.purchaseCount || 0) * 5
  );
}

/** The browse endpoint has no sort param yet, so ranking happens here. */
export function sortLooks(looks: LookCardData[], sort?: string): LookCardData[] {
  const ranked = [...looks];
  if (sort === "newest") {
    return ranked.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }
  return ranked.sort((a, b) => engagementScore(b) - engagementScore(a));
}
