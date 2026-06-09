import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";
import { rateLimit, rateLimitHeaders, getClientId, RateLimits } from "@/lib/utils/rate-limit";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => ({}));

  // ── Azure: provision directly ──
  if (body?.provider === "azure") {
    const clientId = getClientId(request);
    const rlResult = await rateLimit(clientId, RateLimits.replicateSession);

    if (!rlResult.allowed) {
      return Response.json(
        { error: "Too Many Requests. Please wait before starting a new session." },
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

    const cvEndpoint = process.env.AZURE_CV_ENDPOINT;
    const cvApiKey = process.env.AZURE_CV_API_KEY;
    if (!cvEndpoint || !cvApiKey) {
      return Response.json(
        { error: "Azure Computer Vision is not configured on the server." },
        { status: 503 },
      );
    }

    return Response.json({
      success: true,
      provider: "azure",
      config: {
        pollingInterval: 3000,
        model: "azure-cv-4.0",
        endpoint: "/api/ai/azure-analyze",
      },
      limits: {
        maxCaptures: 10,
        maxSessionDuration: 300,
        maxFramesPerMinute: 20,
      },
    });
  }

  // ── Replicate: provision directly (no Hetzner proxy needed) ──
  if (body?.provider === "replicate") {
    const clientId = getClientId(request);
    const rlResult = await rateLimit(clientId, RateLimits.replicateSession);

    if (!rlResult.allowed) {
      return Response.json(
        { error: "Too Many Requests. Please wait before starting a new session." },
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

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      return Response.json(
        { error: "Replicate AI is not configured on the server." },
        { status: 503 },
      );
    }

    return Response.json({
      success: true,
      provider: "replicate",
      config: {
        pollingInterval: 2500,
        model: "gpt-4o-mini",
        endpoint: "/api/ai/replicate-analyze",
      },
      limits: {
        maxCaptures: 10,
        maxSessionDuration: 300,
        maxFramesPerMinute: 24,
      },
    });
  }

  // ── Venice & Gemini: proxy through Hetzner ──
  let tier = "geminiSession";
  if (body?.provider === "venice") tier = "veniceFree";

  return proxyToHetzner(request, "/api/ai/live-session", tier);
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
