/**
 * Runway web helpers (ADR 0022). Pure utilities for the browser game:
 * device detection for CTA ordering, countdown formatting, client-side
 * photo downscale, and a theme-name map for the look-page banner.
 */

export const RUNWAY_THEME_NAMES: Record<string, string> = {
  "brat-summer": "Brat Summer",
  "quiet-luxury": "Quiet Luxury",
  "off-duty-model": "Off-Duty Model",
  "rooftop-brunch": "Rooftop Brunch",
  "first-date": "First Date",
  "job-interview-creative": "Creative Job Interview",
  "y2k-revival": "Y2K Revival",
  "dark-academia": "Dark Academia",
  "coastal-grandmother": "Coastal Grandmother",
  "gorpcore": "Gorpcore",
  "monochrome": "Head-to-Toe Monochrome",
  "clash-on-purpose": "Clash on Purpose",
  "ankara-modern": "Ankara, Modern",
  "nairobi-night-out": "Nairobi Night Out",
  "wedding-guest": "Wedding Guest (Not the Bride)",
  "festival": "Festival Main Stage",
  "airport-fit": "Airport Fit",
  "villain-era": "Villain Era",
  "sports-luxe": "Sports Luxe",
  "jersey-styled": "Matchday Jersey, Styled",
  "thrift-flip": "Thrift Flip",
  "one-colour-pop": "Neutral + One Pop",
  "cozy-but-chic": "Cozy but Chic",
  "art-gallery-opening": "Gallery Opening",
  "denim-on-denim": "Denim on Denim",
  "old-money-weekend": "Old Money Weekend",
  "red-carpet-diy": "Red Carpet from Your Closet",
  "freestyle": "Freestyle",
};

/** iPhone/iPad gets "Text the judge" first (native iMessage); everything else plays in-browser. */
export function runwayCtaOrder(userAgent: string): "sms-first" | "web-first" {
  return /iPhone|iPad|iPod/i.test(userAgent) ? "sms-first" : "web-first";
}

/** m:ss countdown; negative clamps to 0:00. */
export function formatCountdown(msLeft: number): string {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Target dimensions fitting inside maxPx (never upscale). */
export function fitWithin(width: number, height: number, maxPx = 1024): { width: number; height: number } {
  if (width <= 0 || height <= 0) return { width: maxPx, height: maxPx };
  const scale = Math.min(1, maxPx / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Downscale a picked image to a ≤1024px JPEG data URL (saves mobile data). */
export async function imageFileToJpegDataUrl(file: File, maxPx = 1024, quality = 0.8): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, maxPx);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas unavailable");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    bitmap.close?.();
  }
}

export function runwayPlayerId(): string {
  const KEY = "runway:playerId";
  try {
    const existing = localStorage.getItem(KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
