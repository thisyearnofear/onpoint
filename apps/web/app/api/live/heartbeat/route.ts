import { NextRequest, NextResponse } from "next/server";
import {
  redisSadd,
  redisSetEx,
} from "@repo/agent-core/redis-helpers";

/**
 * POST /api/live/heartbeat
 *
 * Called periodically by the LiveCounter client component.
 * Registers (or refreshes) this session as "active" for ~65 seconds.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const sessionId: string | undefined = body.sessionId;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const SESSION_KEY = `live:session:${sessionId}`;

    // Add to the active set so we can enumerate sessions
    await redisSadd("live:active", sessionId);
    // Set a TTL-backed key for this session (65s — slightly longer than 30s heartbeat interval)
    await redisSetEx(SESSION_KEY, Date.now(), 65);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
