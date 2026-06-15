/**
 * Unit Tests — @repo/0g-compute (catalog + cost model)
 *
 * Validates the verified catalog snapshot and the cost estimator
 * without hitting the 0G Router. Network-touching tests (vision,
 * JSON, TEE shape) are exercised by a separate live probe in
 * /tmp/0g-probe — see ADR 0006.
 *
 * These tests run with vitest and don't require any env or network.
 */

import { describe, it, expect } from "vitest";
import {
  ZERO_G_MODEL_CATALOG,
  ZERO_G_DEFAULT_PICKS,
  estimateZeroGCallUsd,
} from "../models";
import { ZERO_G_VISION_MODELS, ZERO_G_FINETUNE_MODELS } from "../types";

describe("@repo/0g-compute — catalog snapshot", () => {
  it("exposes the three vision-capable models from the live Router catalog", () => {
    expect(ZERO_G_VISION_MODELS).toEqual(
      expect.arrayContaining([
        "qwen3-vl-30b",
        "minimax-m3",
        "0gm-1.0-35b-a3b",
      ]),
    );
  });

  it("catalog entries include pricing and TEE mode", () => {
    for (const id of ZERO_G_VISION_MODELS) {
      const entry = ZERO_G_MODEL_CATALOG[id];
      expect(entry, `missing catalog entry for ${id}`).toBeDefined();
      expect(entry.vision).toBe(true);
      expect(entry.contextLength).toBeGreaterThan(0);
      expect(entry.maxOutputTokens).toBeGreaterThan(0);
      expect(["TeeML", "TeeTLS"]).toContain(entry.verification);
    }
  });

  it("flags minimax-m3 as free during the 0G Bridge promo", () => {
    const m3 = ZERO_G_MODEL_CATALOG["minimax-m3"];
    expect(m3.inputUsdPer1M).toBe(0);
    expect(m3.outputUsdPer1M).toBe(0);
  });

  it("flags qwen3-vl-30b as the cheapest vision model", () => {
    const qwen = ZERO_G_MODEL_CATALOG["qwen3-vl-30b"];
    expect(qwen.inputUsdPer1M).toBeLessThan(
      ZERO_G_MODEL_CATALOG["0gm-1.0-35b-a3b"].inputUsdPer1M,
    );
  });

  it("predefined fine-tunable models are text-only (per docs 2026-06)", () => {
    // Per docs.0g.ai inference + fine-tuning pages, the predefined
    // fine-tunable models are Qwen2.5-0.5B-Instruct and Qwen3-32B —
    // both Causal LMs, neither vision-capable. This is the constraint
    // that re-scopes the original "Qwen-VL fine-tuning" thesis.
    expect(ZERO_G_FINETUNE_MODELS).toEqual([
      "Qwen2.5-0.5B-Instruct",
      "Qwen3-32B",
    ]);
    for (const id of ZERO_G_FINETUNE_MODELS) {
      expect((ZERO_G_MODEL_CATALOG as Record<string, unknown>)[id]).toBeUndefined();
    }
  });

  it("default picks point to qwen3-vl-30b for vision and chat", () => {
    expect(ZERO_G_DEFAULT_PICKS.vision).toBe("qwen3-vl-30b");
    expect(ZERO_G_DEFAULT_PICKS.design).toBe("qwen3-vl-30b");
    // chat defaults to qwen3-vl-30b unless ZERO_G_CHAT_MODEL overrides
    expect(ZERO_G_DEFAULT_PICKS.chat).toBe("qwen3-vl-30b");
  });
});

describe("@repo/0g-compute — cost estimator", () => {
  it("returns $0 for free models", () => {
    expect(
      estimateZeroGCallUsd("minimax-m3", 1000, 500),
    ).toBe(0);
  });

  it("estimates qwen3-vl-30b at the published rate", () => {
    // 1M input tokens @ $0.01936 = $0.01936
    // 1M output tokens @ $0.18920 = $0.18920
    // Total for 1M/1M: $0.20856
    const cost = estimateZeroGCallUsd("qwen3-vl-30b", 1_000_000, 1_000_000);
    expect(cost).toBeCloseTo(0.20856, 5);
  });

  it("a single outfit critique costs well under one cent", () => {
    // Typical outfit critique: ~200 input tokens (image) + ~400 output tokens
    // = 0.0002 * 0.01936 + 0.0004 * 0.1892
    // = 0.0000039 + 0.0000757
    // = $0.0000796 — well under 0.01 cents
    const cost = estimateZeroGCallUsd("qwen3-vl-30b", 200, 400);
    expect(cost).toBeLessThan(0.0001);
  });

  it("scales linearly with token count", () => {
    const small = estimateZeroGCallUsd("qwen3-vl-30b", 1_000, 500);
    const big = estimateZeroGCallUsd("qwen3-vl-30b", 10_000, 5_000);
    expect(big / small).toBeCloseTo(10, 5);
  });

  it("returns $0 for unknown models (defensive default)", () => {
    expect(estimateZeroGCallUsd("nonexistent-model", 1_000, 1_000)).toBe(0);
  });
});
