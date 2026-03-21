/**
 * Agent Style API
 *
 * Track user style interactions and get personalized recommendations.
 * Uses stored style preferences from agent-controls middleware.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AgentControls } from "../../../../lib/middleware/agent-controls";
import {
  getRecommendedItems,
  type StylePreferences,
} from "@onpoint/shared-types";
import { corsHeaders } from "../../ai/_utils/http";

const TrackInteractionSchema = z.object({
  userId: z.string().default("default"),
  category: z.string(),
  price: z.number(),
});

const GetRecommendationsSchema = z.object({
  userId: z.string().default("default"),
  limit: z.number().min(1).max(10).default(3),
  excludeIds: z.array(z.string()).default([]),
});

// POST - Track a style interaction
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const body = await request.json();
    const parsed = TrackInteractionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.message },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const { userId, category, price } = parsed.data;

    await AgentControls.initStore("onpoint-stylist");
    AgentControls.trackStyleInteraction(userId, { category, price });

    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Style track error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// GET - Get personalized recommendations
export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const url = new URL(request.url);
  const userId = url.searchParams.get("userId") || "default";
  const limit = parseInt(url.searchParams.get("limit") || "3", 10);
  const excludeParam = url.searchParams.get("excludeIds") || "";
  const excludeIds = excludeParam ? excludeParam.split(",") : [];

  try {
    await AgentControls.initStore("onpoint-stylist");

    const prefs = AgentControls.getStylePreferences(userId);

    const stylePrefs: StylePreferences = {
      categories: prefs.categories,
      priceRange: prefs.priceRange,
      colors: prefs.colors,
    };

    const recommendations = getRecommendedItems(stylePrefs, limit, excludeIds);

    return NextResponse.json(
      {
        recommendations: recommendations.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          category: item.category,
          cover: item.cover,
          averageRating: item.averageRating,
        })),
        preferences: stylePrefs,
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Style recommend error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
