/**
 * Azure Analyze API — /api/ai/azure-analyze
 *
 * Server-side proxy that calls Azure Computer Vision 4.0 for fashion analysis.
 * Keeps AZURE_CV_API_KEY and AZURE_CV_ENDPOINT secure (never reaches the browser).
 *
 * Architecture:
 *   Browser → Next.js Route → Azure CV API (Image Analysis 4.0) → Response
 *
 * Azure CV provides: object detection (garments), image tagging (clothing types),
 * captioning (natural language descriptions), and color analysis.
 */

import { rateLimit, rateLimitHeaders, getClientId } from "@/lib/utils/rate-limit";
import { formatAzureAnalysis, AZURE_ANALYZE_LIMIT } from "@/lib/utils/azure-analysis";

// Re-export for tests (vitest doesn't resolve @/ alias)
export { AZURE_ANALYZE_LIMIT };

interface AnalyzeBody {
  image: string;
  goal?: string;
}

export async function POST(request: Request) {
  const endpoint = process.env.AZURE_CV_ENDPOINT;
  const apiKey = process.env.AZURE_CV_API_KEY;

  if (!endpoint || !apiKey) {
    return Response.json(
      { error: "Azure Computer Vision not configured. Set AZURE_CV_ENDPOINT and AZURE_CV_API_KEY." },
      { status: 503 },
    );
  }

  // Rate limit check
  const clientId = getClientId(request);
  const rlResult = await rateLimit(clientId, AZURE_ANALYZE_LIMIT);

  if (!rlResult.allowed) {
    return Response.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rlResult),
          "Retry-After": String(
            Math.ceil((rlResult.resetAt - Date.now()) / 1000),
          ),
        },
      },
    );
  }

  let body: AnalyzeBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.image) {
    return Response.json({ error: "Image is required" }, { status: 400 });
  }

  try {
    // Decode base64 image to binary for Azure CV API
    const base64Data = body.image.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Data, "base64");

    const normalizedEndpoint = endpoint.replace(/\/$/, "");
    const azureUrl = `${normalizedEndpoint}/computervision/imageanalysis:analyze?api-version=2024-02-01&features=caption,denseCaptions,tags,objects`;

    const azureResponse = await fetch(azureUrl, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Content-Type": "application/octet-stream",
        "Content-Length": String(imageBuffer.length),
      },
      body: imageBuffer,
      signal: AbortSignal.timeout(15000),
    });

    if (!azureResponse.ok) {
      const errorText = await azureResponse.text().catch(() => "");
      console.error(
        `[Azure CV] API error (${azureResponse.status}):`,
        errorText,
      );

      if (azureResponse.status === 429) {
        return Response.json(
          { error: "Azure rate limit exceeded. Please wait and try again." },
          { status: 429 },
        );
      }

      return Response.json(
        {
          error: `Azure analysis failed: ${errorText || azureResponse.statusText}`,
        },
        {
          status: azureResponse.status,
          headers: { ...rateLimitHeaders(rlResult) },
        },
      );
    }

    const result = (await azureResponse.json()) as Record<string, unknown>;
    const analysis = formatAzureAnalysis(result);

    if (!analysis) {
      return Response.json(
        { error: "Empty response from Azure Computer Vision" },
        { status: 502, headers: { ...rateLimitHeaders(rlResult) } },
      );
    }

    return Response.json(
      { analysis, model: "azure-cv-4.0" },
      { headers: { ...rateLimitHeaders(rlResult) } },
    );
  } catch (error) {
    console.error("[Azure CV] Request error:", error);
    return Response.json(
      {
        error: `Azure request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      },
      { status: 502 },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
