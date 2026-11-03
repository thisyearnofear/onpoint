import { STYLE_OUTFITS } from "./style-board";

/** Sample outfits for the no-photo Runway path (public/demo/*). */
export const RUNWAY_SAMPLES = [
  { id: "street-layers", label: "Street layers", src: "/demo/sample-street-layers.jpg" },
  { id: "white-tee", label: "White tee + denim", src: "/demo/sample-white-tee.jpg" },
  { id: "print-clash", label: "Print clash", src: "/demo/sample-print-clash.jpg" },
  { id: "cream-coat", label: "Cream coat", src: "/demo/sample-cream-coat.jpg" },
  { id: "elder-style", label: "Elder style", src: "/demo/sample-elder-style.jpg" },
  { id: "print-hat", label: "Print + blue hat", src: "/demo/sample-print-hat.jpg" },
] as const;
export type SampleId = (typeof RUNWAY_SAMPLES)[number]["id"];

/** Styled flat-lay looks from the style board — judgeable without a photo. */
export const OUTFIT_SAMPLES = STYLE_OUTFITS.map((o) => ({ id: o.id, label: o.title, src: o.src }));

export const sampleById = (id: string | null) =>
  RUNWAY_SAMPLES.find((s) => s.id === id) || OUTFIT_SAMPLES.find((s) => s.id === id) || null;
