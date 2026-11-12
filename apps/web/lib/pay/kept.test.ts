import { describe, expect, it } from "vitest";
import { addKept, KEPT_KEY, readKept, type Kept } from "./kept";

function memStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    map,
  };
}

const entry = (id: string, at = "2026-11-12T00:00:00Z"): Kept => ({
  id,
  item: `Item ${id}`,
  imageUrl: `https://r2.dev/${id}.jpg`,
  webUrl: `/p/${id}`,
  at,
});

describe("readKept", () => {
  it("empty / missing → []", () => {
    expect(readKept(memStorage())).toEqual([]);
  });

  it("corrupt JSON → []", () => {
    expect(readKept(memStorage({ [KEPT_KEY]: "{nope" }))).toEqual([]);
    expect(readKept(memStorage({ [KEPT_KEY]: "{\"a\":1}" }))).toEqual([]);
  });

  it("drops malformed entries", () => {
    const s = memStorage({ [KEPT_KEY]: JSON.stringify([entry("a"), { id: 5 }, null, entry("b")]) });
    expect(readKept(s).map((k) => k.id)).toEqual(["a", "b"]);
  });
});

describe("addKept", () => {
  it("newest first, dedupes by id, caps at 12", () => {
    const s = memStorage();
    for (let i = 0; i < 14; i++) addKept(s, entry(`k${i}`));
    const kept = readKept(s);
    expect(kept).toHaveLength(12);
    expect(kept[0]?.id).toBe("k13");
    expect(kept[11]?.id).toBe("k2");
    addKept(s, entry("k5"));
    expect(readKept(s)[0]?.id).toBe("k5");
    expect(readKept(s)).toHaveLength(12);
  });

  it("quota errors never throw", () => {
    const s = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    expect(() => addKept(s, entry("x"))).not.toThrow();
  });

  it("keeps a stored fit score; entries without one still parse", () => {
    const s = memStorage();
    addKept(s, { ...entry("a"), score: 8 });
    addKept(s, { ...entry("b"), score: null });
    addKept(s, entry("c"));
    const kept = readKept(s);
    expect(kept.find((k) => k.id === "a")?.score).toBe(8);
    expect(kept.find((k) => k.id === "b")?.score).toBeNull();
    expect(kept.find((k) => k.id === "c")?.score).toBeUndefined();
  });
});
