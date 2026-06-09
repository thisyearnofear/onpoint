/**
 * Live Session Provisioning API — /api/ai/live-session
 *
 * Proxies ALL provider session provisioning to the Hetzner backend.
 * Previously, Azure and Replicate were provisioned directly from this
 * serverless route. Now all providers (venice, replicate, azure, gemini)
 * are handled by Hetzner Express, which has persistent connections,
 * Redis-backed rate limiting, and keeps all API keys on Hetzner only.
 *
 * Architecture:
 *   Browser → Next.js Route (proxy) → Hetzner Express → Provider API → Response
 */

import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  return proxyToHetzner(request, "/api/ai/live-session", "liveSession");
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
