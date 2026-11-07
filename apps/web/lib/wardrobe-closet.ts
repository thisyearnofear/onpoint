/**
 * Personal closet — on-device only (Om-Alve-style "my clothes" without the server).
 *
 * Photos never leave the device: the API planner only receives metadata
 * ({title, type, formality, warmth, colors}), and look images are rehydrated
 * locally from these data URLs by listingId (`closet-0`, `closet-1`, …).
 * Max 3 pieces keeps localStorage (~5MB) safe after downscaling.
 */

export type ClosetType = "top" | "bottom" | "dress" | "outerwear" | "footwear" | "accessory";

export interface ClosetItem {
  id: string;
  /** Downscaled data URL (JPEG ≤640px). Never sent to the server. */
  image: string;
  title: string;
  type: ClosetType;
  formality: string;
  warmth: string;
  colors: string[];
}

export const CLOSET_KEY = "onpoint-wardrobe-closet-v1";
export const MAX_CLOSET_ITEMS = 3;

export const CLOSET_TYPES: ClosetType[] = ["top", "bottom", "dress", "outerwear", "footwear", "accessory"];
export const CLOSET_FORMALITY = ["casual", "smart-casual", "formal", "sport"];
export const CLOSET_WARMTH = ["light", "medium", "heavy"];

const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

function sanitizeItem(raw: unknown, index: number): ClosetItem | null {
  if (!isRecord(raw)) return null;
  const image = typeof raw.image === "string" && raw.image.startsWith("data:image/") ? raw.image : null;
  // Guard localStorage: reject anything over ~700KB per piece.
  if (!image || image.length > 700_000) return null;
  const type = typeof raw.type === "string" ? raw.type.trim().toLowerCase() : "";
  if (!(CLOSET_TYPES as string[]).includes(type)) return null;
  const title =
    typeof raw.title === "string" && raw.title.trim()
      ? raw.title.trim().slice(0, 60)
      : `My piece ${index + 1}`;
  const pick = (v: unknown, allowed: string[]) =>
    typeof v === "string" && allowed.includes(v.trim().toLowerCase()) ? v.trim().toLowerCase() : allowed[0]!;
  const colors = Array.isArray(raw.colors)
    ? [...new Set(raw.colors.filter((c): c is string => typeof c === "string").map((c) => c.trim().toLowerCase()).filter(Boolean))].slice(0, 3)
    : [];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : `closet-${Date.now().toString(36)}-${index}`,
    image,
    title,
    type: type as ClosetType,
    formality: pick(raw.formality, CLOSET_FORMALITY),
    warmth: pick(raw.warmth, CLOSET_WARMTH),
    colors,
  };
}

export function readCloset(): { items: ClosetItem[]; available: boolean } {
  try {
    const raw = window.localStorage.getItem(CLOSET_KEY);
    if (!raw) return { items: [], available: true };
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { items: [], available: true };
    }
    const items = (parsed.items as unknown[])
      .slice(0, MAX_CLOSET_ITEMS)
      .map((r, i) => sanitizeItem(r, i))
      .filter((i): i is ClosetItem => i !== null);
    return { items, available: true };
  } catch {
    return { items: [], available: false };
  }
}

export function writeCloset(items: ClosetItem[]): boolean {
  try {
    window.localStorage.setItem(CLOSET_KEY, JSON.stringify({ version: 1, items: items.slice(0, MAX_CLOSET_ITEMS) }));
    return true;
  } catch {
    return false;
  }
}

/** Downscale an uploaded photo to a storage-safe JPEG data URL (max 640px). */
export function fileToClosetImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 640;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that photo"));
    };
    img.src = url;
  });
}

/** Metadata-only payload for POST /api/agent/outfit — no photo bytes. */
export function closetToPlannerPayload(items: ClosetItem[]) {
  return items.slice(0, MAX_CLOSET_ITEMS).map((item) => ({
    title: item.title,
    type: item.type,
    formality: item.formality,
    warmth: item.warmth,
    colors: item.colors,
  }));
}
