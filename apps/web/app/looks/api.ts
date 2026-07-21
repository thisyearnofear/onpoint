import { getApiBase } from "../../lib/utils/api-base";
import type { LookCardData } from "../../components/LookCard";

export interface LoadLooksParams {
  tag?: string;
  category?: string;
  occasion?: string;
  season?: string;
  sort?: string;
}

function engagementScore(look: LookCardData): number {
  return (
    (look.tryOnCount || 0) * 3 +
    (look.shareCount || 0) * 2 +
    (look.purchaseCount || 0) * 5
  );
}

export async function loadLooks(params: LoadLooksParams): Promise<LookCardData[]> {
  try {
    const qs = new URLSearchParams({ limit: "48" });
    if (params.tag) qs.set("tag", params.tag);
    if (params.category) qs.set("category", params.category);
    if (params.occasion) qs.set("occasion", params.occasion);
    if (params.season) qs.set("season", params.season);

    const res = await fetch(`${getApiBase()}/api/looks?${qs}`, {
      cache: "no-store",
    });
    if (!res.ok) return [];

    const data = await res.json();
    const looks: LookCardData[] = data.looks || [];

    // Client-side sort because the browse endpoint does not yet support it.
    const sort = params.sort || "trending";
    if (sort === "newest") {
      return looks.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    }

    return looks.sort((a, b) => engagementScore(b) - engagementScore(a));
  } catch {
    return [];
  }
}
