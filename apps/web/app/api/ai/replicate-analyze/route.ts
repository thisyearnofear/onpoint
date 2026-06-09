/**
 * Replicate Analyze API — /api/ai/replicate-analyze
 *
 * Proxies to the Hetzner backend where the Replicate GPT-4o-mini call happens.
 * Keeps REPLICATE_API_TOKEN on Hetzner (never reaches the browser or the serverless edge).
 *
 * Architecture:
 *   Browser → Next.js Route (proxy) → Hetzner Express → Replicate API → Response
 */

import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  return proxyToHetzner(request, "/api/ai/replicate-analyze", "general");
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
