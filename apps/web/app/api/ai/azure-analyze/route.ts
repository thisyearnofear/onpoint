/**
 * Azure Analyze API — /api/ai/azure-analyze
 *
 * Proxies to the Hetzner backend where the Azure Computer Vision 4.0 call happens.
 * Keeps AZURE_CV_API_KEY and AZURE_CV_ENDPOINT on Hetzner (never reaches the browser
 * or the serverless edge).
 *
 * Architecture:
 *   Browser → Next.js Route (proxy) → Hetzner Express → Azure CV API → Response
 */

import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  return proxyToHetzner(request, "/api/ai/azure-analyze", "general");
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
