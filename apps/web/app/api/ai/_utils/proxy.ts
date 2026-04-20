/**
 * AI Proxy — forwards heavy AI requests to Hetzner persistent server.
 *
 * When NEXT_PUBLIC_AGENT_API_URL is set, AI routes that call LLM providers
 * proxy to Hetzner instead of running on serverless (avoids cold starts
 * and timeout limits). Falls back to local execution when not configured.
 *
 * Usage in a route:
 *   const proxied = await proxyToHetzner(request, "/api/ai/agent");
 *   if (proxied) return proxied;
 *   // ... local fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "./http";

const HETZNER_URL = process.env.NEXT_PUBLIC_AGENT_API_URL;

/**
 * Proxy a request to the Hetzner backend.
 * Returns the proxied Response, or null if Hetzner is not configured.
 */
export async function proxyToHetzner(
  request: NextRequest,
  path: string,
): Promise<NextResponse | null> {
  if (!HETZNER_URL) return null;

  const origin = request.headers.get("origin") || "*";
  const url = `${HETZNER_URL.replace(/\/$/, "")}${path}`;

  try {
    const body = request.method !== "GET" ? await request.text() : undefined;

    const res = await fetch(url, {
      method: request.method,
      headers: {
        "Content-Type": request.headers.get("Content-Type") || "application/json",
      },
      body,
    });

    const data = await res.text();

    return new NextResponse(data, {
      status: res.status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": res.headers.get("Content-Type") || "application/json",
      },
    });
  } catch {
    // Hetzner unreachable — fall through to local execution
    return null;
  }
}
