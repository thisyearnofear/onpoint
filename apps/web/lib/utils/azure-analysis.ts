/**
 * Parse Azure Computer Vision 4.0 response into a formatted fashion analysis.
 * Pure function — no side effects, no environment dependencies.
 */

// Rate limit: 20 requests per minute per client (Azure F0 free tier limit is 20/min)
export const AZURE_ANALYZE_LIMIT = {
  maxRequests: 20,
  windowMs: 60 * 1000,
  prefix: "azure-analyze",
} as const;

export function formatAzureAnalysis(result: Record<string, unknown>): string {
  const parts: string[] = [];

  // Extract caption
  const captionResult = result.captionResult as
    | { text?: string; confidence?: number }
    | undefined;
  if (captionResult?.text) {
    parts.push(`📝 ${captionResult.text}`);
  }

  // Extract dense captions for detailed descriptions
  const denseCaptions = result.denseCaptionsResult as
    | { values?: Array<{ text?: string; confidence?: number }> }
    | undefined;
  if (denseCaptions?.values?.length) {
    const top = denseCaptions.values
      .filter((v) => (v.confidence ?? 0) > 0.5)
      .slice(0, 3)
      .map((v) => v.text)
      .filter(Boolean);
    if (top.length) {
      parts.push(`🔍 Details: ${top.join(" | ")}`);
    }
  }

  // Extract tags with high confidence
  const tagsResult = result.tagsResult as
    | { tags?: Array<{ name?: string; confidence?: number }> }
    | undefined;
  if (tagsResult?.tags?.length) {
    const clothingTags = tagsResult.tags
      .filter(
        (t) =>
          (t.confidence ?? 0) > 0.7 &&
          t.name &&
          !["indoor", "outdoor", "text", "person", "portrait"].includes(
            t.name.toLowerCase(),
          ),
      )
      .map((t) => t.name)
      .filter(Boolean);
    if (clothingTags.length) {
      parts.push(`👕 Detected: ${clothingTags.join(", ")}`);
    }
  }

  // Extract objects (garment-level detection)
  const objectsResult = result.objectsResult as
    | { objects?: Array<{ name?: string; confidence?: number }> }
    | undefined;
  if (objectsResult?.objects?.length) {
    const garments = objectsResult.objects
      .filter((o) => (o.confidence ?? 0) > 0.5 && o.name)
      .map((o) => o.name)
      .filter(Boolean);
    if (garments.length) {
      parts.push(`🎯 Items: ${garments.join(", ")}`);
    }
  }

  return parts.length > 0
    ? parts.join("\n\n")
    : "Analysis completed. No specific fashion attributes detected in this frame.";
}
