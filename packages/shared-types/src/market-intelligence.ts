export type MarketSignalType =
  | "product_gap"
  | "competitor_price"
  | "retailer_availability"
  | "trend_match"
  | "recommended_action";

export interface MarketSignal {
  id: string;
  type: MarketSignalType;
  query: string;
  source: string;
  title: string;
  url?: string;
  price?: number;
  currency?: string;
  confidence: number;
  evidence: string;
  action: string;
  createdAt: string;
}

export interface MarketPartnerIntegration {
  id: string;
  partner: "aimlapi" | "cognee" | "triggerware";
  label: string;
  status: "sent" | "ready" | "skipped" | "failed";
  summary: string;
  evidence: string;
  externalId?: string;
  createdAt: string;
}

export interface RetailSignalMemory {
  query: string;
  repeatedIntentCount: number;
  knownGapCount: number;
  rememberedRetailers: string[];
  lastSeenAt: string;
}

export interface ProductSearchWithSignals<TProduct> {
  products: TProduct[];
  signals: MarketSignal[];
  partnerIntegrations?: MarketPartnerIntegration[];
  memory?: RetailSignalMemory;
}
