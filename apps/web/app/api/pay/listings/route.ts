import { NextResponse } from "next/server";
import { getApiBase } from "@/lib/utils/api-base";

export const dynamic = "force-dynamic";

/**
 * Slim listing feed for the /pay picker — the same storefront agents read,
 * trimmed to what a human needs to choose a piece.
 */
export async function GET(request: Request) {
  const curator = new URL(request.url).searchParams.get("curator");
  const slug =
    curator && /^[a-z0-9][a-z0-9-]{0,63}$/.test(curator) ? curator : "onpoint-store";
  const upstream = await fetch(`${getApiBase()}/api/curator/${slug}/storefront`, {
    next: { revalidate: 300 },
  });
  const data = await upstream.json().catch(() => ({}));
  const listings = (data.listings ?? [])
    .filter((l: { id?: string }) => l.id)
    .map((l: { id: string; title?: string; name?: string; imageUrl?: string; image?: string; priceKes?: number }) => ({
      id: l.id,
      title: l.title || l.name || "Listing",
      imageUrl: l.imageUrl || l.image || null,
      priceKes: l.priceKes ?? null,
    }));
  return NextResponse.json({ listings }, { status: upstream.ok ? 200 : 502 });
}
