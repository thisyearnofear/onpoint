import { describe, expect, it } from "vitest";
import {
  buildHeuristicStyleScore,
  extractStructuredStyleScore,
} from "./style-score";

describe("style-score", () => {
  it("prefers explicit JSON model scores", () => {
    const result = extractStructuredStyleScore([
      'Final report: {"score": 8.6, "confidence": 0.82, "evidence": ["good color harmony"]}',
    ]);

    expect(result).toEqual({
      score: 9,
      confidence: 0.82,
      evidence: ["good color harmony"],
      source: "model",
    });
  });

  it("extracts plain-language model ratings", () => {
    const result = extractStructuredStyleScore([
      "Overall style rating: 7 out of 10. Fit is strong.",
    ]);

    expect(result?.score).toBe(7);
    expect(result?.source).toBe("model");
  });

  it("builds a lower-confidence fallback from feedback sentiment", () => {
    const result = buildHeuristicStyleScore({
      sessionGoal: "critique",
      praiseCount: 1,
      critiqueCount: 2,
      suggestionCount: 1,
    });

    expect(result.score).toBeGreaterThanOrEqual(1);
    expect(result.score).toBeLessThanOrEqual(10);
    expect(result.confidence).toBeLessThan(0.7);
    expect(result.source).toBe("heuristic");
  });
});
