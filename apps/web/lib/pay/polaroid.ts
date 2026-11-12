export interface PolaroidMeta {
  item: string;
  curatorSlug: string;
  curatorName: string;
  listingId: string;
  inventoryType: string;
  imageUrl: string;
  fitSignal: {
    bodyType: string | null;
    recommendedSize: string | null;
    score: number | null;
    confidence: number | null;
    fitRecommendations: string[];
    styleRecommendations: string[];
  } | null;
  stylingTips: string[];
  aiCost?: {
    provider: string;
    model: string | null;
    costUsd: number | string | null;
    meteredBy: string;
  } | null;
  payment: {
    txHash: string;
    amountCusd: string;
    explorerUrl: string | null;
    paymentMethod?: string;
  };
  storefrontUrl: string;
  createdAt: string;
}

export async function loadPolaroid(id: string): Promise<PolaroidMeta | null> {
  const r2Base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "");
  if (!r2Base) return null;
  try {
    const res = await fetch(`${r2Base}/polaroids/${id}.json`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
