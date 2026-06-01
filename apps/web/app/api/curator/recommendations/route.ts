/**
 * GET /api/curator/recommendations?curatorSlug=<slug>&limit=<n>
 *
 * Returns cross-curator recommendations: items from complementary curators
 * that pair well with the current storefront's verticals.
 *
 * Attribution: each pick includes curatorSlug for tracking cross-curator visits.
 *
 * Uses raw neon SQL queries to avoid Turbopack resolution issues with @repo/db
 * schema imports on Netlify.
 */

import { neon } from "@neondatabase/serverless";
import {
  computeVerticalCompatibility,
  getMatchReason,
  type CrossCuratorPick,
} from "../../../../lib/utils/cross-curator-recommendations";

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
const PUBLIC_R2_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
let _sql: ReturnType<typeof neon> | null = null;

function sql() {
  if (!_sql) {
    if (!CONNECTION_STRING) throw new Error("NEON_DATABASE_URL not configured");
    _sql = neon(CONNECTION_STRING);
  }
  return _sql;
}

function keyToUrl(key: string | null): string | null {
  if (!key || !PUBLIC_R2_URL) return null;
  return `${PUBLIC_R2_URL}/${String(key).replace(/^\/+/, "")}`;
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const curatorSlug = searchParams.get("curatorSlug") || "";
  const limit = Math.min(Number(searchParams.get("limit") || "6"), 12);

  if (!isValidSlug(curatorSlug)) {
    return Response.json({ error: "Invalid curator slug" }, { status: 400 });
  }

  let querySql;
  try {
    querySql = sql();
  } catch {
    return Response.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    // 1. Get the current curator's verticals
    const sourceResult = await querySql`
      SELECT slug, name, verticals, brand
      FROM curators
      WHERE slug = ${curatorSlug}
      LIMIT 1
    ` as Array<{ slug: string; name: string; verticals: string[]; brand: Record<string, unknown> }>;

    if (sourceResult.length === 0) {
      return Response.json({ error: "Curator not found" }, { status: 404 });
    }

    const sourceCurator = sourceResult[0]!;
    const sourceVerticals = Array.isArray(sourceCurator.verticals)
      ? sourceCurator.verticals
      : [];

    if (sourceVerticals.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // 2. Get all OTHER curators
    const otherResult = await querySql`
      SELECT slug, name, verticals, brand
      FROM curators
      WHERE slug != ${curatorSlug}
    ` as Array<{ slug: string; name: string; verticals: string[]; brand: Record<string, unknown> }>;

    if (otherResult.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // 3. Score each curator by vertical compatibility
    const scoredCurators = otherResult
      .map((c) => ({
        ...c,
        score: computeVerticalCompatibility(
          sourceVerticals,
          Array.isArray(c.verticals) ? c.verticals : [],
        ),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    if (scoredCurators.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // Build a map of slug → verticals for O(1) lookup
    const verticalsBySlug = new Map<string, string[]>(
      scoredCurators.map((c) => [c.slug, Array.isArray(c.verticals) ? c.verticals : []]),
    );

    // 4. Fetch live listings from compatible curators
    const compatibleSlugs = scoredCurators.map((c) => c.slug);

    const listingResult = await querySql`
      SELECT
        l.id as listing_id,
        l.sku_id,
        l.sizes,
        l.photo_keys,
        l.status,
        l.updated_at,
        k.id as kit_id,
        k.club,
        k.season,
        k.kit_type,
        k.official_image_key,
        c.slug as curator_slug,
        c.name as curator_name,
        c.brand as curator_brand
      FROM listings l
      INNER JOIN kit_skus k ON l.sku_id = k.id
      INNER JOIN curators c ON l.curator_slug = c.slug
      WHERE l.curator_slug = ANY(${compatibleSlugs})
        AND l.status = 'live'
      ORDER BY l.updated_at DESC
    ` as Array<{
      listing_id: string; sku_id: string; sizes: Array<{ size: string; stock: number; price: number }>;
      photo_keys: string[]; status: string; updated_at: string;
      club: string; season: string; kit_type: string; official_image_key: string | null;
      curator_slug: string; curator_name: string; curator_brand: Record<string, unknown>;
    }>;

    // 5. Score and rank individual listings
    const scoredListings: CrossCuratorPick[] = listingResult.map((row) => {
      const curatorData = scoredCurators.find(
        (c) => c.slug === row.curator_slug,
      );
      const compatibilityScore = curatorData?.score || 0;
      const sizes = row.sizes || [];
      const prices = sizes
        .map((s) => Number(s.price))
        .filter((p) => Number.isFinite(p) && p > 0);
      const lowestPrice = prices.length ? Math.min(...prices) : null;

      const curatorBrand = row.curator_brand || {};
      const colors = (curatorBrand.colors || {}) as Record<string, string>;

      return {
        listingId: row.listing_id,
        curatorSlug: row.curator_slug,
        curatorName: row.curator_name,
        curatorAvatar: curatorBrand.logo as string | undefined,
        curatorColor: colors.primary || "#6366f1",
        itemTitle: row.club,
        itemSubtitle: `${row.season} · ${row.kit_type}`,
        imageUrl: keyToUrl(
          (row.photo_keys?.[0] as string) || row.official_image_key || null,
        ),
        lowestPrice,
        compatibilityScore,
        matchReason: getMatchReason(
          sourceVerticals,
          verticalsBySlug.get(row.curator_slug) || [],
        ),
      };
    });

    // 6. Sort by compatibility, then take top N
    const recommendations = scoredListings
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    return Response.json({
      recommendations,
      meta: {
        sourceCurator: curatorSlug,
        compatibleCurators: scoredCurators.length,
        totalListings: listingResult.length,
      },
    });
  } catch (err) {
    console.error("Failed to fetch cross-curator recommendations:", err);
    return Response.json(
      { error: "Failed to fetch recommendations" },
      { status: 500 },
    );
  }
}
