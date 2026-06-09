/**
 * Community Looks API
 *
 * POST /api/community/looks — Submit an anonymized look to the community feed
 * GET  /api/community/looks — Fetch trending community looks (sorted by likes)
 *
 * Data is stored in Redis with a 7-day TTL. Capped at 100 looks.
 * No authentication required — data is fully anonymized before storage.
 * Rate-limited via IP-based throttle: 5 POSTs per minute per IP.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import {
  redisGet,
  redisSetEx,
  redisIncr,
} from "../../../../lib/utils/redis-helpers";
import { logger } from "../../../../lib/utils/logger";
import { corsHeaders } from "../../ai/_utils/http";

const COMMUNITY_LOOKS_KEY = "community:looks";
const COMMUNITY_LIKE_PREFIX = "community:like:";
const MAX_LOOKS = 100;
const LOOK_TTL = 7 * 86400; // 7 days
const LOOK_OF_WEEK_CACHE_TTL = 3600; // 1 hour — stable within a session, updates eventually

// Simple IP-based rate limit: store request count per IP per minute
const RATE_LIMIT_PREFIX = "ratelimit:community-post:";

// ── Helpers ──

/**
 * Compute the look of the week from the enriched looks array.
 * The winner is the look with the most likes that was created within the last 7 days.
 */
function computeLookOfTheWeek(looks: CommunityLook[]): CommunityLook | null {
  const oneWeekAgo = Date.now() - 7 * 86400 * 1000;
  const recent = looks.filter(
    (l) => new Date(l.createdAt).getTime() >= oneWeekAgo,
  );
  if (recent.length === 0) return null;
  return recent.reduce((best, curr) => (curr.likes > best.likes ? curr : best));
}

// ── Schema ──

const SubmitLookSchema = z.object({
  score: z.number().min(1).max(10),
  persona: z.string().max(40).nullable().default(null),
  headline: z.string().max(200),
  takeaways: z.array(z.string().max(300)).max(10).default([]),
  topics: z.array(z.string().max(60)).max(6).default([]),
});

// ── Types ──

export interface CommunityLook {
  id: string;
  score: number;
  persona: string | null;
  headline: string;
  takeaways: string[];
  topics: string[];
  likes: number;
  createdAt: string;
  reactions: Record<string, number>;
}

export type SortMode = "trending" | "latest";

export const ALL_PERSONAS = [
  "miranda",
  "edina",
  "shaft",
  "luxury",
  "streetwear",
  "sustainable",
] as const;

export const REACTION_EMOJIS = ["🔥", "👍", "😍", "💯", "✨"] as const;

type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

// ── POST — Submit anonymized look ──

