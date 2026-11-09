import { proxyToHetzner, GENERATION_TIMEOUT_MS } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  const segments = new URL(request.url).pathname.split("/").filter(Boolean);
  const id = segments[segments.length - 2] || "";
  return proxyToHetzner(request, `/api/pair/${encodeURIComponent(id)}/join`, "veniceFree", {
    timeoutMs: GENERATION_TIMEOUT_MS,
  });
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
