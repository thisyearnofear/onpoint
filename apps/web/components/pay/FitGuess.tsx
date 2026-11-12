"use client";

/**
 * "Call it" — the user guesses the fit score while the render develops.
 * The guess is checked against the real outcome on the done screen
 * (`guessOutcome` in lib/pay/guess). No storage, no points — just a
 * stake in the wait.
 */
export function FitGuess({
  guess,
  onPick,
  compact = false,
}: {
  guess: number | null;
  onPick: (n: number) => void;
  /** Tight variant for the wait deck — smaller prompt and 36px chips. */
  compact?: boolean;
}) {
  return (
    <div>
      <p className={compact ? "text-sm font-semibold" : "font-display text-lg"}>
        {compact ? "What will I score the fit?" : "While it develops — call it. What will I score the fit?"}
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Your fit-score guess">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={guess === n}
            onClick={() => onPick(n)}
            className={`flex items-center justify-center rounded-full border text-sm font-bold transition-all ${
              compact ? "h-9 w-9" : "h-11 w-11"
            } ${
              guess === n
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground/50"
            }`}
          >
            {n}
          </button>
        ))}
      </div>
      {guess != null ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Locked in: {guess}. I&rsquo;ll tell you how close you were.
        </p>
      ) : null}
    </div>
  );
}
