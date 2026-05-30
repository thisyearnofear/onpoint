import type {
  ExternalProduct,
  MarketPartnerIntegration,
  MarketSignal,
  ProductResult,
  RetailSignalMemory,
} from "@onpoint/shared-types";

export const MARKET_INTEL_STORAGE_KEY = "onpoint:last-market-intel";

export interface StoredMarketIntel {
  query: string;
  products: ExternalProduct[];
  signals: MarketSignal[];
  partnerIntegrations?: MarketPartnerIntegration[];
  memory?: RetailSignalMemory;
  updatedAt: string;
}

export function productResultToExternalProduct(
  product: ProductResult,
  index: number,
  query: string,
): ExternalProduct {
  return {
    id: `intel_${query.toLowerCase().replace(/[^a-z0-9]+/g, "-")}_${index}`,
    name: product.name,
    price: product.price,
    source: product.source,
    url: product.url,
    imageUrl: product.image_url || "",
  };
}

export function saveMarketIntelSnapshot(snapshot: Omit<StoredMarketIntel, "updatedAt">): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      MARKET_INTEL_STORAGE_KEY,
      JSON.stringify({
        ...snapshot,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // Local storage is best-effort. The app still works without persistence.
  }
}

export function loadMarketIntelSnapshot(): StoredMarketIntel | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MARKET_INTEL_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as StoredMarketIntel;
    if (!parsed.query || !Array.isArray(parsed.products) || !Array.isArray(parsed.signals)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
