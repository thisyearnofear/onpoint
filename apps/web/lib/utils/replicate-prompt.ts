/**
 * buildFashionPrompt — Build a prompt for the Replicate GPT-4o-mini fashion analysis.
 * Pure function — no side effects, no environment dependencies.
 */
export function buildFashionPrompt(goal: string, persona?: string): string {
  const goalContext: Record<string, string> = {
    daily:
      "Analyze this outfit for a daily look. Assess fit, color coordination, proportion, and overall aesthetic. Provide specific, actionable feedback.",
    event:
      "Analyze this outfit for an event or special occasion. Assess formality, silhouette, polish, and whether it suits an elevated setting.",
    critique:
      "Give an honest, direct critique of this outfit. Identify what's working, what isn't, and what should change first. Be specific and candid.",
  };

  const prompt = goalContext[goal] || goalContext.daily;

  if (persona) {
    return `You are a professional fashion stylist with a distinct personality. ${prompt}

Consider the wearer's personal style and provide advice in a way that matches your persona. Be authentic while delivering valuable fashion feedback.

Provide:
1. Overall impression
2. Fit assessment
3. Color and palette analysis
4. Specific strengths
5. Specific areas for improvement
6. A clear next-move recommendation`;
  }

  return `You are a professional fashion stylist. ${prompt}

Provide:
1. Overall impression
2. Fit assessment
3. Color and palette analysis
4. Specific strengths
5. Specific areas for improvement
6. A clear next-move recommendation`;
}
