import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai";
import { logger } from "../../../../lib/utils/logger";

export type ProviderChoice = "auto" | "otari" | "gemini" | "openai" | "venice";

const geminiKey =
  process.env.GEMINI_API_KEY &&
  process.env.GEMINI_API_KEY !== "your_gemini_api_key_here"
    ? process.env.GEMINI_API_KEY
    : null;
const openaiKey =
  process.env.OPENAI_API_KEY &&
  process.env.OPENAI_API_KEY !== "your_openai_api_key_here"
    ? process.env.OPENAI_API_KEY
    : null;
const veniceKey = process.env.VENICE_API_KEY || null;
const otariKey = process.env.OTARI_API_KEY || null;

const geminiClient = geminiKey ? new GoogleGenAI({ apiKey: geminiKey }) : null;
const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

// Otari (Mozilla AI) — primary gateway, OpenAI-compatible
const OTARI_BASE_URL =
  process.env.OTARI_BASE_URL || "https://api.otari.ai/api/v1";
const otariClient = otariKey
  ? new OpenAI({ apiKey: otariKey, baseURL: OTARI_BASE_URL })
  : null;
const otariChatModel =
  process.env.OTARI_CHAT_MODEL || process.env.OTARI_MODEL || null;
const otariVisionModel =
  process.env.OTARI_VISION_MODEL || process.env.OTARI_MODEL || null;

// Venice AI client (OpenAI-compatible, privacy-preserving, no data retention)
const VENICE_BASE_URL = "https://api.venice.ai/api/v1";
const veniceClient = veniceKey
  ? new OpenAI({ apiKey: veniceKey, baseURL: VENICE_BASE_URL })
  : null;

export function geminiAvailable(): boolean {
  return !!geminiClient;
}

export function openaiAvailable(): boolean {
  return !!openaiClient;
}

export function veniceAvailable(): boolean {
  return !!veniceClient;
}

export function otariAvailable(): boolean {
  return !!(otariClient && otariChatModel);
}

export function otariVisionAvailable(): boolean {
  return !!(otariClient && otariVisionModel);
}

/**
 * Get the Venice AI OpenAI-compatible client.
 * Venice AI: privacy-preserving, no data retention.
 * @throws Error if VENICE_API_KEY is not configured
 */
export function getVeniceClient(): OpenAI {
  if (!veniceClient) {
    throw new Error("VENICE_API_KEY not configured");
  }
  return veniceClient;
}

interface GenerateTextOptions {
  prompt: string;
  provider: ProviderChoice;
  preferGemini?: boolean;
  preferOpenAI?: boolean;
  veniceModel?: string; // default: 'llama-3.3-70b'
  geminiModel?: string; // default: 'gemini-3.1-flash-lite-preview'
  openaiModel?: string; // default: 'gpt-4o'
  otariModel?: string; // overrides OTARI_CHAT_MODEL / OTARI_MODEL
  openaiOptions?: {
    max_tokens?: number;
    temperature?: number;
  };
}

