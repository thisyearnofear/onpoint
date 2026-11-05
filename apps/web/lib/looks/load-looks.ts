import { getApiBase } from "../utils/api-base";
import type { LookCardData } from "../../components/LookCard";
import { sortLooks } from "./sort";
import { looksQuery, DEFAULT_LIVE_LOOKS_FILTERS, type LiveLooksFilters } from "./params";

/** Server-side looks browse. Client surfaces fetch the same endpoint directly. */
export async function loadLooks(params: Partial<LiveLooksFilters> = {}): Promise<LookCardData[]> {
  const filters = { ...DEFAULT_LIVE_LOOKS_FILTERS, ...params };
  const rows = await fetchLookRows<LookCardData>(looksQuery(filters), { cache: "no-store" });
  return sortLooks(rows, filters.sort);
}

/**
 * Slug + title only, for pages that fill a <select>. Cached separately from the
 * browse above: these pages are served from ISR, so no-store would make them dynamic.
 */
export async function loadLookOptions(
  limit = 20,
): Promise<Array<{ slug: string; title: string }>> {
  const rows = await fetchLookRows<{ slug: string; title?: string }>(`limit=${limit}`, {
    next: { revalidate: 300 },
  });
  return rows
    .slice(0, limit)
    .map((row) => ({ slug: row.slug, title: row.title || row.slug }));
}

async function fetchLookRows<T>(query: string, init: RequestInit): Promise<T[]> {
  try {
    const res = await fetch(`${getApiBase()}/api/looks?${query}`, {
      ...init,
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const rows: T[] = data?.looks || data || [];
    return rows.filter((row) => (row as { slug?: string })?.slug);
  } catch {
    return [];
  }
}
