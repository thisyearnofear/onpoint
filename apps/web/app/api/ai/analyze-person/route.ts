import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
export { OPTIONS } from "../_utils/http";
import { logger } from "../../../../lib/utils/logger";

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, _ctx) => {
    try {
      const { photoData } = await req.json();
      const origin = req.headers.get("origin") || "*";

      if (!photoData) {
        return NextResponse.json(
          { error: "Photo data is required" },
          { status: 400, headers: corsHeaders(origin) },
        );
      }

      const veniceApiKey = process.env.VENICE_API_KEY;
      if (!veniceApiKey) {
        return NextResponse.json(
          { error: "Venice API key not configured" },
          { status: 500, headers: corsHeaders(origin) },
        );
      }

      logger.info("Analyzing person appearance...", { component: "analyze-person" });

      const visionResponse = await fetch(
        "https://api.venice.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${veniceApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "mistral-31-24b",
            messages: [
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this person's physical appearance in detail. Describe their: gender, age range, ethnicity, body type/shape, height (tall/average/short), build (slim/athletic/average/full), skin tone, hair style and color, eye color if visible, facial features, and any distinctive characteristics. Provide a comprehensive but concise description that would help create a personalized fashion image that looks exactly like this person. Be specific and factual.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: photoData,
                    },
                  },
                ],
              },
            ],
            max_tokens: 250,
          }),
        },
      );

      if (!visionResponse.ok) {
        const errorText = await visionResponse.text();
        logger.error("Vision analysis failed", {
          component: "analyze-person",
          status: visionResponse.status,
          errorText,
        });
        return NextResponse.json(
          { error: "Failed to analyze person" },
          { status: 500, headers: corsHeaders(origin) },
        );
      }

      const visionData = await visionResponse.json();
      const description = visionData.choices?.[0]?.message?.content || "";

      logger.info("Person analysis complete", { component: "analyze-person" });

      return NextResponse.json(
        {
          description: description.trim(),
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Person analysis error", { component: "analyze-person" }, error);
      return NextResponse.json(
        { error: "Failed to analyze person" },
        { status: 500 },
      );
    }
  })(request);
}

