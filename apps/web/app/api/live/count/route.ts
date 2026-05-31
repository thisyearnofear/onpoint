import { NextResponse } from "next/server";
import {
  redisSmembers,
  redisGet,
  redisSrem,
} from "@repo/agent-core/redis-helpers";

/**
 * GET /api/live/count
 *
 * Returns the approximate number of people actively trying on.
 * Iterates the "live:active" set, prunes expired sessions (TTL keys
 * that have expired → null), and returns the count of survivors.
 */
export async function GET() {
  try {
    const members = await redisSmembers("live:active");
    if (members.length === 0) {
      return NextResponse.json({ count: 0 });
    }

    // Check each member's liveness key; prune expired ones
    const alive: string[] = [];

    for (const sessionId of members) {
      const key = `live:session:${sessionId}`;
      const val = await redisGet<string>(key);
      if (val !== null) {
        alive.push(sessionId);
      } else {
        // Session TTL expired — clean up from the set
        await redisSrem("live:active", sessionId).catch(() => {});
      }
    }

    return NextResponse.json({ count: alive.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
