import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function POST(request: Request) {
  const body = await request.clone().json().catch(() => ({}));
  const tier = body?.provider === "venice" ? "veniceFree" : "geminiSession";

  return proxyToHetzner(request, "/api/ai/live-session", tier);
}

export async function OPTIONS() {
  return new Response(null, {
    headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" },
  });
}
