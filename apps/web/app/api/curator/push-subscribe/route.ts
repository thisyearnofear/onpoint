import { NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";

const REDIS_SUB_PREFIX = "curator:push-subscriptions";

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      curatorSlug?: string;
      paymentId?: string;
      subscription?: Record<string, unknown>;
    };

    const { curatorSlug, paymentId, subscription } = body;

    if (!curatorSlug || !paymentId || !subscription) {
      return NextResponse.json(
        { error: "curatorSlug, paymentId, and subscription are required" },
        { status: 400 },
      );
    }

    const url = getRedisUrl();
    const token = getRedisToken();
    if (!url || !token) {
      return NextResponse.json(
        { error: "Push subscriptions not available" },
        { status: 503 },
      );
    }

    // Store subscription keyed by paymentId for targeted push
    const key = `${REDIS_SUB_PREFIX}:${paymentId}`;
    const serialized = JSON.stringify({
      curatorSlug,
      paymentId,
      subscription,
      createdAt: new Date().toISOString(),
    });

    const response = await fetch(`${url}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(serialized),
    });

    if (!response.ok) {
      logger.warn("Failed to store push subscription in Redis", {
        component: "push-subscribe",
        curatorSlug,
        paymentId,
      });
      return NextResponse.json(
        { error: "Failed to save subscription" },
        { status: 500 },
      );
    }

    // Also add to a list for the curator to allow listing if needed later
    const listKey = `${REDIS_SUB_PREFIX}:list:${curatorSlug}`;
    await fetch(`${url}/lpush/${listKey}/${serialized}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {
      // Non-critical — best-effort
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Push subscribe error", {
      component: "push-subscribe",
      error: String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as {
      paymentId?: string;
    };

    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 },
      );
    }

    const url = getRedisUrl();
    const token = getRedisToken();
    if (!url || !token) {
      return NextResponse.json(
        { error: "Push subscriptions not available" },
        { status: 503 },
      );
    }

    const key = `${REDIS_SUB_PREFIX}:${paymentId}`;
    await fetch(`${url}/del/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    logger.error("Push unsubscribe error", {
      component: "push-subscribe",
      error: String(error),
    });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * Retrieve a push subscription for a given paymentId.
 */
async function getPushSubscription(
  paymentId: string,
): Promise<{ subscription: Record<string, unknown>; curatorSlug: string } | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  const key = `${REDIS_SUB_PREFIX}:${paymentId}`;
  const response = await fetch(`${url}/get/${key}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return null;

  const data = await response.json();
  const raw = data?.result as string | undefined;
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as {
      curatorSlug: string;
      paymentId: string;
      subscription: Record<string, unknown>;
    };
    return {
      subscription: parsed.subscription,
      curatorSlug: parsed.curatorSlug,
    };
  } catch {
    return null;
  }
}
