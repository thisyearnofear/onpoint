/**
 * Qwen Cloud — model catalog + pricing
 *
 * Pricing verified against https://docs.qwencloud.com/developer-guides/getting-started/pricing
 * on 2026-07-19. Re-verify before relying on cost models for production.
 *
 * Image token conversion: 1 token per 32×32 pixels (Qwen-VL family).
 * A 1024×1024 image ≈ 256 tokens.
 */

export interface QwenCloudModelCatalogEntry {
  id: string;
  name: string;
  description: string;
  vision: boolean;
  contextLength: number;
  /** USD per 1M input tokens (cheapest tier). */
  inputUsdPer1M: number;
  /** USD per 1M output tokens (cheapest tier). */
  outputUsdPer1M: number;
  /** Hint used to pick the right model for each call type. */
  bestFor: Array<"vision" | "chat" | "design" | "reasoning">;
}

/**
 * Subset of the Qwen Cloud catalog that we actually call.
 * Defaults favor the cheapest model that can do the job — spend control.
 */
export const QWEN_CLOUD_MODEL_CATALOG: Record<string, QwenCloudModelCatalogEntry> = {
  "qwen3-vl-flash": {
    id: "qwen3-vl-flash",
    name: "Qwen3-VL-Flash",
    description:
      "Cheapest vision model on Qwen Cloud. Fast, good enough for outfit analysis and African textile identification.",
    vision: true,
    contextLength: 256_000,
    inputUsdPer1M: 0.05,
    outputUsdPer1M: 0.4,
    bestFor: ["vision", "chat"],
  },
  "qwen3-vl-plus": {
    id: "qwen3-vl-plus",
    name: "Qwen3-VL-Plus",
    description:
      "Higher-quality vision model. Use for the final styling recommendation where detail matters.",
    vision: true,
    contextLength: 256_000,
    inputUsdPer1M: 0.2,
    outputUsdPer1M: 1.6,
    bestFor: ["vision", "design"],
  },
  "qwen3.6-flash": {
    id: "qwen3.6-flash",
    name: "Qwen3.6-Flash",
    description:
      "Cheapest text model. Fast persona chat and reasoning over already-analyzed outfit data.",
    vision: false,
    contextLength: 256_000,
    inputUsdPer1M: 0.25,
    outputUsdPer1M: 1.5,
    bestFor: ["chat", "reasoning"],
  },
  "qwen3.7-plus": {
    id: "qwen3.7-plus",
    name: "Qwen3.7-Plus",
    description:
      "Good general-purpose model with vision support. Fallback when vl-flash is unavailable.",
    vision: true,
    contextLength: 256_000,
    inputUsdPer1M: 0.4,
    outputUsdPer1M: 1.6,
    bestFor: ["vision", "chat", "reasoning"],
  },
  "qwen3.7-max": {
    id: "qwen3.7-max",
    name: "Qwen3.7-Max",
    description:
      "Best text quality. Reserve for high-stakes persona turns only — most expensive.",
    vision: false,
    contextLength: 991_000,
    inputUsdPer1M: 2.5,
    outputUsdPer1M: 7.5,
    bestFor: ["chat", "reasoning"],
  },
};

/** Default model picks — cheapest first, spend control. */
export const QWEN_CLOUD_DEFAULT_PICKS = {
  /** analyzeOutfit / analyzeAfricanTextile — cheapest vision model. */
  vision: "qwen3-vl-flash",
  /** chatWithStylist — cheapest text model. */
  chat: "qwen3.6-flash",
  /** generateDesign / high-stakes styling — better vision model. */
  design: "qwen3-vl-plus",
} as const;

/**
 * Estimate the USD cost of a single Qwen Cloud call given usage tokens.
 * Uses the cheapest-tier pricing. Long-context tiered pricing is not modeled
 * here because our calls stay well under the tier breakpoints.
 */
export function estimateQwenCloudCallUsd(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const entry = QWEN_CLOUD_MODEL_CATALOG[modelId];
  if (!entry) return 0;
  const inputCost = (promptTokens / 1_000_000) * entry.inputUsdPer1M;
  const outputCost = (completionTokens / 1_000_000) * entry.outputUsdPer1M;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}