export async function generateText({
  prompt,
  provider,
  preferGemini = false,
  preferOpenAI = false,
  veniceModel = "llama-3.3-70b",
  geminiModel = "gemini-3.1-flash-lite-preview",
  openaiModel = "gpt-4o",
  otariModel,
  openaiOptions = {},
}: GenerateTextOptions): Promise<{
  text: string;
  usedProvider: "otari" | "venice" | "gemini" | "openai";
}> {
  const hasOtari = otariAvailable();
  const hasVenice = veniceAvailable();
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  logger.debug("generateText resolving provider", { component: "ai-providers", provider, hasOtari, hasVenice, hasGemini, hasOpenAI });

  // Determine provider
  let selected: "otari" | "venice" | "gemini" | "openai" | null = null;
  if (provider === "otari") {
    selected = hasOtari ? "otari" : null;
  } else if (provider === "venice") {
    selected = hasVenice ? "venice" : null;
  } else if (provider === "gemini") {
    selected = hasGemini ? "gemini" : null;
  } else if (provider === "openai") {
    selected = hasOpenAI ? "openai" : null;
  } else {
    // auto: Otari (primary gateway) → Venice → fallbacks
    if (hasOtari) {
      selected = "otari";
    } else if (hasVenice) {
      selected = "venice";
    } else if (preferGemini && hasGemini) {
      selected = "gemini";
    } else if (preferOpenAI && hasOpenAI) {
      selected = "openai";
    } else if (hasGemini) {
      selected = "gemini";
    } else if (hasOpenAI) {
      selected = "openai";
    } else {
      selected = null;
    }
  }

  if (!selected) {
    logger.error("No AI provider available. Check your environment variables.", { component: "ai-providers" });
    throw new Error(
      "No AI provider available. Please configure OTARI_API_KEY, VENICE_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY in environment variables.",
    );
  }

  try {
    if (selected === "otari") {
      logger.debug("Using Otari", { component: "ai-providers", model: otariModel ?? otariChatModel });
      const response = await otariClient!.chat.completions.create({
        model: otariModel ?? otariChatModel!,
        messages: [{ role: "user", content: prompt }],
        ...openaiOptions,
      });
      const otariResult = response.choices[0]?.message?.content ?? "";
      return { text: otariResult, usedProvider: "otari" };
    }

    if (selected === "venice") {
      logger.debug("Using Venice", { component: "ai-providers", model: veniceModel });
      const response = await veniceClient!.chat.completions.create({
        model: veniceModel,
        messages: [{ role: "user", content: prompt }],
        ...openaiOptions,
      });
      const veniceResult = response.choices[0]?.message?.content ?? "";
      return { text: veniceResult, usedProvider: "venice" };
    }

    if (selected === "gemini") {
      logger.debug("Using Gemini", { component: "ai-providers", model: geminiModel });
      const response = await geminiClient!.models.generateContent({ model: geminiModel, contents: prompt });
      const textResult = response.text;
      return { text: textResult ?? "", usedProvider: "gemini" };
    }

    // OpenAI
    logger.debug("Using OpenAI", { component: "ai-providers", model: openaiModel });
    const response = await openaiClient!.chat.completions.create({
      model: openaiModel,
      messages: [{ role: "user", content: prompt }],
      ...openaiOptions,
    });
    const openaiResult = response.choices[0]?.message?.content ?? "";
    return { text: openaiResult, usedProvider: "openai" };
  } catch (err: any) {
    logger.error(`generateText failed with ${selected}`, { component: "ai-providers", provider: selected }, err);
    throw err;
  }
}

// Helpers to resolve model choices per provider
export type ModelChoice = "pro" | "flash" | "flash-lite" | undefined;

export function resolveGeminiModel(choice: ModelChoice): string {
  switch (choice) {
    case "pro":
      return "gemini-3.1-pro";
    case "flash-lite":
      return "gemini-3.1-flash-lite-preview";
    case "flash":
    default:
      return "gemini-3.1-flash-lite-preview";
  }
}

export function resolveOpenAIModel(choice: ModelChoice): string {
  // Map 'pro' to a stronger reasoning model, else default
  switch (choice) {
    case "pro":
      return "gpt-4o";
    case "flash-lite":
    case "flash":
    default:
      return "gpt-3.5-turbo";
  }
}

// Minimal vision wrappers (image + prompt). Otari first (primary
// gateway), Gemini fallback.
export async function generateVision({
  prompt,
  imageBase64,
  provider = "auto",
  modelChoice,
}: {
  prompt: string;
  imageBase64: string;
  provider?: ProviderChoice;
  modelChoice?: ModelChoice;
}): Promise<{ text: string; usedProvider: "otari" | "gemini" | "openai" }> {
  const hasOtariVision = otariVisionAvailable();
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  let selected: "otari" | "gemini" | "openai" | null = null;
  if (provider === "otari" && hasOtariVision) selected = "otari";
  else if (provider === "gemini" && hasGemini) selected = "gemini";
  else if (provider === "openai" && hasOpenAI) selected = "openai";
  else if (hasOtariVision) selected = "otari";
  else if (hasGemini) selected = "gemini";
  else if (hasOpenAI) selected = "openai";

  if (selected === "otari") {
    const response = await otariClient!.chat.completions.create({
      model: otariVisionModel!,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageBase64.startsWith("data:")
                  ? imageBase64
                  : `data:image/png;base64,${imageBase64}`,
              },
            },
          ],
        },
      ],
    });
    return { text: response.choices[0]?.message?.content ?? "", usedProvider: "otari" };
  }

  if (selected !== "gemini") {
    throw new Error(
      "Vision analysis requires Otari (OTARI_API_KEY + OTARI_VISION_MODEL) or Gemini (GEMINI_API_KEY).",
    );
  }

  const modelId = resolveGeminiModel(modelChoice);
  const response = await geminiClient!.models.generateContent({
    model: modelId,
    contents: [
      { text: prompt },
      {
        inlineData: {
          data: imageBase64,
          mimeType: "image/png",
        },
      },
    ],
  });
  const textResult = response.text;
  return { text: textResult ?? "", usedProvider: "gemini" };
}
