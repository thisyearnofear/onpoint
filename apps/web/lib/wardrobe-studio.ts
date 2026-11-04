import { STYLE_OUTFITS } from "./style-board";
import { FEATURED_OUTFIT_IDS } from "./runway-samples";

export interface StudioItem {
  id: string;
  kind: "garment" | "outfit";
  title: string;
  image: string;
  modeledImage?: string;
  tags: string[];
  sampleId: string;
}

export const STUDIO_GARMENTS: StudioItem[] = [
  { id: "studio-graphic-01", kind: "garment", title: "Graphic 01", image: "/assets/1Product.png", modeledImage: "/assets/1Model.png", tags: ["casual", "graphic"], sampleId: "studio-graphic-01" },
  { id: "studio-graphic-02", kind: "garment", title: "Graphic 02", image: "/assets/2Product.png", modeledImage: "/assets/2Model.png", tags: ["casual", "graphic"], sampleId: "studio-graphic-02" },
  { id: "studio-graphic-03", kind: "garment", title: "Graphic 03", image: "/assets/3Product.png", modeledImage: "/assets/3Model.png", tags: ["casual", "graphic"], sampleId: "studio-graphic-03" },
];

const studioOutfits: StudioItem[] = STYLE_OUTFITS.map((o) => ({
  id: o.id,
  kind: "outfit",
  title: o.title,
  image: o.src,
  tags: o.tags,
  sampleId: o.id,
}));

const featured = FEATURED_OUTFIT_IDS.map((id) => studioOutfits.find((o) => o.id === id)!);
const rest = studioOutfits.filter((o) => !(FEATURED_OUTFIT_IDS as readonly string[]).includes(o.id));

export const STUDIO_ITEMS: StudioItem[] = [...STUDIO_GARMENTS, ...featured, ...rest];

export const studioItemById = (id: string | null | undefined) =>
  STUDIO_ITEMS.find((i) => i.id === id) || null;

export const STORAGE_KEY = "onpoint-wardrobe-studio-v1";

export interface StudioSaved {
  savedIds: string[];
  notes: Record<string, string>;
}

export const EMPTY_SAVED: StudioSaved = { savedIds: [], notes: {} };

const sanitize = (raw: unknown): StudioSaved => {
  if (!raw || typeof raw !== "object" || (raw as { version?: unknown }).version !== 1) return EMPTY_SAVED;
  const obj = raw as { savedIds?: unknown; notes?: unknown };
  const savedIds = Array.isArray(obj.savedIds)
    ? [...new Set(obj.savedIds.filter((id): id is string => typeof id === "string" && studioItemById(id) !== null))]
    : [];
  const notes: Record<string, string> = {};
  if (obj.notes && typeof obj.notes === "object" && !Array.isArray(obj.notes)) {
    for (const [id, note] of Object.entries(obj.notes as Record<string, unknown>)) {
      if (studioItemById(id) && typeof note === "string" && note.trim()) {
        notes[id] = note.slice(0, 240);
      }
    }
  }
  return { savedIds, notes };
};

export const readStudioSaved = (): { saved: StudioSaved; available: boolean } => {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return { saved: EMPTY_SAVED, available: false };
  }
  if (!raw) return { saved: EMPTY_SAVED, available: true };
  try {
    return { saved: sanitize(JSON.parse(raw)), available: true };
  } catch {
    return { saved: EMPTY_SAVED, available: true };
  }
};

export const writeStudioSaved = (saved: StudioSaved): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, ...saved }));
    return true;
  } catch {
    return false;
  }
};
