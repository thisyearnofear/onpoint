/**
 * GET /api/curator/recommendations?curatorSlug=<slug>&limit=<n>
 *
 * Returns cross-curator recommendations: items from complementary curators
 * that pair well with the current storefront's verticals.
 *
 * Attribution: each pick includes curatorSlug for tracking cross-curator visits.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, ne, inArray, desc } from "drizzle-orm";
import { curators, listings, kitSkus } from "@repo/db";
import {
  computeVerticalCompatibility,
  getMatchReason,
  type CrossCuratorPick,
} from "../../../../lib/utils/cross-curator-recommendations";

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
const PUBLIC_R2_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, "");
let _sql: ReturnType<typeof neon> | null = null;

function getDb() {
  if (!_sql) {
    if (!CONNECTION_STRING) throw new Error("NEON_DATABASE_URL not configured");
    _sql = neon(CONNECTION_STRING);
  }
  return drizzle(_sql, { schema: { curators, listings, kitSkus } });
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

  let db;
  try {
    db = getDb();
  } catch {
    return Response.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  try {
    // 1. Get the current curator's verticals
    const [sourceCurator] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, curatorSlug))
      .limit(1);

    if (!sourceCurator) {
      return Response.json({ error: "Curator not found" }, { status: 404 });
    }

    const sourceVerticals = sourceCurator.verticals || [];
    if (sourceVerticals.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // 2. Get all OTHER curators with live listings
    const otherCurators = await db
      .select({
        slug: curators.slug,
        name: curators.name,
        verticals: curators.verticals,
        brand: curators.brand,
      })
      .from(curators)
      .where(ne(curators.slug, curatorSlug));

    if (otherCurators.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // 3. Score each curator by vertical compatibility
    const scoredCurators = otherCurators
      .map((c) => ({
        ...c,
        score: computeVerticalCompatibility(sourceVerticals, c.verticals || []),
      }))
      .filter((c) => c.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5); // Top 5 compatible curators

    if (scoredCurators.length === 0) {
      return Response.json({ recommendations: [] });
    }

    // 4. Fetch live listings from compatible curators
    const compatibleSlugs = scoredCurators.map((c) => c.slug);

    const listingRows = await db
      .select({
        listing: listings,
        kit: kitSkus,
        curator: curators,
      })
      .from(listings)
      .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .innerJoin(curators, eq(listings.curatorSlug, curators.slug))
      .where(
        inArray(listings.curatorSlug, compatibleSlugs),
      )
      .orderBy(desc(listings.updatedAt));

    // Filter to live listings only
    const liveListings = listingRows.filter(
      ({ listing }) => listing.status === "live",
    );

    // 5. Score and rank individual listings
    const scoredListings: CrossCuratorPick[] = liveListings.map(
      ({ listing, kit, curator }) => {
        const curatorData = scoredCurators.find((c) => c.slug === curator.slug);
        const compatibilityScore = curatorData?.score || 0;
        const sizes = (listing.sizes || []) as Array<{
          size: string;
          stock: number;
          price: number;
        }>;
        const prices = sizes
          .map((s) => Number(s.price))
          .filter((p) => Number.isFinite(p) && p > 0);
        const lowestPrice = prices.length ? Math.min(...prices) : null;

        return {
          listingId: listing.id,
          curatorSlug: curator.slug,
          curatorName: curator.name,
          curatorAvatar: (curator.brand as Record<string, unknown>)?.logo as string | undefined,
          curatorColor:
            ((curator.brand as Record<string, Record<string, string>>)
              ?.colors?.primary) || "#6366f1",
          itemTitle: kit.club,
          itemSubtitle: `${kit.season} · ${kit.kitType}`,
          imageUrl: keyToUrl(
            (listing.photoKeys?.[0] as string) || kit.officialImageKey || null,
          ),
          lowestPrice,
          compatibilityScore,
          matchReason: getMatchReason(sourceVerticals, curator.verticals || []),
        };
      },
    );

    // 6. Sort by compatibility, then take top N
    const recommendations = scoredListings
      .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
      .slice(0, limit);

    return Response.json({
      recommendations,
      meta: {
        sourceCurator: curatorSlug,
        compatibleCurators: scoredCurators.length,
        totalListings: liveListings.length,
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
