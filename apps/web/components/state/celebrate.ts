import { fireConfetti, type ConfettiOptions } from "../../lib/utils/confetti";

const KEY_PREFIX = "onpoint-celebrated:";

/**
 * Budgeted delight: confetti fires at most once per `kind` per browser.
 * Reserve it for firsts and closed loops (first save, first purchase,
 * gift claimed) — never for loading, never twice for the same thing.
 *
 * Returns true if the celebration fired, false if it was already spent.
 */
export function celebrate(kind: string, options?: ConfettiOptions): boolean {
  if (typeof window === "undefined") return false;
  const key = `${KEY_PREFIX}${kind}`;
  try {
    if (window.localStorage.getItem(key)) return false;
    window.localStorage.setItem(key, "1");
  } catch {
    // Storage unavailable (private mode) — celebrate anyway rather than
    // silently swallowing a earned moment.
  }
  fireConfetti(options);
  return true;
}
