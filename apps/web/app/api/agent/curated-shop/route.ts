import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { productCatalog } from "../../../../lib/services/product-catalog";
import {
  buildSearchQueries,
  scoreLocalPicks,
  type CurationContext,
  type CuratedPick,
} from "../../../../lib/utils/curated-picks";
import type { ExternalProduct } from "@onpoint/shared-types";
import { corsHeaders } from "../../ai/_utils/http";
export { OPTIONS } from "../../ai/_utils/http";

const CuratedShopRequest = z.object({
  score: z.number().min(0).max(10),
  takeaways: z.array(z.string()).max(10),
  topics: z.array(z.string()).max(6),
  recommendations: z
    .array(
      z.object({
        name: z.string(),
        price: z.number(),
        category: z.string(),
      }),
    )
    .optional(),
  persona: z.string().optional(),
  sessionGoal: z.enum(["event", "daily", "critique"]).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = CuratedShopRequest.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const ctx: CurationContext = {
      score: parsed.data.score,
      takeaways: parsed.data.takeaways,
      topics: parsed.data.topics,
      persona: parsed.data.persona,
      sessionGoal: parsed.data.sessionGoal,
      recommendations: parsed.data.recommendations,
    };

    const queries = buildSearchQueries(ctx, 3);

    const searchResults = await Promise.all(
      queries.map((query) =>
        productCatalog.search(query, {
          limit: 3,
          preferExternal: true,
          persona: ctx.persona,
          sessionGoal: ctx.sessionGoal,
        }),
      ),
    );

    const seenNames = new Set<string>();
    const picks: CuratedPick[] = [];

    for (let i = 0; i < searchResults.length; i++) {
      const result = searchResults[i];
      if (!result) continue;
      for (const item of result.items) {
        const name = item.name.toLowerCase();
        if (seenNames.has(name)) continue;
        seenNames.add(name);

        const isExternal = "url" in item && "source" in item;
        const takeaway = ctx.takeaways[i] || ctx.takeaways[0] || "";

        picks.push({
          source: isExternal ? "external" : "local",
          item,
          reason: `Found based on: "${takeaway.slice(0, 60)}"`,
          triggeredBy: queries[i] || "",
        });
      }
    }

    if (picks.length < 3) {
      const localPicks = scoreLocalPicks(ctx, 5 - picks.length);
      for (const pick of localPicks) {
        if (!seenNames.has(pick.item.name.toLowerCase())) {
          seenNames.add(pick.item.name.toLowerCase());
          picks.push(pick);
        }
      }
    }

    const source = searchResults.some((r) => r.source === "hybrid")
      ? "hybrid"
      : searchResults.some((r) => r.source === "external")
        ? "external"
        : "local";
    const cached = searchResults.every((r) => r.cached);

    return NextResponse.json(
      {
        picks: picks.slice(0, 5),
        queries,
        source,
        cached,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("[curated-shop] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate curated picks" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
