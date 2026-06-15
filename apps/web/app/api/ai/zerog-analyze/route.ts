/**
 * 0G Compute Analyze API — /api/ai/zerog-analyze
 *
 * Wave 1, 0G Bridge Buildathon. Proxies to the Hetzner backend where
 * the 0G Router call happens. Keeps ZERO_G_API_KEY on Hetzner (never
 * reaches the browser or the serverless edge).
 *
 * Architecture:
 *   Browser → Next.js Route (proxy) → Hetzner Express → 0G Router → Response
 *
 * The default model (qwen3-vl-30b) is the cheapest vision-capable entry
 * on the live 0G Router catalog. verify_tee is requested by default so
 * the response surfaces the TEE attestation (TeeTLS / dstack / TDX) to
 * the verifiable-receipts pipeline.
 */

import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  return proxyToHetzner(request, "/api/ai/zerog-analyze", "general");
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
