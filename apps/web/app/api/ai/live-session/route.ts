import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { verifySessionToken } from "../verify-payment/route";
import {
  rateLimit,
  RateLimits,
  rateLimitHeaders,
  getClientId,
} from "../../../../lib/utils/rate-limit";

type AIProvider = "venice" | "gemini";

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || "*";
    const clientId = getClientId(request);
    const reqData = await request.json().catch(() => ({}));
    const {
      goal = "daily",
      apiKey,
      provider = "venice" as AIProvider,
      sessionToken,
    } = reqData;
    const byok = typeof apiKey === "string" ? apiKey.trim() : "";

    // Apply general rate limiting
    const generalLimit = await rateLimit(clientId, RateLimits.general);
    if (!generalLimit.allowed) {
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please try again later.",
          retryAfter: Math.ceil((generalLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            ...corsHeaders(origin),
            ...rateLimitHeaders(generalLimit),
            "Retry-After": Math.ceil(
              (generalLimit.resetAt - Date.now()) / 1000,
            ).toString(),
          },
        },
      );
    }

    const goalInstructions: Record<string, string> = {
      event:
        "You are a celebrity stylist helping the user prepare for a special event. Focus on: outfit appropriateness for the event type, formal/casual balance, standout accessories, and confidence-boosting suggestions. Be specific about what works and what to avoid for their event.",
      daily:
        "You are a personal stylist reviewing the user's everyday outfit. Focus on: fit, color coordination, proportions, versatility, and small tweaks that elevate a casual look. Keep suggestions practical and actionable.",
      critique:
        "You are a blunt, honest fashion critic giving real talk about the user's outfit. Focus on: what's working, what's not, specific improvements, and honest ratings. Be direct but constructive — no sugarcoating.",
    };

    const systemInstruction = goalInstructions[goal] || goalInstructions.daily;

    // Build an AG-UI compliant agent manifest for the frontend
    const agentManifest = {
      protocol: "AG-UI v0.1",
      sessionGoal: goal,
      provider: provider,
      plannedSteps:
        provider === "venice"
          ? [
              {
                step: 1,
                action: "intent_parse",
                description: "Parse session goal and configure agent",
              },
              {
                step: 2,
                action: "celo_context",
                description: "Verify Celo wallet + contract availability",
                chain: "celo",
              },
              {
                step: 3,
                action: "vision_analysis",
                description:
                  "Capture and analyze video frames via Venice AI (polling)",
              },
              {
                step: 4,
                action: "style_reasoning",
                description: "Apply goal-aware styling analysis",
              },
              {
                step: 5,
                action: "score_calculation",
                description: "Derive sentiment-weighted style score",
              },
              {
                step: 6,
                action: "celo_mint_proposal",
                description: "Propose NFT mint when score ≥ 8",
                chain: "celo",
              },
            ]
          : [
              {
                step: 1,
                action: "intent_parse",
                description: "Parse session goal and configure agent",
              },
              {
                step: 2,
                action: "celo_context",
                description: "Verify Celo wallet + contract availability",
                chain: "celo",
              },
              {
                step: 3,
                action: "vision_analysis",
                description: "Stream and analyze video frames via Gemini Live",
              },
              {
                step: 4,
                action: "style_reasoning",
                description: "Apply goal-aware styling analysis",
              },
              {
                step: 5,
                action: "score_calculation",
                description: "Derive sentiment-weighted style score",
              },
              {
                step: 6,
                action: "celo_mint_proposal",
                description: "Propose NFT mint when score ≥ 8",
                chain: "celo",
              },
            ],
      celoContracts: {
        nft: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
        cUSD: "0x765DE8164458C172EE097029dfb482Ff182ad001",
      },
    };

    // Venice AI - Free (we provide the API key)
    if (provider === "venice") {
      // Apply Venice-specific rate limiting
      const veniceLimit = await rateLimit(clientId, RateLimits.veniceFree);
      if (!veniceLimit.allowed) {
        return NextResponse.json(
          {
            error:
              "Venice AI session limit reached. Please wait before starting a new session.",
            retryAfter: Math.ceil((veniceLimit.resetAt - Date.now()) / 1000),
            upgradeAvailable: true,
            upgradeMessage:
              "Upgrade to Gemini Live for unlimited sessions (0.5 CELO)",
          },
          {
            status: 429,
            headers: {
              ...corsHeaders(origin),
              ...rateLimitHeaders(veniceLimit),
              "Retry-After": Math.ceil(
                (veniceLimit.resetAt - Date.now()) / 1000,
              ).toString(),
            },
          },
        );
      }

      const veniceApiKey = process.env.VENICE_API_KEY;
      if (!veniceApiKey) {
        return NextResponse.json(
          {
            error:
              "Venice AI Stylist is temporarily unavailable. Please try again later or use Gemini Live.",
          },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      console.log("Provisioning Venice Live AR Session (Free)...", {
        goal,
        clientId,
      });

      return NextResponse.json(
        {
          config: {
            apiKey: veniceApiKey,
            baseURL: "https://api.venice.ai/api/v1",
            model: "mistral-31-24b", // Vision-capable model
            systemInstruction: systemInstruction,
            provider: "venice",
            pollingIntervalMs: 3000,
          },
          agentManifest,
          rateLimit: {
            remaining: veniceLimit.remaining,
            resetAt: veniceLimit.resetAt,
          },
        },
        {
          headers: {
            ...corsHeaders(origin),
            ...rateLimitHeaders(veniceLimit),
          },
        },
      );
    }

    // Gemini Live - Premium (BYOK, session token, or server key required)
    if (provider === "gemini") {
      // Check for session token (from verified CELO payment)
      let isValidToken = false;
      let walletAddress = "";

      if (sessionToken) {
        const tokenPayload = verifySessionToken(sessionToken);
        if (tokenPayload && tokenPayload.provider === "gemini") {
          isValidToken = true;
          walletAddress = tokenPayload.sub;
          console.log("Valid session token found for Gemini Live", {
            wallet: tokenPayload.sub,
            expiresAt: new Date(tokenPayload.exp).toISOString(),
          });
        }
      }

      // Apply Gemini-specific rate limiting (per wallet for token users)
      const geminiKey = isValidToken ? walletAddress : clientId;
      const geminiLimit = await rateLimit(geminiKey, RateLimits.geminiSession);

      if (!geminiLimit.allowed) {
        return NextResponse.json(
          {
            error:
              "Gemini Live session limit reached. Please wait before starting a new session.",
            retryAfter: Math.ceil((geminiLimit.resetAt - Date.now()) / 1000),
          },
          {
            status: 429,
            headers: {
              ...corsHeaders(origin),
              ...rateLimitHeaders(geminiLimit),
              "Retry-After": Math.ceil(
                (geminiLimit.resetAt - Date.now()) / 1000,
              ).toString(),
            },
          },
        );
      }

      const geminiApiKey =
        byok || process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY;

      // If no BYOK, no valid token, and no server key, require payment
      if (!geminiApiKey && !byok && !isValidToken) {
        return NextResponse.json(
          {
            error: "Gemini Live requires payment or your own API key.",
            byokRequired: true,
            paymentRequired: true,
            paymentInfo: {
              currency: "CELO",
              amount: "0.5",
              recipient: "0xdb65806c994C3f55079a6136a8E0886CbB2B64B1",
            },
          },
          { status: 402, headers: corsHeaders(origin) },
        );
      }

      // If user has BYOK, use their key; otherwise use server key
      if (!geminiApiKey && !byok && isValidToken) {
        // Use server's Gemini key for paid users
        return NextResponse.json(
          {
            config: {
              apiKey: process.env.GEMINI_API_KEY || process.env.VERTEX_API_KEY,
              baseURL: "wss://generativelanguage.googleapis.com/ws",
              model: "models/gemini-2.0-flash-live-001",
              systemInstruction: systemInstruction,
              provider: "gemini",
              paidAccess: true,
            },
            agentManifest,
            rateLimit: {
              remaining: geminiLimit.remaining,
              resetAt: geminiLimit.resetAt,
            },
          },
          {
            headers: {
              ...corsHeaders(origin),
              ...rateLimitHeaders(geminiLimit),
            },
          },
        );
      }

      console.log("Provisioning Gemini Live AR Session (Premium)...", {
        goal,
        usingByok: Boolean(byok),
        usingToken: isValidToken,
      });

      return NextResponse.json(
        {
          config: {
            apiKey: geminiApiKey,
            baseURL: "wss://generativelanguage.googleapis.com/ws",
            model: "models/gemini-2.0-flash-live-001",
            systemInstruction: systemInstruction,
            provider: "gemini",
          },
          agentManifest,
          rateLimit: {
            remaining: geminiLimit.remaining,
            resetAt: geminiLimit.resetAt,
          },
        },
        {
          headers: {
            ...corsHeaders(origin),
            ...rateLimitHeaders(geminiLimit),
          },
        },
      );
    }

    return NextResponse.json(
      { error: 'Invalid provider. Use "venice" or "gemini".' },
      { status: 400, headers: corsHeaders(origin) },
    );
  } catch (error) {
    console.error("Live Session provisioning error:", error);
    return NextResponse.json(
      { error: "Failed to provision session" },
      { status: 500 },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
