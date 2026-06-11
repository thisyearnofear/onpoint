import { useMemo } from "react";
import { useAnalysisHistory } from "../stores/analysis-history-store";

export type ScoreTrend = "improving" | "stable" | "declining" | "insufficient_data";

export interface ScoreProgression {
  totalLooks: number;
  bestScore: number | null;
  avgScore: number | null;
  trend: ScoreTrend;
  mostUsedPersona: string | null;
  recentScore: number | null;
  previousScore: number | null;
  scoreDelta: number | null;
  daysSinceLastLook: number | null;
}

export function useScoreProgression(): ScoreProgression {
  const sessions = useAnalysisHistory((state) => state.sessions);

  return useMemo(() => {
    const totalLooks = sessions.length;

    if (totalLooks === 0) {
      return {
        totalLooks: 0,
        bestScore: null,
        avgScore: null,
        trend: "insufficient_data",
        mostUsedPersona: null,
        recentScore: null,
        previousScore: null,
        scoreDelta: null,
        daysSinceLastLook: null,
      };
    }

    const scores = sessions.map((s) => s.score);
    const bestScore = Math.max(...scores);
    const avgScore = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const recentScore = scores[0] ?? null;
    const previousScore = scores[1] ?? null;
    const scoreDelta = recentScore !== null && previousScore !== null ? recentScore - previousScore : null;

    let trend: ScoreTrend = "insufficient_data";
    if (totalLooks >= 3) {
      const last3 = scores.slice(0, 3);
      const ascending = last3.every((v, i) => i === 0 || v >= last3[i - 1]!);
      const descending = last3.every((v, i) => i === 0 || v <= last3[i - 1]!);
      if (ascending && last3[0]! > last3[2]!) trend = "improving";
      else if (descending && last3[0]! < last3[2]!) trend = "declining";
      else trend = "stable";
    } else if (totalLooks === 2 && scoreDelta !== null) {
      if (scoreDelta > 0) trend = "improving";
      else if (scoreDelta < 0) trend = "declining";
      else trend = "stable";
    }

    const personaCounts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.persona) personaCounts[s.persona] = (personaCounts[s.persona] || 0) + 1;
    }
    const mostUsedPersona = Object.entries(personaCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;

    const lastCreated = new Date(sessions[0]!.createdAt).getTime();
    const daysSinceLastLook = Math.floor((Date.now() - lastCreated) / 86400000);

    return { totalLooks, bestScore, avgScore, trend, mostUsedPersona, recentScore, previousScore, scoreDelta, daysSinceLastLook };
  }, [sessions]);
}
