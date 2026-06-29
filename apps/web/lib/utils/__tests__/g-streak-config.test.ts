import { describe, it, expect } from "vitest";
import {
  G_STREAK_MILESTONES,
  G_STREAK_BADGES,
  getNextMilestone,
  getLastReachedMilestone,
  getNewlyReachedMilestones,
} from "../g-streak-config";

describe("g-streak-config", () => {
  it("defines milestones in ascending order", () => {
    const days = G_STREAK_MILESTONES.map((m) => m.days);
    const sorted = [...days].sort((a, b) => a - b);
    expect(days).toEqual(sorted);
  });

  it("every milestone has a unique badge", () => {
    const badges = G_STREAK_MILESTONES.map((m) => m.badge);
    expect(new Set(badges).size).toBe(badges.length);
  });

  it("G_STREAK_BADGES matches milestone badges", () => {
    expect(G_STREAK_BADGES).toEqual(
      G_STREAK_MILESTONES.map((m) => m.badge),
    );
  });

  describe("getNextMilestone", () => {
    it("returns the first milestone when streak is 0", () => {
      expect(getNextMilestone(0)?.days).toBe(3);
    });

    it("returns the next unreached milestone", () => {
      expect(getNextMilestone(3)?.days).toBe(7);
      expect(getNextMilestone(6)?.days).toBe(7);
      expect(getNextMilestone(7)?.days).toBe(14);
    });

    it("returns null when all milestones are passed", () => {
      expect(getNextMilestone(30)).toBeNull();
      expect(getNextMilestone(100)).toBeNull();
    });
  });

  describe("getLastReachedMilestone", () => {
    it("returns null when no milestone reached", () => {
      expect(getLastReachedMilestone(0)).toBeNull();
      expect(getLastReachedMilestone(2)).toBeNull();
    });

    it("returns the highest reached milestone", () => {
      expect(getLastReachedMilestone(3)?.days).toBe(3);
      expect(getLastReachedMilestone(7)?.days).toBe(7);
      expect(getLastReachedMilestone(20)?.days).toBe(14);
      expect(getLastReachedMilestone(30)?.days).toBe(30);
    });
  });

  describe("getNewlyReachedMilestones", () => {
    it("returns empty when no new milestone crossed", () => {
      expect(getNewlyReachedMilestones(0, 1)).toEqual([]);
      expect(getNewlyReachedMilestones(3, 5)).toEqual([]);
    });

    it("returns milestones crossed in a single jump", () => {
      const crossed = getNewlyReachedMilestones(0, 7);
      expect(crossed.map((m) => m.days)).toEqual([3, 7]);
    });

    it("returns only newly crossed when advancing by one day", () => {
      expect(getNewlyReachedMilestones(6, 7).map((m) => m.days)).toEqual([7]);
      expect(getNewlyReachedMilestones(13, 14).map((m) => m.days)).toEqual([
        14,
      ]);
    });

    it("handles jumping past all milestones", () => {
      const crossed = getNewlyReachedMilestones(0, 30);
      expect(crossed.map((m) => m.days)).toEqual([3, 7, 14, 30]);
    });
  });
});
