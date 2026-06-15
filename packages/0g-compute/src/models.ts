/**
 * 0G Compute Network — catalog snapshot
 *
 * Verified against the live Router catalog on 2026-06-15.
 * Re-verify before relying on pricing for production cost models:
 *   curl -H "Authorization: Bearer *** https://router-api.0g.ai/v1/models
 *
 * Update ZERO_G_VISION_MODELS in ./types when the catalog adds a new
 * vision-capable entry, and update the unit-cost map below so
 * AgentControls / spend-policy can bill 0G calls against the user's
 * daily cap.
 */

import type { ZeroGVerification } from "./types";

export interface ZeroGModelCatalogEntry {
  id: string;
  name: string;
  description: string;
  vision: boolean;
  contextLength: number;
  maxOutputTokens: number;
  /** USD per 1M input tokens. 0 means free for now. */
  inputUsdPer1M: number;
  /** USD per 1M output tokens. 0 means free for now. */
  outputUsdPer1M: number;
  verification: ZeroGVerification;
  /** Hint used by chatWithStylist to pick the more "persona-aware" model. */
  bestFor: Array<"vision" | "chat" | "design" | "code" | "reasoning">;
}

/**
 * Subset of the live Router catalog that we actually call. Update via
 * `pnpm -F @repo/0g-compute run check-types` to keep types honest.
 */
export const ZERO_G_MODEL_CATALOG: Record<string, ZeroGModelCatalogEntry> = {
  "qwen3-vl-30b": {
    id: "qwen3-vl-30b",
    name: "Qwen3-VL-30B-A3B-Instruct",
    description: "Alibaba multimodal vision-language model; visual reasoning, OCR, document understanding.",
    vision: true,
    contextLength: 262_144,
    maxOutputTokens: 32_768,
    inputUsdPer1M: 0.01936,
    outputUsdPer1M: 0.1892,
    verification: "TeeTLS",
    bestFor: ["vision", "chat", "design"],
  },
  "minimax-m3": {
    id: "minimax-m3",
    name: "MiniMax-M3",
    description: "Frontier natively-multimodal on MSA; agentic coding, native tool use, long-horizon. Free 0G Bridge promo (Jun 15–18 2026).",
    vision: true,
    contextLength: 1_000_000,
    maxOutputTokens: 131_072,
    inputUsdPer1M: 0,
    outputUsdPer1M: 0,
    verification: "TeeTLS",
    bestFor: ["vision", "chat", "design", "reasoning", "code"],
  },
  "0gm-1.0-35b-a3b": {
    id: "0gm-1.0-35b-a3b",
    name: "0GM-1.0-35B-A3B",
    description: "0G in-house model optimized for agentic coding and tool use; thinking on by default.",
    vision: true,
    contextLength: 262_144,
    maxOutputTokens: 32_768,
    inputUsdPer1M: 0.032,
    outputUsdPer1M: 0.192,
    verification: "TeeML",
    bestFor: ["vision", "code", "reasoning"],
  },
};

/** Default picks for each call type. */
export const ZERO_G_DEFAULT_PICKS = {
  /** analyzeOutfit / analyzePhoto — vision-capable, cheap, fast. */
  vision: "qwen3-vl-30b",
  /** chatWithStylist — use the free promo model when available, else qwen. */
  chat: process.env.ZERO_G_CHAT_MODEL ?? "qwen3-vl-30b",
  /** generateDesign — qwen-vl is fine, promo model for higher stakes. */
  design: "qwen3-vl-30b",
} as const;

/** Estimate the USD cost of a single 0G call given usage tokens. */
export function estimateZeroGCallUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const entry = ZERO_G_MODEL_CATALOG[modelId];
  if (!entry) return 0;
  const inputCost = (promptTokens / 1_000_000) * entry.inputUsdPer1M;
  const outputCost = (completionTokens / 1_000_000) * entry.outputUsdPer1M;
  return inputCost + outputCost;
}
