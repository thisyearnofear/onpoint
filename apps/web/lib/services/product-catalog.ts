/**
 * Product Catalog Service
 *
 * Unified interface for product discovery across local and external sources.
 * Follows existing patterns from agent-store.ts for Redis integration.
 *
 * Tiers:
 * 1. Local catalog (CANVAS_ITEMS) - Fast, free, limited selection
 * 2. Purch API - Comprehensive (1B+ products), costs ~$0.01-0.10 per search
 *
 * Caching: 24-hour TTL to minimize API costs while keeping results fresh.
 */

import {
  FashionItem,
  ExternalProduct,
  searchCatalog as searchLocalCatalog,
  mergeProductResults,
} from "@onpoint/shared-types";
import {
  redisGet,
  redisSet,
  isRedisConfigured,
} from "../utils/redis-helpers";

/**
 * Infer product category from item name and search query.
 */
function inferCategory(name: string, query: string): string {
  const text = `${name} ${query}`.toLowerCase();
  const categoryMap: Array<[string[], string]> = [
    [["jacket", "coat", "blazer", "parka", "puffer"], "Jackets"],
    [["dress", "gown", "midi", "maxi", "mini dress"], "Dresses"],
    [["shirt", "blouse", "top", "tee", "t-shirt", "polo", "henley"], "Tops"],
    [["pants", "trouser", "jeans", "denim", "chino", "cargo"], "Bottoms"],
    [["skirt", "mini skirt", "pleated"], "Skirts"],
    [
      ["shoe", "sneaker", "boot", "heel", "sandal", "loafer", "flat", "oxford"],
      "Shoes",
    ],
    [
      ["bag", "purse", "tote", "clutch", "backpack", "crossbody", "satchel"],
      "Bags",
    ],
    [
      [
        "watch",
        "jewelry",
        "necklace",
        "bracelet",
        "ring",
        "earring",
        "pendant",
      ],
      "Accessories",
    ],
    [
      ["sweater", "cardigan", "hoodie", "sweatshirt", "knit", "pullover"],
      "Knitwear",
    ],
    [["shorts", "bermuda"], "Shorts"],
    [["suit", "tuxedo"], "Suits"],
    [["swimwear", "bikini", "swimsuit"], "Swimwear"],
    [["sunglasses", "hat", "scarf", "belt", "glove"], "Accessories"],
  ];

  for (const [keywords, category] of categoryMap) {
    if (keywords.some((kw) => text.includes(kw))) {
      return category;
    }
  }
  return "Other";
}

// ============================================
// Cache helpers (uses shared Redis)
// ============================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  ttlMs: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ============================================
// Catalog Service
// ============================================

export interface SearchOptions {
  /** Maximum results to return */
  limit?: number;
  /** Force refresh (skip cache) */
  forceRefresh?: boolean;
  /** Price range filter */
  minPrice?: number;
  maxPrice?: number;
}

export interface SearchResult {
  items: Array<FashionItem | ExternalProduct>;
  source: "local" | "external" | "hybrid";
  cached: boolean;
}

class ProductCatalogService {
  private readonly bridgeUrl: string | null;
  private readonly bridgeApiKey: string | null;

  constructor() {
    this.bridgeUrl = process.env.EXTERNAL_AGENT_URL || null;
    this.bridgeApiKey = process.env.BRIDGE_API_KEY || null;
  }

