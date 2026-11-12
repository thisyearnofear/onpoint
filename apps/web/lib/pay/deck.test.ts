import { describe, expect, it } from "vitest";
import { nextCard } from "./deck";

function base(overrides: Partial<Parameters<typeof nextCard>[0]> = {}) {
  return {
    current: 0,
    guessLocked: false,
    queued: false,
    lastInteractionMs: 0,
    now: 30_000,
    cyclesDone: 0,
    manual: false,
    ...overrides,
  };
}

describe("nextCard", () => {
  it("guess locked on card 1 → card 2", () => {
    expect(nextCard(base({ guessLocked: true }))).toBe(1);
  });

  it("piece queued on card 2 → card 3", () => {
    expect(nextCard(base({ current: 1, queued: true }))).toBe(2);
  });

  it("nudges still fire after a manual tap", () => {
    expect(nextCard(base({ manual: true, guessLocked: true }))).toBe(1);
    expect(nextCard(base({ manual: true, current: 1, queued: true }))).toBe(2);
  });

  it("idle 9s → next card, wrapping to 0", () => {
    expect(nextCard(base({ lastInteractionMs: 20_000 }))).toBe(1);
    expect(nextCard(base({ current: 2, lastInteractionMs: 0 }))).toBe(0);
  });

  it("interaction <9s ago → null", () => {
    expect(nextCard(base({ lastInteractionMs: 25_000 }))).toBeNull();
  });

  it("manual tap → null (no nudge pending)", () => {
    expect(nextCard(base({ manual: true, lastInteractionMs: 0 }))).toBeNull();
  });

  it("one full cycle done → null", () => {
    expect(nextCard(base({ cyclesDone: 1 }))).toBeNull();
    expect(nextCard(base({ cyclesDone: 1, current: 2 }))).toBeNull();
  });
});
