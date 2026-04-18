/**
 * Product Catalog Search API
 * 
 * Unified search across local and external product catalogs.
 * Tier 1: Local CANVAS_ITEMS (fast, free)
 * Tier 2: Purch API via Python bridge (comprehensive, ~$0.01-0.10)
 * 
 * Results cached for 24 hours to minimize API costs.
 * 
 * Authentication: Required for external searches (premium feature)
 * Rate Limiting: 60 req/min (free), 500 req/min (premium)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productCatalog } from "../../../../lib/services/product-catalog";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit, requirePermission } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../../ai/_utils/http";

// Request schema
const SearchRequestSchema = z.object({
  query: z.string().min(1, "Search query is required"),
  limit: z.number().int().min(1).max(50).default(10),
  forceRefresh: z.boolean().default(false),
  minPrice: z.number().optional(),
  maxPrice: z.number().optional(),
});

// GET - Quick search via query params (public for local, auth for external)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const url = new URL(request.url);
  
  try {
    const query = url.searchParams.get("query");
    if (!query) {
      return NextResponse.json(
        { error: "Query parameter 'query' is required" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const limit = parseInt(url.searchParams.get("limit") || "10");
    const forceRefresh = url.searchParams.get("refresh") === "true";

    const result = await productCatalog.search(query, {
      limit,
      forceRefresh,
    });

    return NextResponse.json(
      {
        query,
        count: result.items.length,
        source: result.source,
        cached: result.cached,
        items: result.items,
      },
      { status: 200, headers: corsHeaders(origin) }
    );
  } catch (error) {
    console.error("Catalog search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) }
    );
  }
}

// POST - Advanced search with JSON body (requires auth for external searches)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = SearchRequestSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) }
        );
      }

      const { query, limit, forceRefresh, minPrice, maxPrice } = parsed.data;

      // Check permission for external searches
      if (forceRefresh) {
        // Force refresh may trigger external search - requires permission
        if (!ctx.permissions.includes("external_search")) {
          return NextResponse.json(
            { error: "External search requires premium tier" },
            { status: 403, headers: corsHeaders(origin) }
          );
        }
      }

      const result = await productCatalog.search(query, {
        limit,
        forceRefresh,
        minPrice,
        maxPrice,
      });

      return NextResponse.json(
        {
          query,
          count: result.items.length,
          source: result.source,
          cached: result.cached,
          items: result.items,
        },
        { status: 200, headers: corsHeaders(origin) }
      );
    } catch (error) {
      console.error("Catalog search error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) }
      );
    }
  })(request);
}

