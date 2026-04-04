import { NextRequest, NextResponse } from "next/server";
import { generateText } from "../_utils/providers";
import { corsHeaders } from "../_utils/http";

function extractMeasurement(text: string, bodyPart: string): string | null {
  const sizeWords = ["small", "medium", "large", "extra small", "extra large"];
  const regex = new RegExp(`${bodyPart}[:\\s]*([^\\n]*?)(?=\\n|$)`, "i");
  const match = text.match(regex);

  if (match && match[1]) {
    const measurementValue = match[1];
    const found = sizeWords.find((size) =>
      measurementValue.toLowerCase().includes(size),
    );
    return found || "medium";
  }
  return null;
}

function extractRecommendations(text: string): string[] {
  const recommendations: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (
      line.includes("recommend") ||
      line.includes("suggest") ||
      line.includes("try") ||
      line.includes("consider")
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, "").trim();
      if (cleaned.length > 10) {
        recommendations.push(cleaned);
      }
    }
  }

  return recommendations.length > 0 ? recommendations.slice(0, 4) : [];
}

function extractStyleAdjustments(text: string): string[] {
  const adjustments: string[] = [];
  const lines = text.split("\n");

  for (const line of lines) {
    if (
      line.includes("adjust") ||
      line.includes("balance") ||
      line.includes("enhance") ||
      line.includes("flatter")
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, "").trim();
      if (cleaned.length > 10) {
        adjustments.push(cleaned);
      }
    }
  }

  return adjustments.length > 0 ? adjustments.slice(0, 3) : [];
}

function extractStructuredStylingTips(text: string): {
  textTips: string[];
  structuredTips: Array<{
    text: string;
    action?: { type: string; label: string; payload: string };
  }>;
} {
  try {
    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0 && parsed[0]?.text) {
      const valid = parsed
        .slice(0, 4)
        .filter((item: any) => typeof item.text === "string");
      return {
        textTips: valid.map((item: any) => item.text),
        structuredTips: valid.map((item: any) => ({
          text: item.text,
          action:
            item.action &&
            item.action.type &&
            item.action.label &&
            item.action.payload
              ? item.action
              : undefined,
        })),
      };
    }
  } catch {
    // Fall back
  }

  const tips: string[] = [];
  const lines = text.split("\n");
  for (const line of lines) {
    const isTipLine =
      /^\d+\./.test(line) ||
      /^[-•*]/.test(line) ||
      /\b(tip|style|wear|pair|color|accessory|fit|flatter|enhance|complement)\b/i.test(
        line,
      );
    if (isTipLine) {
      const cleaned = line
        .replace(/^\d+\.?\s*/, "")
        .replace(/^[-•*]\s*/, "")
        .trim();
      if (cleaned.length > 10 && cleaned.length < 200) {
        tips.push(cleaned);
      }
    }
  }
  if (tips.length === 0) {
    const sentences = text
      .split(/[.!?]+/)
      .filter((s) => s.trim().length > 20 && s.trim().length < 150);
    tips.push(...sentences.slice(0, 4));
  }
  const textTips =
    tips.length > 0
      ? tips.slice(0, 4)
      : [
          "Layer pieces to add depth and dimension to your outfit",
          "Choose accessories that complement your personal style",
          "Ensure proper fit for comfort and confidence",
          "Consider the color harmony of your complete look",
        ];
  return { textTips, structuredTips: textTips.map((text) => ({ text })) };
}

function extractStylingTips(text: string): string[] {
  return extractStructuredStylingTips(text).textTips;
}

function extractOutfitRecommendations(
  text: string,
): Array<{ item: string; reason: string; priority: number }> {
  const recommendations: Array<{
    item: string;
    reason: string;
    priority: number;
  }> = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length && recommendations.length < 5; i++) {
    const line = lines[i];
    if (
      line &&
      (line.includes("recommend") ||
        line.includes("suggest") ||
        line.includes("add") ||
        line.includes("try"))
    ) {
      const cleaned = line.replace(/^\d+\.?\s*/, "").trim();
      if (cleaned.length > 10) {
        recommendations.push({
          item: cleaned,
          reason: "Based on style analysis",
          priority: recommendations.length + 1,
        });
      }
    }
  }
  return recommendations.length > 0
    ? recommendations
    : [
        {
          item: "Consider color coordination",
          reason: "Enhances overall look",
          priority: 1,
        },
        {
          item: "Add complementary accessories",
          reason: "Completes the outfit",
          priority: 2,
        },
        {
          item: "Pay attention to fit and proportions",
          reason: "Ensures flattering silhouette",
          priority: 3,
        },
      ];
}

