import type { VirtualTryOnAnalysis } from "../providers/base-provider";

const DEFAULT_MEASUREMENTS: VirtualTryOnAnalysis["measurements"] = {
  shoulders: "unknown",
  chest: "unknown",
  waist: "unknown",
  hips: "unknown",
};

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;

  const items = value
    .map((item) => asString(item))
    .filter(Boolean)
    .slice(0, 6);

  return items.length > 0 ? items : fallback;
}

function normalizeMeasurements(
  value: unknown,
): VirtualTryOnAnalysis["measurements"] {
  if (!value || typeof value !== "object") return DEFAULT_MEASUREMENTS;
  const measurements = value as Record<string, unknown>;

  return {
    shoulders: asString(measurements.shoulders, "unknown"),
    chest: asString(measurements.chest, "unknown"),
    waist: asString(measurements.waist, "unknown"),
    hips: asString(measurements.hips, "unknown"),
  };
}

export function normalizeVirtualTryOnAnalysis(
  value: unknown,
): VirtualTryOnAnalysis {
  const data =
    value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    bodyType: asString(data.bodyType, "unknown"),
    measurements: normalizeMeasurements(data.measurements),
    fitRecommendations: asStringArray(data.fitRecommendations, [
      "Use a clearer full-body photo for more precise fit recommendations.",
    ]),
    styleAdjustments: asStringArray(
      data.styleRecommendations ?? data.styleAdjustments,
      ["Try a well-lit full-body photo for more specific style guidance."],
    ),
    currentLook: asStringArray(data.currentLook, []),
    personalization: asStringArray(data.personalization, []),
    score:
      typeof data.score === "number"
        ? Math.min(10, Math.max(1, Math.round(data.score)))
        : undefined,
    confidence:
      typeof data.confidence === "number"
        ? Math.min(
            1,
            Math.max(0, data.confidence > 1 ? data.confidence / 100 : data.confidence),
          )
        : undefined,
  };
}
