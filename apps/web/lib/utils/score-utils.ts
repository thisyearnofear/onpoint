/**
 * Shared scoring and sharing utilities for style sessions.
 * Single source of truth for score labels, colors, and share text.
 */

export type ScoreTier = "Legendary" | "Elite" | "Strong" | "Solid" | "Growing";

export interface ScoreConfig {
  tier: ScoreTier;
  color: string;
  gradient: string;
}

export function getScoreTier(score: number): ScoreTier {
  if (score >= 9) return "Legendary";
  if (score >= 8) return "Elite";
  if (score >= 7) return "Strong";
  if (score >= 5) return "Solid";
  return "Growing";
}

export function getScoreConfig(score: number): ScoreConfig {
  const tier = getScoreTier(score);
  switch (tier) {
    case "Legendary":
      return {
        tier,
        color: "text-amber-400",
        gradient: "from-amber-400 to-yellow-500",
      };
    case "Elite":
      return {
        tier,
        color: "text-amber-400",
        gradient: "from-amber-400 to-yellow-500",
      };
    case "Strong":
      return {
        tier,
        color: "text-indigo-400",
        gradient: "from-indigo-400 to-purple-500",
      };
    case "Solid":
      return {
        tier,
        color: "text-indigo-400",
        gradient: "from-indigo-400 to-purple-500",
      };
    case "Growing":
      return {
        tier,
        color: "text-slate-400",
        gradient: "from-slate-400 to-slate-500",
      };
  }
}

export interface ShareData {
  score: number;
  personaLabel: string;
  topics: string[];
  takeaways: string[];
  sessionGoal?: string;
}

export function generateShareText(data: ShareData): string {
  const tier = getScoreTier(data.score);
  const topicStr = data.topics.slice(0, 3).join(", ");
  const takeaway = data.takeaways[0] || "Found my perfect look!";
  return `OnPoint Style Report\n\nScore: ${data.score}/10 (${tier})\nStylist: ${data.personaLabel}\nFocus: ${topicStr || "Personal Style"}\n\n"${takeaway}"\n\nMinted on Celo via @onpoint`;
}

export function generateFullReportText(
  data: ShareData & { fullFeedback?: Array<{ text: string; type: string }> },
): string {
  const tier = getScoreTier(data.score);
  const topicStr = data.topics.join(", ");
  const date = new Date().toLocaleDateString();

  let text = `OnPoint Style Report\n`;
  text += `${"=".repeat(40)}\n\n`;
  text += `Score: ${data.score}/10 (${tier})\n`;
  text += `Stylist: ${data.personaLabel}\n`;
  if (data.sessionGoal) text += `Goal: ${data.sessionGoal}\n`;
  if (topicStr) text += `Analysis Focus: ${topicStr}\n`;
  text += `Date: ${date}\n\n`;

  text += `Key Takeaways\n`;
  text += `${"-".repeat(40)}\n`;
  data.takeaways.forEach((t, i) => {
    text += `${i + 1}. ${t}\n`;
  });

  if (data.fullFeedback && data.fullFeedback.length > 0) {
    text += `\nFull Session Feedback\n`;
    text += `${"-".repeat(40)}\n`;
    data.fullFeedback.forEach((f) => {
      const label = f.type.charAt(0).toUpperCase() + f.type.slice(1);
      text += `[${label}] ${f.text}\n`;
    });
  }

  text += `\nStyled by OnPoint AI`;
  return text;
}
