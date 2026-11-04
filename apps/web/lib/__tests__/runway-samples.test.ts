import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import {
  RUNWAY_SAMPLES,
  OUTFIT_SAMPLES,
  FEATURED_OUTFIT_IDS,
  FEATURED_OUTFIT_SAMPLES,
  sampleById,
} from "../runway-samples";
import { STYLE_OUTFITS } from "../style-board";

const apiRequire = createRequire(path.resolve(__dirname, "../../../api/package.json"));
const { STYLE_OUTFITS: API_OUTFITS } = apiRequire("../api/lib/runway/style-board.js");

describe("RUNWAY_SAMPLES (legacy photo samples)", () => {
  it("preserves all six ids and image paths", () => {
    expect(RUNWAY_SAMPLES.map((s) => s.id)).toEqual([
      "street-layers",
      "white-tee",
      "print-clash",
      "cream-coat",
      "elder-style",
      "print-hat",
    ]);
    for (const s of RUNWAY_SAMPLES) {
      expect(s.src).toBe(`/demo/sample-${s.id}.jpg`);
    }
  });

  it("uses corrected, accurate labels", () => {
    const labels = Object.fromEntries(RUNWAY_SAMPLES.map((s) => [s.id, s.label]));
    expect(labels["street-layers"]).toBe("White tee + jeans");
    expect(labels["white-tee"]).toBe("Graphic tee + jeans");
    expect(labels["print-clash"]).toBe("Graphic tee + denim shorts");
    expect(labels["cream-coat"]).toBe("Cream utility set");
    expect(labels["elder-style"]).toBe("Beaded accessories portrait");
    expect(labels["print-hat"]).toBe("Color-block look + blue hat");
  });

  it("sampleById still resolves legacy and outfit ids", () => {
    expect(sampleById("street-layers")?.src).toBe("/demo/sample-street-layers.jpg");
    expect(sampleById("spr-0161")?.src).toBe("/demo/outfits/spr-0161.webp");
    expect(sampleById("nope")).toBeNull();
    expect(sampleById(null)).toBeNull();
  });
});

describe("FEATURED_OUTFIT_SAMPLES (homepage curation)", () => {
  it("contains exactly the approved six ids, unique", () => {
    expect([...FEATURED_OUTFIT_IDS]).toEqual([
      "spr-0161",
      "spr-0217",
      "sum-0241",
      "aut-0169",
      "win-0240",
      "pty-0013",
    ]);
    expect(new Set(FEATURED_OUTFIT_IDS).size).toBe(FEATURED_OUTFIT_IDS.length);
  });

  it("resolves every featured id to a real style-board asset on disk", () => {
    expect(FEATURED_OUTFIT_SAMPLES).toHaveLength(6);
    const publicDir = path.resolve(__dirname, "../../public");
    for (const s of FEATURED_OUTFIT_SAMPLES) {
      const outfit = STYLE_OUTFITS.find((o) => o.id === s.id);
      expect(outfit).toBeTruthy();
      expect(s.label).toBe(outfit!.title);
      expect(s.src).toBe(outfit!.src);
      expect(existsSync(path.join(publicDir, s.src))).toBe(true);
    }
  });
});

describe("style-board web/api parity", () => {
  it("id, title and tags match the API mirror exactly", () => {
    expect(STYLE_OUTFITS).toHaveLength(API_OUTFITS.length);
    for (const api of API_OUTFITS) {
      const web = STYLE_OUTFITS.find((o) => o.id === api.id);
      expect(web, `missing ${api.id}`).toBeTruthy();
      expect(web!.title).toBe(api.title);
      expect(web!.tags).toEqual(api.tags);
      expect(web!.src).toBe(`/demo/outfits/${api.id}.webp`);
    }
  });

  it("all 34 looks remain available", () => {
    expect(STYLE_OUTFITS).toHaveLength(34);
    expect(OUTFIT_SAMPLES).toHaveLength(34);
  });
});
