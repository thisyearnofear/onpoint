import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import { logger } from "../../../../lib/utils/logger";

export type ProviderChoice = "auto" | "gemini" | "openai" | "venice";

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

const geminiClient = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;
const openaiClient = openaiKey ? new OpenAI({ apiKey: openaiKey }) : null;

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
  openaiOptions = {},
}: GenerateTextOptions): Promise<{
  text: string;
  usedProvider: "venice" | "gemini" | "openai";
}> {
  const hasVenice = veniceAvailable();
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  logger.debug("generateText resolving provider", { component: "ai-providers", provider, hasVenice, hasGemini, hasOpenAI });

  // Determine provider
  let selected: "venice" | "gemini" | "openai" | null = null;
  if (provider === "venice") {
    selected = hasVenice ? "venice" : null;
  } else if (provider === "gemini") {
    selected = hasGemini ? "gemini" : null;
  } else if (provider === "openai") {
    selected = hasOpenAI ? "openai" : null;
  } else {
    // auto: Prioritize Venice, then fallbacks
    if (hasVenice) {
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
      "No AI provider available. Please configure VENICE_API_KEY, GEMINI_API_KEY or OPENAI_API_KEY in environment variables.",
    );
  }

  try {
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
      const model = geminiClient!.getGenerativeModel({ model: geminiModel });
      const response = await model.generateContent(prompt);
      const textResult = response.response.text();
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

// Minimal Gemini Vision wrapper (image + prompt)
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
}): Promise<{ text: string; usedProvider: "gemini" | "openai" }> {
  const hasGemini = geminiAvailable();
  const hasOpenAI = openaiAvailable();

  // Prefer Gemini for vision; OpenAI vision not implemented in this wrapper
  let selected: "gemini" | "openai" | null = null;
  if (provider === "gemini" && hasGemini) selected = "gemini";
  else if (provider === "openai" && hasOpenAI) selected = "openai";
  else if (hasGemini) selected = "gemini";
  else if (hasOpenAI) selected = "openai";

  if (selected !== "gemini") {
    throw new Error(
      "Vision analysis currently requires Gemini. Configure GEMINI_API_KEY.",
    );
  }

  const modelId = resolveGeminiModel(modelChoice);
  const model = geminiClient!.getGenerativeModel({ model: modelId });
  const response = await model.generateContent([
    { text: prompt },
    {
      inlineData: {
        data: imageBase64,
        mimeType: "image/png",
      },
    },
  ]);
  const textResult = response.response.text();
  return { text: textResult ?? "", usedProvider: "gemini" };
}
