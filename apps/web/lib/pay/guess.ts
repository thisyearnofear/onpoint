/**
 * "Call it" — the user's guess checked against the real fit score.
 * Returns the verdict sentence to show on the done screen, or null when
 * there's nothing to say (no guess, or no guess and no score).
 */
export function guessOutcome(
  guess: number | null | undefined,
  score: number | null | undefined,
): string | null {
  if (guess == null) return null;
  if (score == null) {
    return `No fit read on this one, so there's nothing to check your ${guess} against.`;
  }
  if (guess === score) return `You called it — ${score}/10.`;
  if (Math.abs(guess - score) === 1) return `You said ${guess}, I read ${score}. One off.`;
  return `You said ${guess}, I read ${score}.`;
}