export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  // Rate limit: 5 POSTs per minute per IP
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const rateKey = `${RATE_LIMIT_PREFIX}${ip}`;
  const requestCount = await redisIncr(rateKey);
  if (requestCount === null) {
    // Redis unavailable — allow through, but log
    logger.warn("Redis unavailable for rate limiting community POST", {
      component: "community-api",
    });
  } else if (requestCount > 5) {
    return NextResponse.json(
      { error: "Too many submissions. Try again in a minute." },
      { status: 429, headers: corsHeaders(origin) },
    );
  }
  // Set TTL on first request so the key expires after 1 minute
  if (requestCount === 1) {
    // redisSetEx overwrites the value — at count 1 the value is already 1, so this is safe
    await redisSetEx(rateKey, 1, 60).catch(() => {});
  }

  try {
    const body = await request.json();
    const parsed = SubmitLookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid look data", details: parsed.error.flatten() },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    const look: CommunityLook = {
      id: `look_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      ...parsed.data,
      likes: 0,
      reactions: {},
      createdAt: new Date().toISOString(),
    };

    // Get existing looks
    const existing = await redisGet<CommunityLook[]>(COMMUNITY_LOOKS_KEY);
    const looks = existing || [];

    // Prepend new look, cap at MAX_LOOKS
    looks.unshift(look);
    if (looks.length > MAX_LOOKS) {
      looks.length = MAX_LOOKS;
    }

    // Store with 7-day TTL
    await redisSetEx(COMMUNITY_LOOKS_KEY, looks, LOOK_TTL);

    // Respond immediately, then log + revalidate in background
    const response = NextResponse.json(
      { success: true, look },
      { status: 201, headers: corsHeaders(origin) },
    );

    after(async () => {
      logger.info("Community look submitted", {
        component: "community-api",
        lookId: look.id,
      });
      // Touch the look-of-the-week cache so it recomputes eventually
      await redisIncr("community:look-count").catch(() => {});
    });

    return response;
  } catch (error) {
    logger.error("Community look POST error", { component: "community-api" }, error);
    return NextResponse.json(
      { error: "Failed to submit look" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

// ── GET — Fetch trending looks ──

export async function GET(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;
  const { searchParams } = new URL(request.url);
  const personaFilter = searchParams.get("persona")?.toLowerCase() || null;
  const sortMode = (searchParams.get("sort") || "trending") as SortMode;

  try {
    const existing = await redisGet<CommunityLook[]>(COMMUNITY_LOOKS_KEY);
    const rawLooks = existing || [];

    // Fetch latest like counts and reactions for each look
    const enriched = await Promise.all(
      rawLooks.map(async (look: CommunityLook) => {
        const [likeCount, reactionsRaw] = await Promise.all([
          redisGet<number>(`${COMMUNITY_LIKE_PREFIX}${look.id}`),
          redisGet<Record<string, number>>(`community:reactions:${look.id}`),
        ]);
        return {
          ...look,
          likes: likeCount ?? look.likes ?? 0,
          reactions: reactionsRaw ?? look.reactions ?? {},
        };
      }),
    );

    // Apply persona filter
    let filtered = enriched;
    if (personaFilter) {
      filtered = enriched.filter(
        (l) => l.persona?.toLowerCase() === personaFilter,
      );
    }

    // Sort
    if (sortMode === "latest") {
      filtered.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
    } else {
      // Trending: likes desc, then recency
      filtered.sort((a, b) => {
        if (b.likes !== a.likes) return b.likes - a.likes;
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });
    }

    // Determine lastCreatedAt (most recent look's creation time)
    const lastCreatedAt =
      rawLooks.length > 0
        ? rawLooks.reduce((latest, l) =>
            l.createdAt > latest.createdAt ? l : latest,
          ).createdAt
        : null;

    // Compute look of the week from the FULL enriched list (pre-filter,
    // pre-sort) so the hero card shows the global winner regardless of filter.
    // The cached winner is also computed from the full list.
    const cachedWinnerKey = "community:look-of-the-week-id";
    let winnerId = await redisGet<string>(cachedWinnerKey);
    if (!winnerId && enriched.length > 0) {
      const computed = computeLookOfTheWeek(enriched);
      if (computed) {
        winnerId = computed.id;
        await redisSetEx(cachedWinnerKey, winnerId, LOOK_OF_WEEK_CACHE_TTL).catch(() => {});
      }
    }
    // Only show the hero card if the winner is in the current filtered set
    const lookOfTheWeek =
      winnerId && filtered.length > 0
        ? filtered.find((l) => l.id === winnerId) ?? null
        : null;

    return NextResponse.json(
      {
        looks: filtered.slice(0, 50),
        total: filtered.length,
        lookOfTheWeek,
        lastCreatedAt,
      },
      { status: 200, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Community looks GET error", { component: "community-api" }, error);
    return NextResponse.json(
      { looks: [], total: 0, lookOfTheWeek: null, lastCreatedAt: null },
      { status: 200, headers: corsHeaders(origin) },
    );
  }
}

// ── PATCH — Like or react to a look ──

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin") ?? undefined;

  // Rate limit
  const forwarded = request.headers.get("x-forwarded-for") || "unknown";
  const ip = forwarded.split(",")[0]?.trim() || "unknown";
  const rateKey = `${RATE_LIMIT_PREFIX}${ip}`;
  const requestCount = await redisIncr(rateKey);
  if (requestCount === null) {
    logger.warn("Redis unavailable for rate limiting community PATCH", {
      component: "community-api",
    });
  } else if (requestCount > 30) {
    return NextResponse.json(
      { error: "Too many requests. Slow down." },
      { status: 429, headers: corsHeaders(origin) },
    );
  }
  if (requestCount === 1) {
    await redisSetEx(rateKey, 1, 60).catch(() => {});
  }

  try {
    const body = await request.json();
    const { lookId, reaction } = body;

    if (!lookId || typeof lookId !== "string") {
      return NextResponse.json(
        { error: "Missing lookId" },
        { status: 400, headers: corsHeaders(origin) },
      );
    }

    // If a reaction emoji is provided, handle reaction; otherwise, handle like
    if (reaction && typeof reaction === "string") {
      // React with emoji
      const reactionsKey = `community:reactions:${lookId}`;
      const existing = await redisGet<Record<string, number>>(reactionsKey);
      const reactions = existing || {};
      reactions[reaction] = (reactions[reaction] || 0) + 1;
      // Keep reactions under the same 7-day TTL as looks
      await redisSetEx(reactionsKey, reactions, LOOK_TTL).catch(() => {});

      const reactResponse = NextResponse.json(
        { reactions },
        { status: 200, headers: corsHeaders(origin) },
      );

      after(async () => {
        logger.info("Community reaction", {
          component: "community-api",
          lookId,
          reaction,
        });
      });

      return reactResponse;
    }

    // Like (backward compatible)
    const newCount = await redisIncr(`${COMMUNITY_LIKE_PREFIX}${lookId}`);
    if (newCount === null) {
      return NextResponse.json(
        { error: "Failed to record like" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }

    const likeResponse = NextResponse.json(
      { likes: newCount },
      { status: 200, headers: corsHeaders(origin) },
    );

    after(async () => {
      logger.info("Community like", {
        component: "community-api",
        lookId,
        newCount,
      });
    });

    return likeResponse;
  } catch (error) {
    logger.error("Community look PATCH error", { component: "community-api" }, error);
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}

export { OPTIONS } from "../../ai/_utils/http";
