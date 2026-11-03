import { describe, expect, it } from "vitest";
import {
  computeStreak,
  bestScore,
  roundsPlayed,
  type RunwayEntry,
} from "./runway-history-store";

const DAY = 86400000;
const NOW = Date.parse("2026-11-10T12:00:00Z");
const at = (isoDay: string) => Date.parse(`${isoDay}T09:00:00Z`);

const entry = (roundId: string, isoDay: string, total = 7): RunwayEntry => ({
  roundId,
  themeId: "t",
  themeName: "Theme",
  judge: "miranda",
  total,
  scores: { theme: 8, cohesion: 7, styling: 6 },
  verdict: "v",
  at: at(isoDay),
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const entries = [entry("a", "2026-11-10"), entry("b", "2026-11-09"), entry("c", "2026-11-08")];
    expect(computeStreak(entries, NOW)).toBe(3);
  });

  it("streak survives when yesterday was the last round", () => {
    const entries = [entry("a", "2026-11-09"), entry("b", "2026-11-08")];
    expect(computeStreak(entries, NOW)).toBe(2);
  });

  it("is 0 when the last round is older than yesterday", () => {
    expect(computeStreak([entry("a", "2026-11-08")], NOW)).toBe(0);
    expect(computeStreak([], NOW)).toBe(0);
  });

  it("breaks on a missed day and counts multiple rounds a day once", () => {
    const entries = [
      entry("a", "2026-11-10"),
      entry("a2", "2026-11-10"),
      entry("b", "2026-11-08"), // gap on 11-09
      entry("c", "2026-11-07"),
    ];
    expect(computeStreak(entries, NOW)).toBe(1);
  });
});

describe("bestScore / roundsPlayed", () => {
  it("returns max total and entry count", () => {
    const entries = [entry("a", "2026-11-10", 6.5), entry("b", "2026-11-09", 8.2)];
    expect(bestScore(entries)).toBe(8.2);
    expect(roundsPlayed(entries)).toBe(2);
    expect(bestScore([])).toBeNull();
  });
});
