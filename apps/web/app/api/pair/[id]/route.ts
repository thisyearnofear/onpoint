import { proxyToHetzner } from "@/lib/utils/proxy-to-hetzner";

export async function GET(request: Request) {
  const id = new URL(request.url).pathname.split("/").filter(Boolean).pop();
  return proxyToHetzner(request, `/api/pair/${encodeURIComponent(id || "")}`, "general");
}
