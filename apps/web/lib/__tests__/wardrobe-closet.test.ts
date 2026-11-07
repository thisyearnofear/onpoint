import { describe, expect, it } from "vitest";
import { closetToPlannerPayload, MAX_CLOSET_ITEMS } from "../wardrobe-closet";

describe("wardrobe-closet planner payload", () => {
  it("sends metadata only — never photo bytes", () => {
    const payload = closetToPlannerPayload([
      { id: "a", image: "data:image/jpeg;base64,AAA", title: "My tee", type: "top", formality: "casual", warmth: "light", colors: ["white"] },
    ]);
    expect(payload).toEqual([{ title: "My tee", type: "top", formality: "casual", warmth: "light", colors: ["white"] }]);
    expect(JSON.stringify(payload)).not.toContain("base64");
  });

  it("caps at the on-device closet size", () => {
    const many = Array.from({ length: 5 }, (_, i) => ({
      id: `c${i}`, image: "data:image/jpeg;base64,AAA", title: `Piece ${i}`, type: "top" as const,
      formality: "casual", warmth: "medium", colors: [] as string[],
    }));
    expect(closetToPlannerPayload(many)).toHaveLength(MAX_CLOSET_ITEMS);
  });
});
