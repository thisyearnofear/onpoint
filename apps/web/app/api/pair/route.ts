import { proxyToHetzner, GENERATION_TIMEOUT_MS } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  // Try-on renders can run long upstream (YouCam/Replicate/Gemini) — give the
  // proxy headroom instead of aborting mid-work.
  return proxyToHetzner(request, "/api/pair", "veniceFree", {
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
