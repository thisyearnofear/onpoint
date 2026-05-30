import { describe, expect, it, beforeEach } from "vitest";
import {
  loadMarketIntelSnapshot,
  productResultToExternalProduct,
  saveMarketIntelSnapshot,
  MARKET_INTEL_STORAGE_KEY,
} from "./market-intelligence-storage";
import type { MarketSignal, ProductResult } from "@onpoint/shared-types";

const signal: MarketSignal = {
  id: "competitor-price:black-blazer:brightdata",
  type: "competitor_price",
  query: "black blazer",
  source: "brightdata_serp",
  title: "Comparable price range: USD 89.00-148.00",
  evidence: "2 priced comparable products found.",
  action: "Use this range to position the listing.",
  confidence: 0.78,
  createdAt: "2026-05-30T00:00:00.000Z",
  currency: "USD",
};

describe("market intelligence storage", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("maps ProductResult into an ExternalProduct snapshot item", () => {
    const product: ProductResult = {
      name: "Black Cropped Blazer",
      price: 89,
      source: "zara.com",
      url: "https://zara.com/blazer",
      image_url: "https://example.com/blazer.jpg",
      currency: "USD",
    };

    const mapped = productResultToExternalProduct(product, 0, "black blazer");

    expect(mapped.id).toBe("intel_black-blazer_0");
    expect(mapped.name).toBe(product.name);
    expect(mapped.imageUrl).toBe(product.image_url);
  });

  it("saves and loads the latest market intelligence snapshot", () => {
    saveMarketIntelSnapshot({
      query: "black blazer",
      products: [
        {
          id: "ext_1",
          name: "Black Cropped Blazer",
          price: 89,
          source: "zara.com",
          url: "https://zara.com/blazer",
          imageUrl: "https://example.com/blazer.jpg",
        },
      ],
      signals: [signal],
    });

    const loaded = loadMarketIntelSnapshot();

    expect(loaded?.query).toBe("black blazer");
    expect(loaded?.products).toHaveLength(1);
    expect(loaded?.signals[0]?.type).toBe("competitor_price");
    expect(loaded?.updatedAt).toBeTruthy();
  });

  it("returns null for malformed stored snapshots", () => {
    localStorage.setItem(MARKET_INTEL_STORAGE_KEY, JSON.stringify({ query: "missing arrays" }));

    expect(loadMarketIntelSnapshot()).toBeNull();
  });
});
