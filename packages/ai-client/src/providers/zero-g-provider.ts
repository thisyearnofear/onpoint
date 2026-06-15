/**
 * ZeroGProvider — 0G Compute Network as an AIProvider in ai-client.
 *
 * 0G Router is OpenAI Chat Completions compatible, so this provider
 * calls the same shape as the OpenAI provider but points at
 * https://router-api.0g.ai/v1 and defaults to a vision-capable model
 * (qwen3-vl-30b) that we've verified on the live catalog.
 *
 * Constraint: 0G has no WebSocket live-session endpoint, so
 * `connectLiveSession()` is not supported. The live-session factories
 * surface 0G as a polling-based option and let the existing
 * Gemini factory remain the premium terminal.
 *
 * Server-side calls flow through /api/ai/zerog-analyze (the Hetzner
 * Express route) so the API key never reaches the browser. When the
 * client is constructed without a base URL it routes via the server
 * proxy automatically.
 */

import OpenAI from "openai";
import type {
  AIProvider,
  AnalysisInput,
  CritiqueResponse,
  DesignGeneration,
  StylistPersona,
  StylistResponse,
  UserStyleContext,
  VirtualTryOnAnalysis,
} from "./base-provider";

export interface ZeroGProviderConfig {
  /** Optional direct API key (server-side only). */
  apiKey?: string;
  /** Override base URL. Default: https://router-api.0g.ai/v1. */
  baseURL?: string;
  /** Default vision model. Default: qwen3-vl-30b. */
  defaultModel?: string;
  /** Default chat model. Default: same as defaultModel. */
  chatModel?: string;
  /**
   * Server proxy URL. When set, all calls go through this proxy and
   * the API key is never exposed to the client. The web app sets this
   * to "/api/ai/zerog".
   */
  proxyURL?: string;
}

const DEFAULT_BASE_URL = "https://router-api.0g.ai/v1";
const DEFAULT_MODEL = "qwen3-vl-30b";

const PERSONA_PROMPTS: Record<StylistPersona, string> = {
  luxury:
    "You are a luxury fashion stylist with expertise in high-end designer pieces, couture, and sophisticated styling.",
  streetwear:
    "You are a streetwear fashion expert with deep knowledge of urban fashion, sneaker culture, and contemporary trends.",
  sustainable:
    "You are a sustainable fashion consultant specializing in eco-friendly, ethical, and slow fashion.",
  edina:
    "You are Edina Monsoon from Absolutely Fabulous! Dramatic, fabulous, obsessed with trends. Use 'darling' and 'sweetie'.",
  miranda:
    "You are Miranda Priestly from The Devil Wears Prada. Authoritative, sharp taste, impossibly high standards.",
  shaft:
    "You channel John Shaft's 1970s cool. Leather jackets, turtlenecks, fitted pants, smooth confidence.",
};

const CRITIQUE_PROMPT = `Analyze this outfit photo and respond with strict JSON matching this shape:
{
  "rating": number 1-10,
  "strengths": string[] (3-4 items),
  "improvements": string[] (2-3 items),
  "styleNotes": string,
  "confidence": number 0-1
}
No markdown, no commentary — return the JSON object only.`;

export class ZeroGProvider implements AIProvider {
  name = "0G Compute";
  private openai: OpenAI | null = null;
  private defaultModel: string;
  private chatModel: string;
  private proxyURL: string | null;
  private apiKey: string | null;

