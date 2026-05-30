export interface StructuredStyleScore {
  score: number;
  confidence: number;
  evidence: string[];
  source: "model" | "heuristic";
}

function clampScore(value: number): number {
  return Math.min(10, Math.max(1, Math.round(value)));
}

function clampConfidence(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseJsonScore(text: string): StructuredStyleScore | null {
  const jsonMatch = text.match(/\{[\s\S]*?(?:"score"|"rating")[\s\S]*?\}/i);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const rawScore = parsed.score ?? parsed.rating;
    if (typeof rawScore !== "number") return null;

    const rawConfidence = parsed.confidence;
    const evidence = Array.isArray(parsed.evidence)
      ? parsed.evidence.filter((item): item is string => typeof item === "string")
      : [];

    return {
      score: clampScore(rawScore),
      confidence:
        typeof rawConfidence === "number"
          ? clampConfidence(rawConfidence > 1 ? rawConfidence / 100 : rawConfidence)
          : 0.7,
      evidence: evidence.slice(0, 3),
      source: "model",
    };
  } catch {
    return null;
  }
}

export function extractStructuredStyleScore(
  texts: string[],
): StructuredStyleScore | null {
  const joined = texts.filter(Boolean).join("\n");
  const jsonScore = parseJsonScore(joined);
  if (jsonScore) return jsonScore;

  const ratingMatch = joined.match(
    /(?:style\s*)?(?:score|rating)\s*(?:is|:|-)?\s*(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*10/i,
  );
  if (!ratingMatch?.[1]) return null;

  return {
    score: clampScore(Number(ratingMatch[1])),
    confidence: 0.65,
    evidence: [],
    source: "model",
  };
}

export function buildHeuristicStyleScore(params: {
  sessionGoal: "event" | "daily" | "critique" | null;
  praiseCount: number;
  critiqueCount: number;
  suggestionCount: number;
}): StructuredStyleScore {
  const totalClassified =
    params.praiseCount + params.critiqueCount + params.suggestionCount;
  const base = params.sessionGoal === "critique" ? 5 : 7;

  if (totalClassified === 0) {
    return {
      score: base,
      confidence: 0.35,
      evidence: [],
      source: "heuristic",
    };
  }

  const praiseRatio = params.praiseCount / totalClassified;
  const critiqueRatio =
    (params.critiqueCount + params.suggestionCount * 0.7) / totalClassified;
  const sentimentBonus = praiseRatio * 3 - critiqueRatio * 2.5;

  return {
    score: clampScore(base + sentimentBonus),
    confidence: Math.min(0.6, 0.35 + totalClassified * 0.05),
    evidence: [],
    source: "heuristic",
  };
}
