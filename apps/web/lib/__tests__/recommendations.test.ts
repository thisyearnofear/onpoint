import { describe, it, expect } from "vitest";
import {
  getRecommendedItems,
  CANVAS_ITEMS,
  type StylePreferences,
} from "../../../../packages/shared-types/src/fashion-data";

describe("getRecommendedItems", () => {
  it("returns items matching preferred categories", () => {
    const prefs: StylePreferences = {
      categories: ["shirts"],
      priceRange: { min: 0, max: 1000 },
    };

    const results = getRecommendedItems(prefs, 5);
    expect(results.length).toBeLessThanOrEqual(5);
    // Top results should be shirts since category match scores highest
    const shirtCount = results.filter((r) => r.category === "shirts").length;
    expect(shirtCount).toBeGreaterThan(0);
  });

  it("respects the limit parameter", () => {
    const prefs: StylePreferences = {
      categories: [],
      priceRange: { min: 0, max: 10000 },
    };

    expect(getRecommendedItems(prefs, 1)).toHaveLength(1);
    expect(getRecommendedItems(prefs, 3)).toHaveLength(3);
    expect(getRecommendedItems(prefs, 10)).toHaveLength(
      Math.min(10, CANVAS_ITEMS.length),
    );
  });

  it("excludes specified item IDs", () => {
    const prefs: StylePreferences = {
      categories: [],
      priceRange: { min: 0, max: 10000 },
    };

    const excludeIds = ["1", "2", "3"];
    const results = getRecommendedItems(prefs, 10, excludeIds);

    for (const item of results) {
      expect(excludeIds).not.toContain(item.id);
    }
  });

  it("prefers items within price range", () => {
    const prefs: StylePreferences = {
      categories: [],
      priceRange: { min: 80, max: 100 },
    };

    const results = getRecommendedItems(prefs, 5);
    // Items within range should rank higher
    const withinRange = results.filter((r) => r.price >= 80 && r.price <= 100);
    expect(withinRange.length).toBeGreaterThan(0);
    // First result should be within range (highest score)
    expect(results[0]!.price).toBeGreaterThanOrEqual(80);
    expect(results[0]!.price).toBeLessThanOrEqual(100);
  });

  it("returns empty array when all items excluded", () => {
    const prefs: StylePreferences = {
      categories: [],
      priceRange: { min: 0, max: 10000 },
    };

    const allIds = CANVAS_ITEMS.map((item) => item.id);
    const results = getRecommendedItems(prefs, 5, allIds);
    expect(results).toHaveLength(0);
  });

  it("returns high-rated items when no preferences set", () => {
    const prefs: StylePreferences = {
      categories: [],
      priceRange: { min: 0, max: 10000 },
    };

    const results = getRecommendedItems(prefs, 3);
    expect(results).toHaveLength(3);
    // Top items should generally have higher ratings
    const topRating = results[0]!.averageRating ?? 0;
    expect(topRating).toBeGreaterThan(3);
  });
});