  constructor(config: ZeroGProviderConfig = {}) {
    this.defaultModel = config.defaultModel ?? DEFAULT_MODEL;
    this.chatModel = config.chatModel ?? this.defaultModel;
    this.proxyURL = config.proxyURL ?? null;
    this.apiKey = config.apiKey ?? null;

    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
        baseURL: config.baseURL ?? DEFAULT_BASE_URL,
      });
    }
  }

  /** Server-side only: returns the client, or null if no key. */
  isConfigured(): boolean {
    return this.openai !== null;
  }

  /** Used by the live-session factory health check. */
  async isAvailable(): Promise<boolean> {
    try {
      if (this.proxyURL) {
        const r = await fetch(this.proxyURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [{ role: "user", content: "ping" }],
            max_tokens: 1,
          }),
        });
        return r.ok;
      }
      if (this.openai) {
        await this.openai.chat.completions.create({
          model: this.defaultModel,
          messages: [{ role: "user", content: "ping" }],
          max_tokens: 1,
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  async analyzeOutfit(input: AnalysisInput): Promise<CritiqueResponse> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a professional fashion stylist. Respond with strict JSON, no markdown, no commentary.",
      },
    ];

    if (input.image instanceof File) {
      // Convert File to data URL (browser-side path)
      const dataUrl = await fileToDataUrl(input.image);
      messages.push({
        role: "user",
        content: [
          { type: "text", text: CRITIQUE_PROMPT + (input.description ? `\n\nDescription: ${input.description}` : "") },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      });
    } else {
      messages.push({
        role: "user",
        content: CRITIQUE_PROMPT + (input.description ? `\n\nDescription: ${input.description}` : ""),
      });
    }

    const content = await this.callChat(messages, { maxTokens: 800 });
    return safeParseCritique(content);
  }

  async generateDesign(prompt: string): Promise<DesignGeneration> {
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a creative fashion designer AI. Generate detailed clothing designs based on user descriptions.",
      },
      {
        role: "user",
        content: `Create a detailed fashion design based on this vision: "${prompt}". Include: 1. Main garment description with silhouette and fit, 2. Fabric and material suggestions, 3. Color palette (3-5 colors), 4. Key design details and embellishments, 5. Styling suggestions, 6. Target occasion/lifestyle. Keep it practical and achievable.`,
      },
    ];

    const content = await this.callChat(messages, { maxTokens: 600 });
    return {
      id: `zerog-design-${Date.now()}`,
      description: content,
      designPrompt: prompt,
      variations: [],
      tags: [],
      timestamp: Date.now(),
    };
  }

  async chatWithStylist(
    message: string,
    persona: StylistPersona,
    context?: UserStyleContext,
  ): Promise<StylistResponse> {
    const contextStr = context
      ? `\n[USER CONTEXT]
Style Level: ${Math.floor((context.xp || 0) / 100) + 1}
Achievements: ${context.badges?.join(", ") || "none"}
Celo Native: ${context.isCeloUser ? "Yes" : "No"}

Tailor your tone to their level. ${Math.floor((context.xp || 0) / 100) + 1 > 5 ? "Be sophisticated." : "Be educational."}`
      : "";

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: PERSONA_PROMPTS[persona] + contextStr,
      },
      {
        role: "user",
        content: `${message}\n\nPlease provide: 1. A helpful, personalized response in your styling expertise, 2. 3-5 specific clothing/styling recommendations with reasons, 3. 2-3 actionable styling tips. Keep the tone friendly and professional, matching the ${persona} aesthetic.`,
      },
    ];

    const content = await this.callChat(messages, { maxTokens: 500 });
    return parseStylistResponse(content, message);
  }

  async analyzePhoto(file: File): Promise<VirtualTryOnAnalysis> {
    const dataUrl = await fileToDataUrl(file);
    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content:
          "You are a fashion fit specialist. Be body-positive. Respond with strict JSON matching the requested shape.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: 'Analyze this fashion photo and return JSON: {"bodyType": string, "measurements": {"shoulders": string, "chest": string, "waist": string, "hips": string}, "fitRecommendations": string[] (5 items), "styleAdjustments": string[] (3 items), "score": number 1-10, "confidence": number 0-1}',
          },
          { type: "image_url", image_url: { url: dataUrl } },
        ],
      },
    ];

    const content = await this.callChat(messages, { maxTokens: 600 });
    return safeParseTryOn(content);
  }

  /**
   * 0G Router is HTTP-only. We deliberately do NOT implement
   * `connectLiveSession` — the live-session factories surface 0G as a
   * polling-based option and let the existing Gemini factory remain
   * the premium terminal.
   */
  // connectLiveSession: not implemented for 0G.

  /** Internal: route via proxy (browser) or direct (server). */
  private async callChat(
    messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    options: { maxTokens: number; model?: string },
  ): Promise<string> {
    if (this.proxyURL) {
      const r = await fetch(this.proxyURL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: options.model ?? this.chatModel,
          messages,
          max_tokens: options.maxTokens,
        }),
      });
      if (!r.ok) {
        const errBody = await r.json().catch(() => ({}));
        throw new Error(
          `ZeroG proxy error ${r.status}: ${errBody.error?.message ?? r.statusText}`,
        );
      }
      const data = await r.json();
      return data.choices?.[0]?.message?.content ?? "";
    }

    if (!this.openai) {
      throw new Error(
        "ZeroGProvider: no apiKey configured and no proxyURL set. Configure ZERO_G_API_KEY in the server env, or use the /api/ai/zerog proxy from the browser.",
      );
    }
    const completion = await this.openai.chat.completions.create({
      model: options.model ?? this.chatModel,
      messages,
      max_tokens: options.maxTokens,
    });
    return completion.choices[0]?.message?.content ?? "";
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  // Browser-only path
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function safeParseCritique(content: string): CritiqueResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      rating: Number(parsed.rating) || 5,
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
      styleNotes: String(parsed.styleNotes ?? ""),
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch {
    return {
      rating: 5,
      strengths: [],
      improvements: [],
      styleNotes: content,
      confidence: 0.3,
    };
  }
}

