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

export interface ProductSearchWithSignals<TProduct> {
  products: TProduct[];
  signals: MarketSignal[];
}
