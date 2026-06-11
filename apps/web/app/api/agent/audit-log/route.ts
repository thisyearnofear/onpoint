import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import { redisScan, redisGet, isRedisConfigured } from "../../../../lib/utils/redis-helpers";
export { OPTIONS } from "../../ai/_utils/http";

interface SignerLogEntry {
  suggestionId: string;
  agentId: string;
  userId: string;
  action: string;
  amount: string;
  txHash?: string;
  decision: "signed" | "rejected" | "failed";
  reason?: string;
  tokenId?: string;
  ts: number;
}

export async function GET(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    if (!isRedisConfigured()) {
      return NextResponse.json(
        { entries: [], total: 0, redisAvailable: false },
        { headers: corsHeaders(origin) },
      );
    }

    try {
      const url = new URL(req.url);
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10), 50);

      const keys = await redisScan("signer:log:*", 200);

      if (keys.length === 0) {
        return NextResponse.json(
          { entries: [], total: 0, redisAvailable: true },
          { headers: corsHeaders(origin) },
        );
      }

      const entries: SignerLogEntry[] = [];
      const fetches = keys.map(async (key) => {
        const entry = await redisGet<SignerLogEntry>(key);
        if (entry && entry.userId === ctx.userId) {
          entries.push(entry);
        }
      });

      await Promise.all(fetches);

      entries.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      const paginated = entries.slice(0, limit);

      return NextResponse.json(
        {
          entries: paginated.map((e) => ({
            suggestionId: e.suggestionId,
            action: e.action,
            amount: e.amount,
            txHash: e.txHash || null,
            decision: e.decision,
            reason: e.reason || null,
            tokenId: e.tokenId || null,
            ts: e.ts,
            timestamp: e.ts ? new Date(e.ts).toISOString() : null,
          })),
          total: entries.length,
          redisAvailable: true,
        },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Audit log fetch failed", { component: "audit-log" }, error);
      return NextResponse.json(
        { error: "Failed to fetch audit log" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