function parseVirtualTryOnResponse(
  aiResponse: string,
  type: string,
  originalData: { items?: Array<{ name: string; description?: string }> },
) {
  if (type === "body-analysis") {
    const bodyTypeMatch = aiResponse.match(/body type[:\s]*(\w+)/i);
    const bodyType = bodyTypeMatch ? bodyTypeMatch[1] : "average";
    const measurements = {
      shoulders: extractMeasurement(aiResponse, "shoulders") || "medium",
      chest: extractMeasurement(aiResponse, "chest") || "medium",
      waist: extractMeasurement(aiResponse, "waist") || "medium",
      hips: extractMeasurement(aiResponse, "hips") || "medium",
    };
    const fitRecommendations = extractRecommendations(aiResponse);
    const styleAdjustments = extractStyleAdjustments(aiResponse);
    return {
      bodyType,
      measurements,
      fitRecommendations,
      styleAdjustments,
      analysis: aiResponse,
    };
  } else if (type === "outfit-fit" || type === "enhancement") {
    const stylingTips = extractStylingTips(aiResponse);
    const recommendations = extractOutfitRecommendations(aiResponse);
    return {
      stylingTips,
      recommendations,
      analysis: aiResponse,
      enhancedOutfit: originalData.items || [],
    };
  }
  return { analysis: aiResponse };
}

export async function POST(request: NextRequest) {
  try {
    const { type, data, provider = "auto", model } = await request.json();
    const origin = request.headers.get("origin") || "*";

    if (!type)
      return NextResponse.json(
        { error: "Analysis type is required" },
        { status: 400, headers: corsHeaders(origin) },
      );

    let enhancedPrompt = "";
    if (type === "body-analysis") {
      enhancedPrompt = `As a fashion fit specialist, analyze this body profile: "${data.description || "Standard body measurements"}". Keep it practical and focused on measurements and fit.`;
    } else if (type === "outfit-fit") {
      enhancedPrompt = `As a fashion stylist, analyze how these outfit items would work together: "${data.items?.map((item: any) => `${item.name}: ${item.description || item.type || ""}`).join(", ")}". Provide actionable styling advice.`;
    } else if (type === "enhancement") {
      enhancedPrompt = `As a virtual styling consultant, enhance this outfit combination: "${data.items?.map((item: any) => `${item.name}: ${item.description || ""}`).join(", ")}".`;
    } else {
      enhancedPrompt = `As a fashion consultant, provide analysis for: ${type}`;
    }

    if (type === "generate-outfit-image") {
      const veniceApiKey = process.env.VENICE_API_KEY;
      if (!veniceApiKey)
        return NextResponse.json(
          { error: "Venice API key not configured" },
          { status: 500, headers: corsHeaders(origin) },
        );

      const personDescription = data.personDescription || "";
      const outfitDescription = data.items
        ?.map((item: any) => `${item.name}: ${item.description || ""}`)
        .join(", ");

      const veniceResponse = await fetch(
        "https://api.venice.ai/api/v1/image/generate",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${veniceApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "venice-sd35",
            prompt: `Create a high-quality fashion photograph. ${personDescription ? `Person: ${personDescription}. ` : ""}Wearing: ${outfitDescription}. Full-body portrait, professional photography.`,
            width: 512,
            height: 768,
            format: "webp",
          }),
        },
      );

      if (!veniceResponse.ok)
        throw new Error(`Venice API error: ${veniceResponse.status}`);
      const veniceData = await veniceResponse.json();

      let personalizedTips: string[] = [];
      let structuredTips: any[] = [];
      if (personDescription) {
        const tipsResponse = await generateText({
          prompt: `Styling tips for: ${personDescription} wearing ${outfitDescription}. Return JSON: [{"text": "...", "action": {...}}]`,
          provider,
          geminiModel: "gemini-3.1-flash-lite-preview",
          openaiModel: "gpt-4o",
        });
        const parsed = extractStructuredStylingTips(tipsResponse.text || "");
        personalizedTips = parsed.textTips;
        structuredTips = parsed.structuredTips;
      }

      return NextResponse.json(
        {
          generatedImage: veniceData.images[0],
          enhancedOutfit: data.items || [],
          stylingTips: personalizedTips.length
            ? personalizedTips
            : ["Layer up", "Accessorize", "Check fit", "Color harmony"],
          structuredTips,
          type,
        },
        { headers: corsHeaders(origin) },
      );
    }

    const modelChoice = model as "pro" | "flash" | "flash-lite" | undefined;
    const { text, usedProvider } = await generateText({
      prompt: enhancedPrompt,
      provider,
      geminiModel:
        modelChoice === "pro" ? "gemini-3.1-pro" : "gemini-3.1-flash-lite-preview",
      openaiModel: modelChoice === "pro" ? "gpt-4o" : "gpt-4o-mini",
    });

    const analysisData = parseVirtualTryOnResponse(text || "", type, data);
    return NextResponse.json(
      { ...analysisData, provider: usedProvider, type },
      { headers: corsHeaders(origin) },
    );
  } catch (error: any) {
    console.error("AI virtual try-on error:", error);
    const origin = request.headers.get("origin") || "*";
    return NextResponse.json(
      { 
        error: error.message || "Failed to process virtual try-on",
        details: error.stack && process.env.NODE_ENV === "development" ? error.stack : undefined
      }, 
      { 
        status: error.status || 500, 
        headers: corsHeaders(origin) 
      }
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  return new NextResponse(null, { status: 204, headers: corsHeaders(origin) });
}
