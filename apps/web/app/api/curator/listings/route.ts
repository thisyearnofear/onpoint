/**
 * POST /api/curator/listings
 *
 * Create a new listing for a curator. Uses raw neon SQL (same pattern
 * as the recommendations endpoint) to avoid Turbopack resolution issues
 * with @repo/db on Netlify.
 *
 * Body: {
 *   curatorSlug: string,
 *   club: string,         // e.g. "Arsenal"
 *   kitType: string,      // "home" | "away" | "third" | "goalkeeper"
 *   season: string,       // e.g. "2024/25"
 *   sizes: Array<{ size: string, stock: number, price: number }>,
 *   printingAvailable?: boolean  // default false
 * }
 *
 * No photo upload — the storefront handles missing photos with a
 * branded gradient placeholder. Curators can add photos later via
 * the WhatsApp agent (which has R2 access).
 *
 * Auth: IP-based rate limiting. In a future iteration we should verify
 * the curator "owns" this slug (e.g. via wallet signature or Auth0 session).
 */

import { neon } from "@neondatabase/serverless";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql: ReturnType<typeof neon> | null = null;

function sql() {
  if (!_sql) {
    if (!CONNECTION_STRING) throw new Error("NEON_DATABASE_URL not configured");
    _sql = neon(CONNECTION_STRING);
  }
  return _sql;
}

const VALID_KIT_TYPES = ["home", "away", "third", "goalkeeper"];
const VALID_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "3XL", "S/M", "L/XL", "OS"];

interface CreateListingBody {
  curatorSlug: string;
  club: string;
  kitType: string;
  season: string;
  sizes: Array<{ size: string; stock: number; price: number; printingAvailable?: boolean }>;
}

export async function POST(request: Request) {
  const clientId = getClientId(request) || "unknown";
  const rlResult = await rateLimit(`listings:${clientId}`, RateLimits.general);
  if (!rlResult.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
  }

  let db;
  try {
    db = sql();
  } catch {
    return Response.json(
      { error: "Database not configured" },
      { status: 503 },
    );
  }

  let body: CreateListingBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { curatorSlug, club, kitType, season, sizes } = body;

  // Validate
  if (!curatorSlug || typeof curatorSlug !== "string") {
    return Response.json({ error: "curatorSlug is required" }, { status: 400 });
  }
  if (!club || typeof club !== "string" || club.trim().length < 2) {
    return Response.json({ error: "club is required" }, { status: 400 });
  }
  if (!VALID_KIT_TYPES.includes(kitType)) {
    return Response.json({ error: `kitType must be one of: ${VALID_KIT_TYPES.join(", ")}` }, { status: 400 });
  }
  if (!season || typeof season !== "string") {
    return Response.json({ error: "season is required" }, { status: 400 });
  }
  if (!Array.isArray(sizes) || sizes.length === 0) {
    return Response.json({ error: "At least one size is required" }, { status: 400 });
  }

  // Validate each size
  for (const s of sizes) {
    if (!s.size || typeof s.size !== "string") {
      return Response.json({ error: "Each size must have a size name" }, { status: 400 });
    }
    if (typeof s.stock !== "number" || s.stock < 0) {
      return Response.json({ error: "stock must be a non-negative number" }, { status: 400 });
    }
    if (typeof s.price !== "number" || s.price <= 0) {
      return Response.json({ error: "price must be a positive number" }, { status: 400 });
    }
  }

  try {
    // 1. Verify curator exists
    const curatorResult = await db`
      SELECT slug FROM curators WHERE slug = ${curatorSlug} LIMIT 1
    ` as Array<{ slug: string }>;

    if (curatorResult.length === 0) {
      return Response.json({ error: "Curator not found" }, { status: 404 });
    }

    // 2. Resolve or create kit_sku
    // Generate a SKU ID from club + season + kitType
    const skuId = `${club.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${season.replace(/[^a-z0-9]+/g, "-").toLowerCase()}-${kitType}`;

    const existingSku = await db`
      SELECT id FROM kit_skus WHERE id = ${skuId} LIMIT 1
    ` as Array<{ id: string }>;

    if (existingSku.length === 0) {
      // Create the SKU
      await db`
        INSERT INTO kit_skus (id, club, season, kit_type)
        VALUES (${skuId}, ${club.trim()}, ${season.trim()}, ${kitType})
      `;
    }

    // 3. Check if a listing already exists for this curator + SKU
    const existingListing = await db`
      SELECT id FROM listings
      WHERE curator_slug = ${curatorSlug} AND sku_id = ${skuId}
      LIMIT 1
    ` as Array<{ id: string }>;

    if (existingListing.length > 0) {
      // Merge sizes into existing listing
      const listingId = existingListing[0]!.id;
      const currentListing = await db`
        SELECT sizes FROM listings WHERE id = ${listingId} LIMIT 1
      ` as Array<{ sizes: Array<{ size: string; stock: number; price: number; printingAvailable?: boolean }> }>;

      const currentSizes = currentListing[0]?.sizes || [];
      // Merge: update existing sizes, add new ones
      const sizesMap = new Map<string, { size: string; stock: number; price: number; printingAvailable?: boolean }>();
      for (const s of currentSizes) {
        sizesMap.set(s.size, s);
      }
      for (const s of sizes) {
        sizesMap.set(s.size, s);
      }
      const mergedSizes = Array.from(sizesMap.values());

      await db`
        UPDATE listings
        SET sizes = ${JSON.stringify(mergedSizes)}, updated_at = NOW()
        WHERE id = ${listingId}
      `;

      return Response.json({
        success: true,
        listingId,
        skuId,
        merged: true,
        sizes: mergedSizes,
      });
    }

    // 4. Create new listing
    const newListing = await db`
      INSERT INTO listings (curator_slug, sku_id, sizes, status)
      VALUES (${curatorSlug}, ${skuId}, ${JSON.stringify(sizes)}, 'live')
      RETURNING id
    ` as Array<{ id: string }>;

    return Response.json({
      success: true,
      listingId: newListing[0]!.id,
      skuId,
      merged: false,
      sizes,
    });
  } catch (err) {
    console.error("Failed to create listing:", err);
    return Response.json(
      { error: "Failed to create listing" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/curator/listings/kit-skus?q=<search>
 *
 * Returns existing kit_skus for autocomplete in the inventory form.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  let db;
  try {
    db = sql();
  } catch {
    return Response.json({ error: "Database not configured" }, { status: 503 });
  }

  try {
    let result;
    if (q) {
      result = await db`
        SELECT id, club, season, kit_type
        FROM kit_skus
        WHERE LOWER(club) LIKE ${q + "%"}
        ORDER BY club, season
        LIMIT 20
      `;
    } else {
      result = await db`
        SELECT id, club, season, kit_type
        FROM kit_skus
        ORDER BY club, season
        LIMIT 50
      `;
    }

    return Response.json({ skus: result });
  } catch (err) {
    console.error("Failed to fetch kit SKUs:", err);
    return Response.json({ error: "Failed to fetch SKUs" }, { status: 500 });
  }
}
