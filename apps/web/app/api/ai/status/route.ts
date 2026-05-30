import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { geminiAvailable, openaiAvailable, veniceAvailable } from "../_utils/providers";

export { OPTIONS } from "../_utils/http";

// Cache at the edge for 60s, serve stale for 5min while revalidating.
// Prevents every public health-check from burning a serverless invocation.
export const revalidate = 60;

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  try {
    const status = {
      ok: true,
      providers: {
        venice: veniceAvailable(),
        gemini: geminiAvailable(),
        openai: openaiAvailable(),
      },
      defaults: {
        geminiModel: 'gemini-3.1-flash-lite',
        openaiModel: 'gpt-3.5-turbo',
      },
    };
    return NextResponse.json(status, {
      headers: {
        ...corsHeaders(origin),
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch {
    return NextResponse.json({ ok: false, error: 'Status check failed' }, { status: 500, headers: corsHeaders(origin) });
  }
}
