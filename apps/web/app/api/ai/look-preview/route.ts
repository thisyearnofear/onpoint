/**
 * Look Preview API Route
 *
 * Public endpoint (no auth required) for the landing page LookCrafter widget.
 * Generates a text-based outfit preview: score + critique + palette description.
 *
 * Design rationale:
 * - PUBLIC: The landing page works without sign-up, so this endpoint cannot require auth
 * - TEXT-ONLY: No image input — generates a descriptive "look" based on occasion, vibe, persona
 * - PROGRESSIVE ENHANCEMENT: Called after the pre-canned result is shown; improves the result if it completes
 * - LIGHTWEIGHT: Short timeout, fast model, minimal prompt
 */

import { NextRequest, NextResponse } from "next/server";
import { generateText } from "../_utils/providers";
import { corsHeaders } from "../_utils/http";
export { OPTIONS } from "../_utils/http";
import { logger } from "../../../../lib/utils/logger";

// Simple in-memory rate limiter for public endpoint
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // requests per window
const RATE_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin") || "*";

    // Simple rate limiting
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again shortly." },
        { status: 429, headers: corsHeaders(origin) },
      );
    }

    const {
      occasion = "casual",
      vibe = "minimalist",
      persona = "miranda",
      bodyType,
      critiqueMode = "real",
    } = await request.json();

    // Build persona-aware prompt using the personality descriptions
    const personaIntro: Record<string, string> = {
      miranda:
        "You are Miranda Priestly — ice-cold precision, devastating understatement. You never raise your voice. You're devastating in a whisper.",
      edina:
        "You are Edina Monsoon — DRAMATIC, LOUD, absolutely convinced that more is more. You say 'darling' and 'fabulous' constantly.",
      shaft:
        "You are John Shaft — cool, confident, economical with words. You state facts. You don't over-explain.",
    };

    const modeModifier: Record<string, string> = {
      real: "Give honest, balanced feedback — both what works and what could improve.",
      roast: "Be brutally honest and witty. Roast the outfit like you're at a comedy club. Make it sting but make it funny.",
      flatter:
        "Be incredibly encouraging. Find the positive in everything. Make this person feel amazing about their style.",
    };

    const personaVoice =
      personaIntro[persona as keyof typeof personaIntro] || personaIntro.miranda;
    const modeInstruction =
      modeModifier[critiqueMode as keyof typeof modeModifier] ||
      modeModifier.real;

    const bodyContext = bodyType
      ? `The person has a ${bodyType} body type. Consider this in your critique.`
      : "";

    const prompt = `${personaVoice}

${modeInstruction}

Rate this outfit concept:
- Occasion: ${occasion}
- Style vibe: ${vibe}
${bodyContext}

Write a brief critique (2-3 sentences) in your signature voice. Then give a score out of 10 at the end as "SCORE: X/10".

Focus on: silhouette, palette, occasion-appropriateness, and one actionable suggestion.`;

    const { text, usedProvider } = await generateText({
      prompt,
      provider: "auto",
      preferGemini: true,
      preferOpenAI: false,
      geminiModel: "gemini-3.1-flash-lite-preview",
      openaiModel: "gpt-3.5-turbo",
      openaiOptions: { max_tokens: 300, temperature: 0.8 },
    });

    if (!text) {
      return NextResponse.json(
        { error: "No response generated" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }

    // Extract score from the response
    const scoreMatch = text.match(/SCORE:\s*(\d+)\/10/i);
    const score = scoreMatch ? Math.max(1, Math.min(10, parseInt(scoreMatch[1]!, 10))) : null;

    // Clean the response text: remove the SCORE line
    const critique = text.replace(/SCORE:\s*\d+\/10\s*/i, "").trim();

    return NextResponse.json(
      {
        score,
        critique,
        provider: usedProvider,
      },
      { headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Look preview generation error", { component: "look-preview" }, error);
    return NextResponse.json(
      { error: "Failed to generate look preview" },
      { status: 500 },
    );
  }
}
