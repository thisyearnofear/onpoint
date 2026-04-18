import { NextRequest, NextResponse } from "next/server";
import { generateText } from "../_utils/providers";
import { corsHeaders } from "../_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../_utils/http";
import { logger } from "../../../../lib/utils/logger";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const {
        imageBase64,
        persona,
        mode,
        config,
        provider = "auto",
        userContext,
      } = await req.json();
      const origin = req.headers.get("origin") || "*";

      if (!imageBase64 || !persona || !config) {
        return NextResponse.json(
          {
            error: "Image data, persona, and config are required",
          },
          {
            status: 400,
            headers: corsHeaders(origin),
          },
        );
      }

      // ── Identity-Based Personalization ──
      let contextInjection = "";
      if (userContext) {
        const level = userContext.xp ? Math.floor(userContext.xp / 100) + 1 : 1;
        const badgeList = userContext.badges?.join(", ") || "none";

        contextInjection = `
[USER IDENTITY CONTEXT]
- Style Level: ${level}
- Achievements: ${badgeList}
- Celo Native: ${userContext.isCeloUser ? "Yes" : "No"}

Tailor your critique tone to their level. ${level > 5 ? "Be sophisticated and technical." : "Be encouraging and educational."}
${userContext.isCeloUser ? "They are part of the Celo fashion community." : ""}
`;
      }

      // Create the enhanced prompt for personality-based critique
      const enhancedPrompt = `${config.prompt}

${contextInjection}

Please analyze the outfit in this image and provide a critique that matches your personality and expertise. 
Consider:
1. Overall style and aesthetic
2. Fit and proportions
3. Color coordination
4. Appropriateness for different occasions
5. Specific improvements or suggestions
6. What's working well

Keep your response engaging and true to your character while being genuinely helpful.`;

      // For now, we'll use text-based analysis since image analysis requires special handling
      // In a production environment, you'd process the actual image
      const { text, usedProvider } = await generateText({
        prompt: enhancedPrompt,
        provider,
        preferGemini: false,
        preferOpenAI: true,
        geminiModel: "gemini-3.1-flash-lite-preview",
        openaiModel: config.model || "gpt-4o-mini",
        openaiOptions: {
          max_tokens: config.maxTokens || 400,
          temperature: config.temperature || 0.7,
        },
      });

      return NextResponse.json(
        {
          critique: text || "Unable to generate critique at this time.",
          persona,
          mode,
          provider: provider === "auto" ? usedProvider : provider,
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("AI personality critique error", { component: "personality-critique" }, error);
      return NextResponse.json(
        {
          error: "Failed to generate personality critique",
        },
        {
          status: 500,
        },
      );
    }
  })(request);
}

