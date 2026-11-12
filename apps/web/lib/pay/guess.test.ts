import { describe, expect, it } from "vitest";
import { guessOutcome } from "./guess";

describe("guessOutcome", () => {
  it("null when no guess", () => {
    expect(guessOutcome(null, 8)).toBeNull();
    expect(guessOutcome(undefined, 8)).toBeNull();
    expect(guessOutcome(null, null)).toBeNull();
  });

  it("exact match calls it", () => {
    expect(guessOutcome(8, 8)).toBe("You called it — 8/10.");
  });

  it("one off", () => {
    expect(guessOutcome(7, 8)).toBe("You said 7, I read 8. One off.");
    expect(guessOutcome(9, 8)).toBe("You said 9, I read 8. One off.");
  });

  it("further off", () => {
    expect(guessOutcome(3, 8)).toBe("You said 3, I read 8.");
  });

  it("guess but no score", () => {
    expect(guessOutcome(7, null)).toBe(
      "No fit read on this one, so there's nothing to check your 7 against.",
    );
  });
});
