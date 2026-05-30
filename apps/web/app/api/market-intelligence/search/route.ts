import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productCatalog } from "../../../../lib/services/product-catalog";

const SearchSchema = z.object({
  query: z.string().trim().min(2).max(120),
  limit: z.number().int().min(1).max(8).default(4),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json();
    const parsed = SearchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400 },
      );
    }

    const result = await productCatalog.searchExternalWithSignals(
      parsed.data.query,
      parsed.data.limit,
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("[MarketIntel] Search failed", error);
    return NextResponse.json(
      { error: "Market intelligence search failed" },
      { status: 500 },
    );
  }
}
