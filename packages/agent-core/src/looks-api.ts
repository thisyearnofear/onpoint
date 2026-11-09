/**
 * High-level looks SDK for agent-core.
 *
 * Thin wrappers around the /api/looks endpoints. All functions use the
 * existing agent-api.ts HTTP wrappers (getAgentApi / postAgentApi /
 * patchAgentApi / fetchAgentApi) so they respect the same
 * NEXT_PUBLIC_AGENT_API_URL configuration and default headers.
 *
 * Auth-required endpoints (createLook, updateLook, deleteLook) require a
 * signature-verified session token from POST /api/auth/challenge +
 * POST /api/auth/verify, sent as `Authorization: Bearer <token>` (plus
 * `x-curator-slug` for curator-scoped writes). A bare `x-agent-address`
 * header and plaintext `x-curator-whatsapp` are no longer accepted for
 * writes. The public endpoints (browseLooks, getLook, classifyLook,
 * regenerateCollage) need no auth.
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

export interface LookAuth {
  /** Bearer session token from POST /api/auth/verify. */
  token?: string;
  /** Curator context for curator-scoped writes. */
  curatorSlug?: string;
}

function lookAuthHeaders(auth?: LookAuth): Record<string, string> {
  const headers: Record<string, string> = {};
  if (auth?.token) headers.Authorization = `Bearer ${auth.token}`;
  if (auth?.curatorSlug) headers["x-curator-slug"] = auth.curatorSlug;
  return headers;
}

/**
 * Create a new look.
 * POST /api/looks
 *
 * Requires a session token: POST /api/auth/challenge { address } → sign
 * `message` with the wallet → POST /api/auth/verify { address, signature }
 * → `token`. Pass it as `auth.token` (plus `auth.curatorSlug` or
 * `opts.curatorSlug` for curator-scoped writes).
 */
export async function createLook(
  opts: CreateLookOptions,
  auth?: LookAuth,
): Promise<{ id: string; slug: string }> {
  const body = {
    title: opts.title,
    description: opts.description,
    listingIds: opts.listingIds,
    heroListingId: opts.heroListingId,
    tags: opts.tags,
    coverImage: opts.coverImage,
    status: opts.status,
    curatorSlug: opts.curatorSlug ?? auth?.curatorSlug,
  };
  const headers = lookAuthHeaders(auth);
  const response = await fetchAgentApi(`/api/looks`, {
    method: "POST",
    headers: Object.keys(headers).length > 0 ? headers : undefined,
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  const look = (await response.json()) as { id: string; slug: string };
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
  auth?: LookAuth,
): Promise<LookDetail> {
  const headers = lookAuthHeaders(auth);
  const response = await fetchAgentApi(
    `/api/looks/${encodeURIComponent(slug)}`,
    {
      method: "PATCH",
      headers: Object.keys(headers).length > 0 ? headers : undefined,
      body: JSON.stringify(updates),
    },
  );
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }
  return response.json();
}

/**
 * Delete a look.
 * DELETE /api/looks/:slug
 *
 * Requires auth headers set on the agent-api client (creator only).
 * Uses fetchAgentApi directly because agent-api.ts has no typed DELETE
 * wrapper.
 */
export async function deleteLook(slug: string, auth?: LookAuth): Promise<{ ok: boolean }> {
  const response = await fetchAgentApi(
    `/api/looks/${encodeURIComponent(slug)}`,
    { method: "DELETE", headers: lookAuthHeaders(auth) },
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
