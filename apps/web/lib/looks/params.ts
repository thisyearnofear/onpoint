export interface LiveLooksFilters {
  category: string;
  occasion: string;
  season: string;
  sort: string;
  curator: string;
  tag: string;
}

export const DEFAULT_LIVE_LOOKS_FILTERS: LiveLooksFilters = {
  category: "",
  occasion: "",
  season: "",
  sort: "trending",
  curator: "",
  tag: "",
};

const FILTER_KEYS = ["category", "occasion", "season", "sort", "curator", "tag"] as const;

function toSearchParams(source: string | URLSearchParams): URLSearchParams {
  return typeof source === "string" ? new URLSearchParams(source) : new URLSearchParams(source);
}

export function readLiveLooksFilters(source: string | URLSearchParams): LiveLooksFilters {
  const params = toSearchParams(source);
  return {
    category: params.get("category") ?? "",
    occasion: params.get("occasion") ?? "",
    season: params.get("season") ?? "",
    sort: params.get("sort") ?? "trending",
    curator: params.get("curator") ?? "",
    tag: params.get("tag") ?? "",
  };
}

export function hasActiveLooksFilters(filters: LiveLooksFilters): boolean {
  return FILTER_KEYS.some((key) => key !== "sort" && filters[key]);
}

/**
 * Keeps every param the look browser does not own — pick, sid, utm_source, from,
 * theme, judge — so filtering a Runway or share deep link never drops its context.
 */
export function buildOutfitsHref(
  filters: LiveLooksFilters,
  current: string | URLSearchParams,
): string {
  const params = toSearchParams(current);
  for (const key of FILTER_KEYS) params.delete(key);
  params.set("tab", "outfits");
  if (filters.category) params.set("category", filters.category);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.season) params.set("season", filters.season);
  if (filters.curator) params.set("curator", filters.curator);
  if (filters.tag) params.set("tag", filters.tag);
  if (filters.sort && filters.sort !== "trending") params.set("sort", filters.sort);

  const qs = params.toString();
  return qs ? `/?${qs}` : "/?tab=outfits";
}

/** Query string for the looks browse endpoint. Empty filters are omitted. */
export function looksQuery(filters: LiveLooksFilters, limit = 48): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (filters.category) params.set("category", filters.category);
  if (filters.occasion) params.set("occasion", filters.occasion);
  if (filters.season) params.set("season", filters.season);
  if (filters.curator) params.set("curator", filters.curator);
  if (filters.tag) params.set("tag", filters.tag);
  return params.toString();
}
