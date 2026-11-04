import { describe, it, expect } from "vitest";
import { duelOutcome } from "../utils/runway";

describe("duelOutcome", () => {
  it("win when challenger scores higher", () => {
    expect(duelOutcome(8.2, 7.8)).toBe("win");
  });
  it("lose when challenger scores lower", () => {
    expect(duelOutcome(6.1, 7.8)).toBe("lose");
  });
  it("tie on equal scores", () => {
    expect(duelOutcome(7.8, 7.8)).toBe("tie");
  });
});

import { nextThemeLabel, msUntilNextTheme } from "../utils/runway";

describe("nextThemeLabel", () => {
  it("formats hours and minutes to next UTC day", () => {
    // 2026-01-15 20:00 UTC → 4h 0m until midnight
    expect(nextThemeLabel(Date.UTC(2026, 0, 15, 20, 0))).toBe("4h 0m");
  });
  it("formats minutes only under an hour", () => {
    expect(nextThemeLabel(Date.UTC(2026, 0, 15, 23, 30))).toBe("30m");
  });
  it("rolls over at midnight", () => {
    expect(msUntilNextTheme(Date.UTC(2026, 0, 16, 0, 0))).toBe(86400000);
  });
});
