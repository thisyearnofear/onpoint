/**
 * Qwen Cloud Analyze API — /api/ai/qwen-analyze
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent. Proxies to the Hetzner
 * backend where the Qwen Cloud (DashScope) call happens. Keeps
 * DASHSCOPE_API_KEY on Hetzner (never reaches the browser or the
 * serverless edge).
 *
 * Architecture:
 *   Browser → Next.js Route (proxy) → Hetzner Express → Qwen Cloud → Response
 *
 * The default model (qwen3-vl-flash) is the cheapest vision-capable entry
 * on the Qwen Cloud catalog. Spend controls (kill switch, daily budget,
 * max_tokens caps, enable_thinking: false) are enforced on Hetzner.
 */

import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  return proxyToHetzner(request, "/api/ai/qwen-analyze", "general");
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
