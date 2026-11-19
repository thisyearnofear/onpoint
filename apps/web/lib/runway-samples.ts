import { STYLE_OUTFITS } from "./style-board";

/** Sample outfits for the no-photo Runway path (public/demo/*). */
export const RUNWAY_SAMPLES = [
  { id: "street-layers", label: "White tee + jeans", src: "/demo/sample-street-layers.jpg" },
  { id: "white-tee", label: "Graphic tee + jeans", src: "/demo/sample-white-tee.jpg" },
  { id: "print-clash", label: "Graphic tee + denim shorts", src: "/demo/sample-print-clash.jpg" },
  { id: "cream-coat", label: "Cream utility set", src: "/demo/sample-cream-coat.jpg" },
  { id: "elder-style", label: "Beaded accessories portrait", src: "/demo/sample-elder-style.jpg" },
  { id: "print-hat", label: "Color-block look + blue hat", src: "/demo/sample-print-hat.jpg" },
] as const;
export type SampleId = (typeof RUNWAY_SAMPLES)[number]["id"];

/** Styled flat-lay looks from the style board — judgeable without a photo. */
export const OUTFIT_SAMPLES = STYLE_OUTFITS.map((o) => ({ id: o.id, label: o.title, src: o.src }));

export const sampleById = (id: string | null) =>
  RUNWAY_SAMPLES.find((s) => s.id === id) ||
  OUTFIT_SAMPLES.find((s) => s.id === id) ||
  STUDIO_MODEL_SAMPLES.find((s) => s.id === id) ||
  STUDIO_TRYON_SAMPLES.find((s) => s.id === id) ||
  null;

export const FEATURED_OUTFIT_IDS = [
  "spr-0161",
  "spr-0217",
  "sum-0241",
  "aut-0169",
  "win-0240",
  "pty-0013",
] as const;
export const FEATURED_OUTFIT_SAMPLES = FEATURED_OUTFIT_IDS.map((id) => {
  const o = STYLE_OUTFITS.find((outfit) => outfit.id === id);
  if (!o) throw new Error(`Featured outfit id not in STYLE_OUTFITS: ${id}`);
  return { id: o.id, label: o.title, src: o.src };
});

export const STUDIO_MODEL_SAMPLES = [
  { id: "studio-graphic-01", label: "Graphic 01 + denim shorts", src: "/assets/1Model.png" },
  { id: "studio-graphic-02", label: "Graphic 02 + denim shorts", src: "/assets/2Model.png" },
  { id: "studio-graphic-03", label: "Graphic 03 + denim shorts", src: "/assets/3Model.png" },
] as const;

/** Fuser virtual-try-on renders (assets/fuser/MANIFEST.md) — the studio
 *  models above wearing the flat garment shots, clean gray backdrops. */
export const STUDIO_TRYON_SAMPLES = [
  { id: "studio-tryon-01", label: "Try-on: Graphic 01 on model 01", src: "/assets/1TryOn.jpg" },
  { id: "studio-tryon-02", label: "Try-on: Graphic 02 on model 02", src: "/assets/2TryOn.jpg" },
  { id: "studio-tryon-03", label: "Try-on: Graphic 03 on model 03", src: "/assets/3TryOn.jpg" },
] as const;
