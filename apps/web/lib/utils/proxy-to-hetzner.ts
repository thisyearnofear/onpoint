/**
 * Hetzner API Proxy
 *
 * Server-side proxy that forwards requests to the Hetzner Express API server
 * with VENICE_API_KEY injected + Vercel-side rate limiting (defense in depth).
 * The key never reaches the browser.
 */

import { rateLimit, rateLimitHeaders, RateLimits } from "./rate-limit";

type RateLimitTier = keyof typeof RateLimits;

// How long to wait for the upstream before treating it as unavailable.
const UPSTREAM_TIMEOUT_MS = 30_000;
// Gateway-level statuses that mean "the backend itself is down" (as opposed
// to a meaningful 4xx the client should see). These get converted into a
// clean, retryable JSON response instead of leaking nginx's 502 HTML page.
const GATEWAY_DOWN_STATUSES = new Set([502, 503, 504]);

function unavailableResponse(rlHeaders: Record<string, string>): Response {
  return Response.json(
    {
      error: "Styling service is temporarily unavailable. Please try again in a moment.",
      retryable: true,
    },
    {
      status: 503,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Retry-After": "10",
        ...rlHeaders,
      },
    },
  );
}

export async function proxyToHetzner(request: Request, path: string, tier: RateLimitTier = "general"): Promise<Response> {
  const hetznerUrl = process.env.NEXT_PUBLIC_AGENT_API_URL;
  if (!hetznerUrl) {
    return Response.json({ error: "Hetzner API URL not configured" }, { status: 500 });
  }

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey || apiKey === "your_venice_api_key_here") {
    return Response.json({ error: "Venice API key not configured" }, { status: 500 });
  }

  // Vercel-side rate limit (defense in depth — Hetzner also rate limits)
  const clientIp = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const rlResult = await rateLimit(clientIp, RateLimits[tier]);

  if (!rlResult.allowed) {
    return Response.json(
      { error: "Too Many Requests" },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rlResult),
          "Retry-After": String(Math.ceil((rlResult.resetAt - Date.now()) / 1000)),
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }

  const targetUrl = `${hetznerUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;
  const rlHeaders = rateLimitHeaders(rlResult);

  let body: string | undefined;
  try {
    body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Try twice: one immediate retry rides out brief restarts / gateway blips.
  // Retries are only safe because these proxied AI endpoints are idempotent
  // reads (analysis), not state-mutating writes.
  const maxAttempts = 2;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const response = await fetch(targetUrl, {
        method: request.method,
        headers: {
          "Content-Type": request.headers.get("Content-Type") || "application/json",
          "x-api-key": apiKey,
        },
        body,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      // Backend reachable but its gateway reports it's down → retry once,
      // then return a clean retryable message instead of nginx's 502 HTML.
      if (GATEWAY_DOWN_STATUSES.has(response.status)) {
        if (attempt < maxAttempts) continue;
        console.error(`[Proxy] Hetzner gateway down for ${path}: HTTP ${response.status}`);
        return unavailableResponse(rlHeaders);
      }

      const data = await response.text();
      const contentType = response.headers.get("content-type") || "text/plain";

      return new Response(data, {
        status: response.status,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*",
          ...rlHeaders,
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      if (attempt < maxAttempts) continue;
      console.error(`[Proxy] Hetzner request failed for ${path}:`, error);
      return unavailableResponse(rlHeaders);
    }
  }

  // Unreachable, but satisfies the type checker.
  return unavailableResponse(rlHeaders);
}
