/**
 * High-level looks SDK for agent-core.
 *
 * Thin wrappers around the /api/looks endpoints. All functions use the
 * existing agent-api.ts HTTP wrappers (getAgentApi / postAgentApi /
 * patchAgentApi / fetchAgentApi) so they respect the same
 * NEXT_PUBLIC_AGENT_API_URL configuration and default headers.
 *
 * Auth-required endpoints (createLook, updateLook, deleteLook) expect the
 * caller to have configured auth headers on the agent-api client
 * (x-agent-address, or x-curator-slug + x-curator-whatsapp). The public
 * endpoints (browseLooks, getLook, classifyLook, regenerateCollage) need
 * no auth.
 */

import {
  getAgentApi,
  postAgentApi,
  patchAgentApi,
  fetchAgentApi,
} from "./agent-api";

// ── Types ────────────────────────────────────────────────────────

export interface LookListItem {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  curatorSlug: string | null;
  coverImageUrl: string | null;
  collageUrl: string | null;
  heroImageUrl: string | null;
  tags: string[];
  metadata: { category?: string; occasion?: string; season?: string };
  tryOnCount: number;
  shareCount: number;
  itemCount: number;
  createdAt: string;
}

export interface LookItem {
  id: string;
  title: string;
  curatorSlug: string;
  imageUrl: string | null;
  isHero: boolean;
  sizes: Array<{ size: string; stock: number; price: number }>;
  kit?: { club: string; kitType: string; brand?: string } | null;
}

export interface LookDetail extends LookListItem {
  items: LookItem[];
  agentAddress: string;
  referralCode: string;
  shareUrl: string;
}

export interface BrowseLooksOptions {
  curator?: string;
  tag?: string;
  agent?: string;
  category?: string;
  occasion?: string;
  season?: string;
  limit?: number;
}

export interface CreateLookOptions {
  title: string;
  description?: string;
  listingIds: string[];
  heroListingId?: string;
  tags?: string[];
  coverImage?: string; // data:image/jpeg;base64,...
  status?: "live" | "draft";
  curatorSlug?: string; // required for curator auth
}

export interface UpdateLookOptions {
  title?: string;
  description?: string;
  tags?: string[];
  status?: "live" | "paused" | "archived" | "draft";
}

export interface ClassifyLookResult {
  success: boolean;
  metadata: { category: string; occasion: string; season: string };
}

export interface RegenerateCollageResult {
  r2Key: string;
  url: string;
  tier: 1 | 2;
}

// ── Helpers ──────────────────────────────────────────────────────

/**
 * Build a query string from a partial record, skipping undefined/null
 * values. Returns "" when no params are present (no leading "?").
 */
function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of entries) usp.set(k, String(v));
  return `?${usp.toString()}`;
}

// ── API functions ────────────────────────────────────────────────

/**
 * Browse live looks with optional filters.
 * GET /api/looks
 *
 * Public endpoint — no auth required.
 */
export async function browseLooks(
  opts: BrowseLooksOptions = {},
): Promise<LookListItem[]> {
  const qs = buildQuery({
    curator: opts.curator,
    tag: opts.tag,
    agent: opts.agent,
    category: opts.category,
    occasion: opts.occasion,
    season: opts.season,
    limit: opts.limit,
  });
  const data = await getAgentApi<{ looks: LookListItem[]; count: number }>(
    `/api/looks${qs}`,
  );
  return data.looks;
}

/**
 * Get a single look with resolved listings.
 * GET /api/looks/:slug
 *
 * Public endpoint — no auth required. Only live looks are returned.
 */
export async function getLook(slug: string): Promise<LookDetail> {
  return getAgentApi<LookDetail>(`/api/looks/${encodeURIComponent(slug)}`);
}

/**
 * Create a new look.
 * POST /api/looks
 *
 * Requires auth headers set on the agent-api client:
 *   - Agent:  x-agent-address
 *   - Curator: x-curator-slug + x-curator-whatsapp
 */
export async function createLook(
  opts: CreateLookOptions,
): Promise<{ id: string; slug: string }> {
  const body = {
    title: opts.title,
    description: opts.description,
    listingIds: opts.listingIds,
    heroListingId: opts.heroListingId,
    tags: opts.tags,
    coverImage: opts.coverImage,
    status: opts.status,
    curatorSlug: opts.curatorSlug,
  };
  const look = await postAgentApi<
    { id: string; slug: string },
    typeof body
  >(`/api/looks`, body);
  return { id: look.id, slug: look.slug };
}

/**
 * Update a look (title, description, tags, status).
 * PATCH /api/looks/:slug
 *
 * Requires auth headers set on the agent-api client (creator only).
 */
export async function updateLook(
  slug: string,
  updates: UpdateLookOptions,
): Promise<LookDetail> {
  return patchAgentApi<LookDetail, UpdateLookOptions>(
    `/api/looks/${encodeURIComponent(slug)}`,
    updates,
  );
}

/**
 * Delete a look.
 * DELETE /api/looks/:slug
 *
 * Requires auth headers set on the agent-api client (creator only).
 * Uses fetchAgentApi directly because agent-api.ts has no typed DELETE
 * wrapper.
 */
export async function deleteLook(slug: string): Promise<{ ok: boolean }> {
  const response = await fetchAgentApi(
    `/api/looks/${encodeURIComponent(slug)}`,
    { method: "DELETE" },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  const data = await response.json();
  return { ok: Boolean(data?.success) };
}

/**
 * Reclassify a look's metadata (category, occasion, season).
 * POST /api/looks/:slug/classify
 *
 * Public endpoint — no auth required.
 */
export async function classifyLook(
  slug: string,
): Promise<ClassifyLookResult> {
  return postAgentApi<ClassifyLookResult, undefined>(
    `/api/looks/${encodeURIComponent(slug)}/classify`,
  );
}

/**
 * Regenerate a look's collage image.
 * POST /api/looks/:slug/collage
 *
 * Public endpoint — no auth required. Returns the R2 key, public URL,
 * and the tier used (1 = deterministic sharp, 2 = AI Qwen Cloud).
 */
export async function regenerateCollage(
  slug: string,
): Promise<RegenerateCollageResult> {
  const data = await postAgentApi<{
    success: boolean;
    collageUrl: string;
    r2Key: string;
    tier: 1 | 2;
  }, undefined>(`/api/looks/${encodeURIComponent(slug)}/collage`);
  return { r2Key: data.r2Key, url: data.collageUrl, tier: data.tier };
}
