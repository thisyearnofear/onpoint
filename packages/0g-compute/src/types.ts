/**
 * 0G Compute Network — types
 *
 * The 0G Router (https://router-api.0g.ai/v1) is OpenAI Chat Completions
 * compatible, so the request/response shapes are a strict subset of the
 * OpenAI types. We model them here against the live catalog
 * (https://router-api.0g.ai/v1/models) so downstream code can use them
 * without pulling the OpenAI SDK at the type level.
 *
 * Verification metadata (TeeML / TeeTLS / dstack / TDX) is exposed
 * alongside the response so the agent layer can decide whether to
 * record a TEE proof on a verifiable receipt.
 */

/** Vision-capable models verified live on the 0G Router catalog. */
export const ZERO_G_VISION_MODELS = [
  "qwen3-vl-30b", // cheapest vision model: $0.02 / $0.19 per 1M tokens, 262K context
  "minimax-m3", // frontier multimodal, free during the 0G Bridge promo, 1M context
  "0gm-1.0-35b-a3b", // 0G in-house, agentic focus, text+image
] as const;

export type ZeroGVisionModel = (typeof ZERO_G_VISION_MODELS)[number];

/** Predefined fine-tunable models on 0G (text-only, per docs 2026-06). */
export const ZERO_G_FINETUNE_MODELS = [
  "Qwen2.5-0.5B-Instruct",
  "Qwen3-32B",
] as const;

export type ZeroGFinetuneModel = (typeof ZERO_G_FINETUNE_MODELS)[number];

export type ZeroGVerification = "TeeML" | "TeeTLS";

/** TEE proof surface on a Router chat-completion response. */
export interface ZeroGTEEProof {
  /** The 0G provider address (0x...) that handled the request. */
  provider: string;
  /** Verification mode declared by the provider. */
  mode: ZeroGVerification;
  /** Attestation type — currently always TDX / dstack on live catalog. */
  tee_type: "TDX";
  /** dstack verifier (signed by the trusted TEE root). */
  tee_verifier: "dstack";
}

export interface ZeroGChatMessage {
  role: "system" | "user" | "assistant";
  /** OpenAI-style mixed content: string for text-only, array for vision. */
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string; detail?: "auto" | "low" | "high" } }
      >;
}

export interface ZeroGChatRequest {
  model: string;
  messages: ZeroGChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  stream?: boolean;
  /** Request TEE-attested routing and a signed proof in the trace. */
  verify_tee?: boolean;
  /** Optional explicit provider routing. */
  provider?: {
    sort?: "latency" | "price";
    allow_fallbacks?: boolean;
  };
  /** OpenAI JSON-mode for the CritiqueResponse contract. */
  response_format?: { type: "json_object" };
}

export interface ZeroGChatResponse {
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
  /** Populated when the request was made with verify_tee: true. */
  tee_verified?: ZeroGTEEProof;
}

export interface ZeroGClientConfig {
  /** Bearer key from pc.0g.ai. Treated as a secret. */
  apiKey: string;
  /**
   * Override the Router base URL. Default: https://router-api.0g.ai/v1
   * (testnet: https://router-api-testnet.integratenetwork.work/v1)
   */
  baseURL?: string;
  /** Default model for text + image calls. Default: qwen3-vl-30b. */
  defaultModel?: string;
  /** Default model for chat/persona calls. Default: same as defaultModel. */
  chatModel?: string;
  /** Hard request timeout in ms. Default: 20_000. */
  timeoutMs?: number;
}
