import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../_utils/http";
import { geminiAvailable, openaiAvailable } from "../_utils/providers";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

export { OPTIONS } from "../_utils/http";

export async function GET(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429, headers: corsHeaders(origin) });
  }
  try {
    const status = {
      ok: true,
      providers: {
        gemini: geminiAvailable(),
        openai: openaiAvailable(),
      },
      defaults: {
        geminiModel: 'gemini-3.1-flash-lite',
        openaiModel: 'gpt-3.5-turbo',
      },
    };
    return NextResponse.json(status, { headers: corsHeaders(origin) });
  } catch {
    return NextResponse.json({ ok: false, error: 'Status check failed' }, { status: 500, headers: corsHeaders(origin) });
  }
}
