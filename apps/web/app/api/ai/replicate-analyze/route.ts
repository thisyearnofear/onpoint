/**
 * Replicate Analyze API — /api/ai/replicate-analyze
 *
 * Server-side proxy that calls GPT-4o-mini via the Replicate API.
 * Keeps REPLICATE_API_TOKEN secure (never reaches the browser).
 *
 * Architecture:
 *   Browser → Next.js Route → Replicate API (GPT-4o-mini) → Response
 */

import { rateLimit, rateLimitHeaders, getClientId } from "@/lib/utils/rate-limit";
import { buildFashionPrompt } from "@/lib/utils/replicate-prompt";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

// Rate limit: 30 requests per minute per client (Replicate charges per call)
const REPLICATE_ANALYZE_LIMIT = {
  maxRequests: 30,
  windowMs: 60 * 1000,
  prefix: "replicate-analyze",
} as const;

// Max polling attempts for async predictions (if Prefer: wait returns 202)
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 1000;

interface AnalyzeBody {
  image: string;
  goal?: string;
  persona?: string;
}
function extractOutput(result: Record<string, unknown>): string {
  const output = result.output;
  if (typeof output === "string") return output;
  if (Array.isArray(output)) return output.join("");
  if (output && typeof output === "object") return JSON.stringify(output);
  return "";
}

async function pollPrediction(
  getUrl: string,
  apiToken: string,
): Promise<string | null> {
  for (let i = 0; i < MAX_POLL_ATTEMPTS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const pollResponse = await fetch(getUrl, {
      headers: { Authorization: `Bearer ${apiToken}` },
    });

    if (!pollResponse.ok) break;

    const pollResult = (await pollResponse.json()) as Record<string, unknown>;

    if (pollResult.status === "succeeded") {
      return extractOutput(pollResult);
    }

    if (pollResult.status === "failed") {
      const error = (pollResult.error as string) || "Prediction failed";
      console.error("[Replicate] Prediction failed:", error);
      return null;
    }

    // Still processing — continue polling
  }

  console.error("[Replicate] Prediction polling timed out");
  return null;
}

export async function POST(request: Request) {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  if (!apiToken) {
    return Response.json(
      { error: "Replicate API token not configured" },
      { status: 500 },
    );
  }

  // Rate limit check
  const clientId = getClientId(request);
  const rlResult = await rateLimit(clientId, REPLICATE_ANALYZE_LIMIT);

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

  const goal = body.goal || "daily";
  const persona = body.persona;

  try {
    // Call Replicate's prediction endpoint for GPT-4o-mini
    const replicateResponse = await fetch(
      `${REPLICATE_API_BASE}/models/openai/gpt-4o-mini/predictions`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt: buildFashionPrompt(goal, persona),
            image_input: body.image,
            system_prompt:
              "You are a professional fashion stylist and critic with expertise in fit, color theory, fabric, and occasion dressing.",
            max_completion_tokens: 2000,
            temperature: 0.7,
          },
        }),
      },
    );

    if (!replicateResponse.ok) {
      const errorText = await replicateResponse.text().catch(() => "");
      console.error(
        `[Replicate] API error (${replicateResponse.status}):`,
        errorText,
      );

      if (replicateResponse.status === 429) {
        return Response.json(
          { error: "Replicate API rate limit exceeded. Please wait and try again." },
          { status: 429 },
        );
      }

      return Response.json(
        {
          error: `Replicate analysis failed: ${errorText || replicateResponse.statusText}`,
        },
        {
          status: replicateResponse.status,
          headers: { ...rateLimitHeaders(rlResult) },
        },
      );
    }

    const result = (await replicateResponse.json()) as Record<string, unknown>;

    // Handle async prediction (202 with polling URL)
    const urlsObj = result.urls;
    const pollUrl =
      urlsObj && typeof urlsObj === "object"
        ? (urlsObj as Record<string, unknown>).get
        : undefined;

    if (replicateResponse.status === 202 && typeof pollUrl === "string") {
      console.log("[Replicate] Prediction pending — polling...");
      const output = await pollPrediction(pollUrl, apiToken);

      if (!output) {
        return Response.json(
          { error: "AI analysis timed out. Please try again." },
          { status: 504, headers: { ...rateLimitHeaders(rlResult) } },
        );
      }

      return Response.json(
        { analysis: output, model: "gpt-4o-mini" },
        { headers: { ...rateLimitHeaders(rlResult) } },
      );
    }

    // Extract the output from the completed prediction
    const analysis = extractOutput(result);

    if (!analysis) {
      return Response.json(
        { error: "Empty response from Replicate" },
        { status: 502, headers: { ...rateLimitHeaders(rlResult) } },
      );
    }

    return Response.json(
      { analysis, model: "gpt-4o-mini" },
      { headers: { ...rateLimitHeaders(rlResult) } },
    );
  } catch (error) {
    console.error("[Replicate] Request error:", error);
    return Response.json(
      {
        error: `Replicate request failed: ${error instanceof Error ? error.message : "Unknown error"}`,
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
