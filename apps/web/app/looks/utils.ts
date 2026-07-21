export interface LooksFilters {
  category?: string;
  occasion?: string;
  season?: string;
  sort?: string;
}

export function buildHref(
  current: LooksFilters,
  update: Partial<LooksFilters>,
): string {
  const next = { ...current };
  if (update.category !== undefined) next.category = update.category;
  if (update.occasion !== undefined) next.occasion = update.occasion;
  if (update.season !== undefined) next.season = update.season;
  if (update.sort !== undefined) next.sort = update.sort;

  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.occasion) params.set("occasion", next.occasion);
  if (next.season) params.set("season", next.season);
  if (next.sort && next.sort !== "trending") params.set("sort", next.sort);

  const qs = params.toString();
  return `/looks${qs ? `?${qs}` : ""}`;
}
