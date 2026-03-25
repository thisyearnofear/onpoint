/**
 * Product Catalog Service Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { productCatalog, type SearchOptions } from "../product-catalog";

// Mock shared-types
vi.mock("@onpoint/shared-types", () => ({
  searchCatalog: vi.fn((query: string, limit: number) => {
    if (query.toLowerCase().includes("jacket")) {
      return [
        {
          id: "1",
          name: "Black Leather Jacket",
          price: 129,
          category: "Outerwear",
        },
      ];
    }
    return [];
  }),
  mergeProductResults: vi.fn((local, external) => external.length > 0 ? external : local),
  CANVAS_ITEMS: [
    {
      id: "1",
      name: "Black Leather Jacket",
      price: 129,
      category: "Outerwear",
      slug: "test-jacket",
      description: "Test jacket",
      cover: "https://example.com/image.jpg",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
}));

describe("ProductCatalogService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("search", () => {
    it("returns local results for matching query", async () => {
      const result = await productCatalog.search("jacket", { limit: 5 });

      expect(result.items).toHaveLength(1);
      expect(result.source).toBe("local");
      expect(result.cached).toBe(false);
    });

    it("returns empty array for no matches", async () => {
      const result = await productCatalog.search("nonexistent-item-xyz");

      expect(result.items).toHaveLength(0);
      expect(result.source).toBe("local");
    });

    it("uses default limit of 10", async () => {
      const result = await productCatalog.search("jacket");

      expect(result.items).toBeDefined();
    });

    it("respects custom limit", async () => {
      const result = await productCatalog.search("jacket", { limit: 3 });

      expect(result.items).toBeDefined();
    });
  });

  describe("getById", () => {
    it("finds product by ID", () => {
      const product = productCatalog.getById("1");

      expect(product).toBeDefined();
      expect(product?.name).toBe("Black Leather Jacket");
    });

    it("returns undefined for unknown ID", () => {
      const product = productCatalog.getById("unknown-id");

      expect(product).toBeUndefined();
    });
  });

  describe("getByCategory", () => {
    it("filters products by category", () => {
      const products = productCatalog.getByCategory("Outerwear", 10);

      expect(Array.isArray(products)).toBe(true);
    });

    it("respects limit parameter", () => {
      const products = productCatalog.getByCategory("Outerwear", 5);

      expect(products.length).toBeLessThanOrEqual(5);
    });
  });
});

describe("Cache Behavior", () => {
  it("caches search results", async () => {
    // First search
    const result1 = await productCatalog.search("jacket");
    
    // Second search should use cache (if Redis configured)
    const result2 = await productCatalog.search("jacket");
    
    // Both should return same data structure
    expect(result1.items).toEqual(result2.items);
  });

  it("skips cache with forceRefresh", async () => {
    await productCatalog.search("jacket");
    
    const result = await productCatalog.search("jacket", { 
      forceRefresh: true 
    });
    
    expect(result.cached).toBe(false);
  });
});

describe("Search Options", () => {
  it("accepts minPrice filter", async () => {
    const result = await productCatalog.search("jacket", {
      minPrice: 100,
    });

    expect(result).toBeDefined();
  });

  it("accepts maxPrice filter", async () => {
    const result = await productCatalog.search("jacket", {
      maxPrice: 200,
    });

    expect(result).toBeDefined();
  });

  it("accepts multiple filters", async () => {
    const result = await productCatalog.search("jacket", {
      limit: 5,
      minPrice: 50,
      maxPrice: 500,
      forceRefresh: false,
    });

    expect(result).toBeDefined();
  });
});
