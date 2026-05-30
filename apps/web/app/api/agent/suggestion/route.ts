import { NextRequest, NextResponse } from "next/server";
export { OPTIONS } from "../../ai/_utils/http";

const API_BASE = (
  process.env.AGENT_API_URL ||
  process.env.NEXT_PUBLIC_AGENT_API_URL ||
  ""
).replace(/\/$/, "");

const SERVICE_KEY = process.env.SERVICE_API_KEY || "";

async function proxySuggestion(request: NextRequest): Promise<NextResponse> {
  if (!API_BASE) {
    return NextResponse.json(
      { error: "Agent API URL not configured" },
      { status: 500 },
    );
  }

  if (!SERVICE_KEY) {
    return NextResponse.json(
      { error: "SERVICE_API_KEY not configured" },
      { status: 500 },
    );
  }

  const sourceUrl = new URL(request.url);
  const targetUrl = new URL("/api/agent/suggestion", API_BASE);
  sourceUrl.searchParams.forEach((value, key) => {
    targetUrl.searchParams.set(key, value);
  });

  const agentId = sourceUrl.searchParams.get("agentId") || "onpoint-stylist";
  const userId =
    request.headers.get("x-user-id") ||
    sourceUrl.searchParams.get("userId") ||
    "web-client";

  const headers: Record<string, string> = {
    "x-service-key": SERVICE_KEY,
    "x-user-id": userId,
    "x-agent-id": agentId,
  };

  const contentType = request.headers.get("content-type");
  if (contentType) headers["content-type"] = contentType;

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.text();

  try {
    const response = await fetch(targetUrl.toString(), {
      method: request.method,
      headers,
      body,
      signal: AbortSignal.timeout(30000),
    });

    const text = await response.text();
    const responseType = response.headers.get("content-type") || "application/json";

    return new NextResponse(text, {
      status: response.status,
      headers: {
        "content-type": responseType,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Suggestion proxy failed";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  return proxySuggestion(request);
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  return proxySuggestion(request);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  return proxySuggestion(request);
}
