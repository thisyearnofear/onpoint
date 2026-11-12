/**
 * "Kept on this device" — localStorage list of the try-ons this browser
 * produced. Honest scope: renders live behind their public links; the
 * list only re-surfaces them on this device (no account sync today).
 * Storage failures must never break the page — every op swallows errors.
 */

export const KEPT_KEY = "onpoint:pay-tryons";
const KEPT_CAP = 12;

export interface Kept {
  id: string;
  item: string;
  imageUrl: string;
  webUrl: string;
  receiptUrl?: string | null;
  /** Fit score at render time, if the signal read one — absent on old entries. */
  score?: number | null;
  at: string;
}

export function readKept(storage: Pick<Storage, "getItem">): Kept[] {
  try {
    const raw = storage.getItem(KEPT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (k): k is Kept =>
        !!k && typeof k.id === "string" && typeof k.imageUrl === "string" && typeof k.webUrl === "string",
    );
  } catch {
    return [];
  }
}

export function addKept(
  storage: Pick<Storage, "getItem" | "setItem">,
  entry: Kept,
): Kept[] {
  try {
    const next = [entry, ...readKept(storage).filter((k) => k.id !== entry.id)].slice(0, KEPT_CAP);
    storage.setItem(KEPT_KEY, JSON.stringify(next));
    return next;
  } catch {
    return readKept(storage);
  }
}
