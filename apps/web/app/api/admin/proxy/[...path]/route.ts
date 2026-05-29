import { NextRequest, NextResponse } from "next/server";

/**
 * Admin API Proxy — forwards listing CRUD and photo upload requests
 * from the browser to the Hetzner API with the service key.
 *
 * Route: /api/admin/proxy/curators/:slug/listings/...
 *
 * The browser cannot send SERVICE_API_KEY, so this proxy adds it
 * server-side via the x-service-key header.
 */

const API_BASE = (
  process.env.AGENT_API_URL ||
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  "http://localhost:48751"
).replace(/\/$/, "");

const SERVICE_KEY = process.env.SERVICE_API_KEY || "";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest("GET", path, request);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest("PUT", path, request);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest("POST", path, request);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest("DELETE", path, request);
}

async function proxyRequest(
  method: string,
  path: string[],
  request: NextRequest,
): Promise<NextResponse> {
  try {
    const targetPath = `/api/admin/${path.join("/")}`;
    const targetUrl = `${API_BASE}${targetPath}`;

    // Build fetch options
    const headers: Record<string, string> = {
      "x-service-key": SERVICE_KEY,
    };

    // Forward content-type if the client sends a body
    const reqContentType = request.headers.get("content-type");
    if (reqContentType) {
      headers["content-type"] = reqContentType;
    }

    const fetchOptions: RequestInit = {
      method,
      headers,
    };

    // For POST/PUT with JSON body, forward the body
    if (["POST", "PUT"].includes(method) && reqContentType?.includes("application/json")) {
      const body = await request.json();
      fetchOptions.body = JSON.stringify(body);
    }

    const res = await fetch(targetUrl, {
      ...fetchOptions,
      signal: AbortSignal.timeout(30000),
    });

    const data = await res.json().catch(() => null);

    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Proxy request failed";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}
