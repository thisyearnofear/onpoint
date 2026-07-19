/**
 * Qwen Cloud (DashScope) — types
 *
 * The Qwen Cloud API is OpenAI Chat Completions compatible. We use the
 * international endpoint:
 *   https://dashscope-intl.aliyuncs.com/compatible-mode/v1
 *
 * Docs: https://docs.qwencloud.com/developer-guides/text-generation/quickstart
 * Pricing: https://docs.qwencloud.com/developer-guides/getting-started/pricing
 *
 * Verification metadata is not TEE-based (unlike 0G); Qwen Cloud does not
 * currently surface attestation proofs. The `trace` field is reserved for
 * future use if Qwen Cloud adds attestation.
 */

/** Vision-capable models we use on Qwen Cloud. */
export const QWEN_CLOUD_VISION_MODELS = [
  "qwen3-vl-flash", // cheapest vision: $0.05/$0.40 per 1M tokens (≤32K context)
  "qwen3-vl-plus", // better vision: $0.20/$1.60 per 1M tokens (≤32K context)
  "qwen3.7-plus", // text+vision: $0.40/$1.60 per 1M tokens (≤256K context)
] as const;

export type QwenCloudVisionModel = (typeof QWEN_CLOUD_VISION_MODELS)[number];

/** Text-only models we use on Qwen Cloud. */
export const QWEN_CLOUD_TEXT_MODELS = [
  "qwen3.6-flash", // cheapest text: $0.25/$1.50 per 1M tokens (≤256K context)
  "qwen3.7-plus", // good text: $0.40/$1.60 per 1M tokens (≤256K context)
  "qwen3.7-max", // best text: $2.50/$7.50 per 1M tokens (≤991K context)
] as const;

export type QwenCloudTextModel = (typeof QWEN_CLOUD_TEXT_MODELS)[number];

export interface QwenCloudChatMessage {
  role: "system" | "user" | "assistant";
  /** OpenAI-style mixed content: string for text-only, array for vision. */
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      >;
}

export interface QwenCloudChatRequest {
  model: string;
  messages: QwenCloudChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  /** OpenAI JSON-mode for structured responses. */
  response_format?: { type: "json_object" };
  /**
   * Qwen Cloud supports thinking/reasoning mode on some models.
   * Off by default to save tokens.
   */
  enable_thinking?: boolean;
}

export interface QwenCloudChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
    message: {
      role: "assistant";
      content: string | null;
    };
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    prompt_tokens_details?: {
      cached_tokens?: number;
      image_tokens?: number;
      text_tokens?: number;
    };
    completion_tokens_details?: {
      reasoning_tokens?: number;
      text_tokens?: number;
    };
  };
}

export interface QwenCloudClientConfig {
  /** Bearer key from Qwen Cloud API-Key page. Treated as a secret. */
  apiKey: string;
  /**
   * Override the base URL. Default:
   * https://dashscope-intl.aliyuncs.com/compatible-mode/v1
   * (international endpoint — the China endpoint dashscope.aliyuncs.com
   * rejects keys created on the international platform.)
   */
  baseURL?: string;
  /** Default model for vision calls. Default: qwen3-vl-flash (cheapest). */
  defaultVisionModel?: string;
  /** Default model for text/persona calls. Default: qwen3.6-flash (cheapest). */
  defaultChatModel?: string;
  /** Hard request timeout in ms. Default: 20_000. */
  timeoutMs?: number;
  /**
   * Daily spend budget in USD. When the Redis-backed counter hits this,
   * calls throw. Default: 1.00. Set to 0 to disable the budget gate.
   */
  dailyBudgetUsd?: number;
  /**
   * Kill switch — when true, every call throws immediately.
   * Set via QWEN_CLOUD_KILL_SWITCH=1 env var.
   */
  killSwitch?: boolean;
  /**
   * Optional Redis client for daily budget enforcement. If not provided,
   * an in-memory counter is used (per-process, resets on restart).
   */
  redis?: {
    incr: (key: string) => Promise<number>;
    expire: (key: string, seconds: number) => Promise<void>;
    get: (key: string) => Promise<string | null>;
  } | null;
}

/** Result of an analyzeOutfit / analyzeAfricanTextile call. */
export interface QwenCloudAnalysisResult {
  content: string;
  model: string;
  usage?: QwenCloudChatResponse["usage"];
  /** Estimated USD cost of this call, computed from usage + model pricing. */
  estimatedCostUsd: number;
}

/** Result of a chatPersona call. */
export interface QwenCloudChatResult {
  content: string;
  model: string;
  usage?: QwenCloudChatResponse["usage"];
  estimatedCostUsd: number;
}
