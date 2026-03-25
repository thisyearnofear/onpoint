/**
 * Agent Style API
 *
 * Track user style interactions and get personalized recommendations.
 * Uses stored style preferences from agent-controls middleware.
 *
 * Authentication: Required (style data is user-specific)
 * Rate Limiting: 60 req/min (free), 500 req/min (premium)
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AgentControls } from "../../../../lib/middleware/agent-controls";
import {
  getRecommendedItems,
  type StylePreferences,
} from "@onpoint/shared-types";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

const TrackInteractionSchema = z.object({
  userId: z.string().default("default"),
  category: z.string(),
  price: z.number(),
  sessionGoal: z.enum(["event", "daily", "critique"]).optional(),
});

const GetRecommendationsSchema = z.object({
  userId: z.string().default("default"),
  limit: z.number().min(1).max(10).default(3),
  excludeIds: z.array(z.string()).default([]),
});

// POST - Track a style interaction (requires auth)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const parsed = TrackInteractionSchema.safeParse(body);

      if (!parsed.success) {
        return NextResponse.json(
          { error: parsed.error.message },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const { userId, category, price, sessionGoal } = parsed.data;

      // Use authenticated user ID if userId matches default
      const effectiveUserId = userId === "default" ? ctx.userId : userId;

      await AgentControls.initStore("onpoint-stylist");
      AgentControls.trackStyleInteraction(effectiveUserId, { category, price });

      // Seed style preferences based on session goal for first-time users
      if (sessionGoal) {
        const prefs = AgentControls.getStylePreferences(effectiveUserId);
        // If no existing preferences, seed based on session goal
        if (prefs.categories.length === 0 && prefs.colors.length === 0) {
          const goalSeeds: Record<
            string,
            { categories: string[]; colors: string[] }
          > = {
            event: {
              categories: ["dress", "jacket", "accessory"],
            colors: ["black", "navy", "burgundy", "gold"],
          },
          daily: {
            categories: ["shirt", "denim", "sneaker"],
            colors: ["white", "blue", "gray", "beige"],
          },
          critique: {
            categories: ["shirt", "trouser"],
            colors: ["neutral"],
          },
        };
        const seed = goalSeeds[sessionGoal];
        if (seed) {
          AgentControls.trackStyleInteraction(userId, {
            category: seed.categories[0]!,
            price: 50,
          });
        }
      }
    }

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
  })(request);
}

// GET - Get personalized recommendations (requires auth)
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    // Use authenticated user ID
    const userId = ctx.userId;
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
  })(request);
}

// OPTIONS - CORS preflight
export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders(request.headers.get("origin") ?? undefined),
  });
}
