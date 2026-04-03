import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import {
  rateLimit,
  RateLimits,
  rateLimitHeaders,
  getClientId,
} from "../../../../lib/utils/rate-limit";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

const VENICE_API_URL = "https://api.venice.ai/api/v1";

interface VeniceAnalyzeRequest {
  image: string; // base64 encoded image
  goal: string;
  systemInstruction?: string;
}

// Goal-aware prompt templates
const PROMPTS_BY_GOAL: Record<string, string[]> = {
  event: [
    "Analyze this outfit for a formal event. Focus on elegance, appropriateness, and sophistication.",
    "Evaluate if this look works for a special occasion. Check dress code alignment.",
    "Assess the silhouette and fit for evening wear standards.",
  ],
  daily: [
    "Analyze this everyday outfit. Focus on comfort, coordination, and practicality.",
    "Evaluate this casual look for daily wear. Check color harmony and balance.",
    "Assess the overall aesthetic for everyday style.",
  ],
  critique: [
    "Give an honest critique of this outfit. Be direct about what works and what doesn't.",
    "Analyze this look critically. Point out specific issues and strengths.",
    "Provide blunt fashion feedback. No sugarcoating.",
  ],
};

// Track frame count per session for prompt rotation
const sessionFrameCount = new Map<string, number>();

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    const origin = req.headers.get("origin") || "*";
    const clientId = getClientId(req);

    try {
      // Rate limit Venice analysis
      const rateLimitResult = await rateLimit(
        `venice-analyze:${clientId}`,
        RateLimits.veniceBurst,
      );

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error:
              "Rate limit reached. Please wait before sending more frames.",
            retryAfter: Math.ceil(
              (rateLimitResult.resetAt - Date.now()) / 1000,
            ),
          },
          {
            status: 429,
            headers: {
              ...corsHeaders(origin),
              ...rateLimitHeaders(rateLimitResult),
            },
          },
        );
      }

      const body: VeniceAnalyzeRequest = await req.json();
      const { image, goal, systemInstruction } = body;

      if (!image || !goal) {
        return NextResponse.json(
          { error: "Missing required fields: image, goal" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const veniceApiKey = process.env.VENICE_API_KEY;
      if (!veniceApiKey) {
        return NextResponse.json(
          { error: "Venice AI is temporarily unavailable" },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      // Get prompt for goal
      const prompts = PROMPTS_BY_GOAL[goal] ?? PROMPTS_BY_GOAL.daily ?? [];
      const frameCount = (sessionFrameCount.get(clientId) ?? 0) + 1;
      sessionFrameCount.set(clientId, frameCount);
      const prompt =
        prompts[(frameCount - 1) % prompts.length] ??
        prompts[0] ??
        "Analyze this outfit.";

      // Strip data URL prefix if present
      const base64Image = image.replace(/^data:image\/\w+;base64,/, "");

      // Call Venice AI
      const response = await fetch(`${VENICE_API_URL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${veniceApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "mistral-31-24b",
          messages: [
            {
              role: "system",
              content:
                systemInstruction ||
                "You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:image/jpeg;base64,${base64Image}`,
                  },
                },
              ],
            },
          ],
          max_tokens: 150,
          temperature: 0.7,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Venice API error:", response.status, errorText);
        return NextResponse.json(
          { error: "Venice AI analysis failed" },
          { status: 502, headers: corsHeaders(origin) },
        );
      }

      const data = await response.json();
      const analysis = data.choices?.[0]?.message?.content ?? "";

      return NextResponse.json(
        {
          analysis,
          frameCount,
          remaining: rateLimitResult.remaining,
        },
        {
          headers: {
            ...corsHeaders(origin),
            ...rateLimitHeaders(rateLimitResult),
          },
        },
      );
    } catch (error) {
      console.error("Venice analyze error:", error);
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
