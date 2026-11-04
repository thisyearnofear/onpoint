import { describe, it, expect } from "vitest";
import { scoreTier, banterFor } from "../runway-banter";

describe("scoreTier", () => {
  it("high at 8+", () => {
    expect(scoreTier(8.0)).toBe("high");
    expect(scoreTier(9.7)).toBe("high");
  });
  it("low under 4", () => {
    expect(scoreTier(3.9)).toBe("low");
    expect(scoreTier(1.0)).toBe("low");
  });
  it("mid in between", () => {
    expect(scoreTier(4.0)).toBe("mid");
    expect(scoreTier(7.9)).toBe("mid");
  });
});

describe("banterFor", () => {
  it("is deterministic for the same round", () => {
    expect(banterFor("edina", "high", "abc123def456")).toBe(banterFor("edina", "high", "abc123def456"));
  });
  it("returns a non-empty line for every judge/tier", () => {
    for (const j of ["miranda", "edina", "shaft"] as const) {
      for (const t of ["high", "mid", "low"] as const) {
        expect(banterFor(j, t, "seed").length).toBeGreaterThan(0);
      }
    }
  });
});
