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
