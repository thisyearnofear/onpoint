import { NextRequest, NextResponse } from "next/server";
import { generateText } from "../_utils/providers";
import { corsHeaders } from "../_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const { prompt, provider = "auto", model } = await req.json();
      const origin = req.headers.get("origin") || "*";

      if (!prompt) {
        return NextResponse.json(
          { error: "Prompt is required" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const modelChoice = model as "pro" | "flash" | "flash-lite" | undefined;
      const { text, usedProvider } = await generateText({
        prompt,
        provider,
        preferGemini: false,
        preferOpenAI: true,
        geminiModel: modelChoice
          ? (await import("../_utils/providers")).resolveGeminiModel(
              modelChoice,
            )
          : "gemini-3.1-flash-lite-preview",
        openaiModel: modelChoice
          ? (await import("../_utils/providers")).resolveOpenAIModel(
              modelChoice,
            )
          : "gpt-3.5-turbo",
        openaiOptions: { max_tokens: 1000 },
      });
      const result = text;

      return NextResponse.json(
        { result, provider: provider === "auto" ? usedProvider : provider },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      console.error("AI analysis error:", error);
      return NextResponse.json(
        { error: "Failed to analyze with AI" },
        { status: 500 },
      );
    }
  })(request);
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
