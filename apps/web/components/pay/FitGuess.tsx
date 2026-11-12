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
}: {
  guess: number | null;
  onPick: (n: number) => void;
}) {
  return (
    <div>
      <p className="font-display text-lg">
        While it develops — call it. What will I score the fit?
      </p>
      <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Your fit-score guess">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={guess === n}
            onClick={() => onPick(n)}
            className={`flex h-11 w-11 items-center justify-center rounded-full border text-sm font-bold transition-all ${
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