  /**
   * Search for products across all tiers.
   * Strategy: Local first (fast/free), then external (comprehensive/costly).
   */
  async search(
    query: string,
    options: SearchOptions = {},
  ): Promise<SearchResult> {
    const { limit = 10, forceRefresh = false } = options;

    // Check cache first
    if (!forceRefresh) {
      const cached = await this.getCached(query, limit);
      if (cached) {
        return {
          items: cached,
          source: "local",
          cached: true,
        };
      }
    }

    // Tier 1: Search local catalog (fast, free)
    const localResults = searchLocalCatalog(query, limit);

    if (localResults.length > 0) {
      // Cache and return local results
      await this.cacheResult(query, limit, localResults);
      return {
        items: localResults,
        source: "local",
        cached: false,
      };
    }

    // Tier 2: Search external (Purch API via bridge)
    const externalResults = await this.searchExternal(query, limit);

    if (externalResults.length > 0) {
      // For now, return external as-is (they're already typed)
      await this.cacheResult(query, limit, externalResults);
      return {
        items: externalResults,
        source: "external",
        cached: false,
      };
    }

    // No results found
    return {
      items: [],
      source: "local",
      cached: false,
    };
  }

  /**
   * Get product by ID (local catalog only for now)
   */
  getById(id: string): FashionItem | undefined {
    const { CANVAS_ITEMS } = require("@onpoint/shared-types");
    return CANVAS_ITEMS.find((item: FashionItem) => item.id === id);
  }

  /**
   * Get products by category (local catalog)
   */
  getByCategory(category: string, limit = 20): FashionItem[] {
    const { CANVAS_ITEMS } = require("@onpoint/shared-types");
    return CANVAS_ITEMS.filter(
      (item: FashionItem) =>
        item.category.toLowerCase() === category.toLowerCase(),
    ).slice(0, limit);
  }

  /**
   * Search external catalog via Python bridge
   */
  private async searchExternal(
    query: string,
    limit: number,
  ): Promise<ExternalProduct[]> {
    if (!this.bridgeUrl) {
      console.log(
        "[Catalog] No bridge URL configured, skipping external search",
      );
      return [];
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.bridgeApiKey) {
        headers["Authorization"] = `Bearer ${this.bridgeApiKey}`;
      }

      const response = await fetch(`${this.bridgeUrl}/v1/agent/search`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId: "catalog-service",
          query,
          max_results: limit,
        }),
      });

      if (!response.ok) {
        console.warn(
          `[Catalog] Bridge returned ${response.status}, treating as empty`,
        );
        return [];
      }

      const data = await response.json();

      // Map bridge response to ExternalProduct format
      return (data.items || []).map((item: any) => ({
        id: `ext_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: item.name,
        price: item.price,
        source: item.source || "external",
        url: item.url,
        imageUrl: item.image_url,
        category: inferCategory(item.name, query),
      }));
    } catch (error) {
      console.error("[Catalog] External search failed:", error);
      return [];
    }
  }

  /**
   * Get cached results from Redis
   */
  private async getCached(
    query: string,
    limit: number,
  ): Promise<Array<FashionItem | ExternalProduct> | null> {
    const cacheKey = this.getCacheKey(query, limit);
    const cached =
      await redisGet<CacheEntry<Array<FashionItem | ExternalProduct>>>(
        cacheKey,
      );

    if (!cached) return null;

    // Check if expired
    if (Date.now() - cached.cachedAt > cached.ttlMs) {
      return null;
    }

    console.log(`[Catalog] Cache hit for "${query}"`);
    return cached.data;
  }

  /**
   * Cache search results in Redis
   */
  private async cacheResult(
    query: string,
    limit: number,
    results: Array<FashionItem | ExternalProduct>,
  ): Promise<void> {
    const cacheKey = this.getCacheKey(query, limit);
    const entry: CacheEntry<Array<FashionItem | ExternalProduct>> = {
      data: results,
      cachedAt: Date.now(),
      ttlMs: CACHE_TTL_MS,
    };

    await redisSet(cacheKey, entry);
    console.log(`[Catalog] Cached ${results.length} results for "${query}"`);
  }

  /**
   * Generate cache key from query and limit
   */
  private getCacheKey(query: string, limit: number): string {
    return `catalog:search:${query.toLowerCase()}:${limit}`;
  }
}

// Singleton instance
export const productCatalog = new ProductCatalogService();

// Convenience export for direct local search
export { searchLocalCatalog };
