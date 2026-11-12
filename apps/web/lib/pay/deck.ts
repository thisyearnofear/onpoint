/**
 * Which card the wait deck should show next — pure so the staging rules
 * can be tested without a browser. Two nudge rules always win (they only
 * fire while the deck is on the card they lead from); the idle rotation
 * is strictly a fallback and is cancelled forever by a manual dot tap.
 */
export function nextCard({
  current,
  guessLocked,
  queued,
  lastInteractionMs,
  now,
  cyclesDone,
  manual,
}: {
  current: number;
  /** A fit guess is locked in — nudge card 1 → card 2. */
  guessLocked: boolean;
  /** A next piece is queued — nudge card 2 → card 3. */
  queued: boolean;
  /** Timestamp of the last user interaction inside the deck (0 = never). */
  lastInteractionMs: number;
  now: number;
  /** Full wraps back to card 1 already done — idle rotation stops after one. */
  cyclesDone: number;
  /** The user tapped a dot — idle rotation is off for good (nudges still fire). */
  manual: boolean;
}): number | null {
  if (current === 0 && guessLocked) return 1;
  if (current === 1 && queued) return 2;
  if (manual || cyclesDone >= 1) return null;
  if (now - lastInteractionMs < 9000) return null;
  return (current + 1) % 3;
}
