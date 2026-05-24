/**
 * Hetzner API Proxy
 *
 * Server-side proxy that forwards requests to the Hetzner Express API server
 * with VENICE_API_KEY injected. The key never reaches the browser.
 */

export async function proxyToHetzner(request: Request, path: string): Promise<Response> {
  const hetznerUrl = process.env.NEXT_PUBLIC_AGENT_API_URL;
  if (!hetznerUrl) {
    return Response.json({ error: "Hetzner API URL not configured" }, { status: 500 });
  }

  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey || apiKey === "your_venice_api_key_here") {
    return Response.json({ error: "Venice API key not configured" }, { status: 500 });
  }

  const targetUrl = `${hetznerUrl.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

  try {
    const body = request.method !== "GET" && request.method !== "HEAD"
      ? await request.text()
      : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
        "x-api-key": apiKey,
      },
      body,
    });

    const data = await response.text();
    const contentType = response.headers.get("content-type") || "text/plain";

    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    console.error(`[Proxy] Hetzner request failed for ${path}:`, error);
    return Response.json({ error: "API server unavailable" }, { status: 503 });
  }
}
