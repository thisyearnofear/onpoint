import { proxyToHetzner, GENERATION_TIMEOUT_MS } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  // Replicate IDM-VTON budgets up to 120s upstream; give the proxy headroom
  // instead of aborting mid-work and surfacing a false 503.
  return proxyToHetzner(request, "/api/ai/virtual-tryon", "veniceFree", {
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
