/**
 * Community Looks Faceoff API
 *
 * GET  /api/community/looks/faceoff — Fetch two random looks for voting
 * POST /api/community/looks/faceoff — Cast a vote on a face-off pair
 *
 * Data stored in Redis. No auth required — rate-limited by IP.
 */

import { NextRequest, NextResponse, after } from "next/server";
import {
  redisGet,
  redisSetEx,
  redisIncr,
  redisSadd,
} from "../../../../../lib/utils/redis-helpers";
import { logger } from "../../../../../lib/utils/logger";
import { corsHeaders } from "../../../ai/_utils/http";
import type { CommunityLook } from "../types";

const FACEOFF_VOTE_PREFIX = "community:faceoff:votes:";
const FACEOFF_HISTORY_PREFIX = "community:faceoff:history:";
const LOOK_TTL = 7 * 86400;

// ── GET — Fetch a random face-off pair ──

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  try {
    const existing = await redisGet<CommunityLook[]>("community:looks");
    const looks = existing || [];

    if (looks.length < 2) {
      return NextResponse.json(
        { lookA: null, lookB: null, error: "Not enough looks for a face-off" },
        { status: 200, headers: corsHeaders(origin) },
      );
    }

    // Pick two random, distinct looks
    const shuffled = [...looks].sort(() => Math.random() - 0.5);
    const lookA = shuffled[0]!;
    const lookB = shuffled[1]!;

    // Fetch current vote counts
    const [votesA, votesB] = await Promise.all([
      redisGet<number>(`${FACEOFF_VOTE_PREFIX}${lookA.id}`),
      redisGet<number>(`${FACEOFF_VOTE_PREFIX}${lookB.id}`),
    ]);

    return NextResponse.json(
      {
        lookA: { ...lookA, votes: votesA ?? 0 },
        lookB: { ...lookB, votes: votesB ?? 0 },
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Faceoff GET error", { component: "faceoff-api" }, error);
    return NextResponse.json(
      { lookA: null, lookB: null, error: "Failed to fetch face-off" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// ── POST — Cast a face-off vote ──

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";

  try {
    const body = await request.json();
    const { lookId, userId } = body;

    if (!lookId || typeof lookId !== "string") {
      return NextResponse.json(
        { error: "Missing lookId" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // Check if this IP already voted for this look
    const historyKey = `${FACEOFF_HISTORY_PREFIX}${ip}`;
    const history = await redisGet<string[]>(historyKey);
    if (history?.includes(lookId)) {
      return NextResponse.json(
        { error: "Already voted on this look" },
        { status: 429, headers: corsHeaders(origin) },
      );
    }

    // Record vote
    const newCount = await redisIncr(`${FACEOFF_VOTE_PREFIX}${lookId}`);
    if (newCount === null) {
      return NextResponse.json(
        { error: "Failed to record vote" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }

    // Track in history
    await redisSadd(historyKey, lookId);

    const response = NextResponse.json(
      { votes: newCount },
      { status: 200, headers: corsHeaders(origin) },
    );

    after(async () => {
      logger.info("Faceoff vote recorded", {
        component: "faceoff-api",
        lookId,
        totalVotes: newCount,
      });

      // Dispatch mission progress if userId provided
      if (userId) {
        try {
          await fetch(`${request.nextUrl.origin}/api/agent/missions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId,
              eventType: "vote-cast",
            }),
          });
        } catch {
          // Non-critical — don't fail the vote
        }
      }
    });

    return response;
  } catch (error) {
    logger.error("Faceoff POST error", { component: "faceoff-api" }, error);
    return NextResponse.json(
      { error: "Failed to cast vote" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders("*") });
}