function safeParseTryOn(content: string): VirtualTryOnAnalysis {
  try {
    const parsed = JSON.parse(content);
    return {
      bodyType: String(parsed.bodyType ?? "varies"),
      measurements: {
        shoulders: String(parsed.measurements?.shoulders ?? "Standard"),
        chest: String(parsed.measurements?.chest ?? "Standard"),
        waist: String(parsed.measurements?.waist ?? "Standard"),
        hips: String(parsed.measurements?.hips ?? "Standard"),
      },
      fitRecommendations: Array.isArray(parsed.fitRecommendations)
        ? parsed.fitRecommendations
        : [],
      styleAdjustments: Array.isArray(parsed.styleAdjustments)
        ? parsed.styleAdjustments
        : [],
      score: Number(parsed.score) || 5,
      confidence: Number(parsed.confidence) || 0.5,
    };
  } catch {
    return {
      bodyType: "varies",
      measurements: {
        shoulders: "Standard",
        chest: "Standard",
        waist: "Standard",
        hips: "Standard",
      },
      fitRecommendations: [],
      styleAdjustments: [],
      score: 5,
      confidence: 0.3,
    };
  }
}

function parseStylistResponse(content: string, fallback: string): StylistResponse {
  try {
    const parsed = JSON.parse(content);
    return {
      message: parsed.message ?? content,
      recommendations: Array.isArray(parsed.recommendations)
        ? parsed.recommendations
        : [],
      stylingTips: Array.isArray(parsed.stylingTips) ? parsed.stylingTips : [],
    };
  } catch {
    const lines = content
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const recommendations = lines
      .filter((l) => l.match(/^\d+\./) || l.toLowerCase().includes("recommend"))
      .slice(0, 5)
      .map((l, i) => ({
        item: l.replace(/^\d+\.\s*/, "").split(":")[0] ?? l,
        reason: l.split(":")[1] ?? "Matches your style preferences",
        priority: i < 2 ? 3 : i < 4 ? 2 : 1,
      }));
    const stylingTips = lines
      .filter(
        (l) =>
          l.toLowerCase().includes("tip") ||
          l.toLowerCase().includes("advice") ||
          l.toLowerCase().includes("try"),
      )
      .slice(0, 3);
    return {
      message: content || fallback,
      recommendations,
      stylingTips,
    };
  }
}
