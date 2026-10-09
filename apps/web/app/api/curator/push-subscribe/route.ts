import { NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import { getPaymentById } from "../../../../lib/utils/notifications";
import { isSafeSlug } from "../../../../lib/utils/redis-safe";
import { rateLimit, getClientId } from "../../../../lib/utils/rate-limit";
import { isPaymentId, PAYMENT_LOOKUP_LIMIT } from "../../../../lib/payments/ids";

/**
 * POST   /api/curator/push-subscribe   { curatorSlug, paymentId, subscription }
 * DELETE /api/curator/push-subscribe   { paymentId }
 *
 * Customer-facing: stores a Web Push subscription for one order so the customer
 * is notified when the curator updates it. Authorised by knowing the payment ID
 * (an unguessable capability), and the payment must really exist.
 *
 * Every Redis command goes through the JSON pipeline body. Values are never
 * interpolated into a REST URL path: Upstash treats path segments as command
 * arguments, so `DEL /del/<paymentId>` with a crafted ID used to be able to
 * delete arbitrary keys (see lib/utils/redis-safe.ts).
 */

const REDIS_SUB_PREFIX = "curator:push-subscriptions";
const SUBSCRIPTION_TTL_SECONDS = 30 * 24 * 60 * 60;
const MAX_SUBSCRIPTION_BYTES = 4096;
const MAX_LIST_LENGTH = 500;

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

/** A browser PushSubscription: an https endpoint plus keys, bounded in size. */
function isValidSubscription(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const endpoint = (value as { endpoint?: unknown }).endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://") || endpoint.length > 600) {
    return false;
  }
  return JSON.stringify(value).length <= MAX_SUBSCRIPTION_BYTES;
}

async function runPipeline(
  url: string,
  token: string,
  commands: string[][],
): Promise<boolean> {
  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  return response.ok;
}

export async function POST(request: Request) {
  const rl = await rateLimit(`payment-lookup:${getClientId(request)}`, PAYMENT_LOOKUP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await request.json().catch(() => null)) as {
      curatorSlug?: unknown;
      paymentId?: unknown;
      subscription?: unknown;
    } | null;

    const { curatorSlug, paymentId, subscription } = body ?? {};

    if (!curatorSlug || !paymentId || !subscription) {
      return NextResponse.json(
        { error: "curatorSlug, paymentId, and subscription are required" },
        { status: 400 },
      );
    }
    if (!isSafeSlug(curatorSlug)) {
      return NextResponse.json({ error: "Invalid curatorSlug" }, { status: 400 });
    }
    if (!isPaymentId(paymentId)) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }
    if (!isValidSubscription(subscription)) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const url = getRedisUrl();
    const token = getRedisToken();
    if (!url || !token) {
      return NextResponse.json(
        { error: "Push subscriptions not available" },
        { status: 503 },
      );
    }

    // Only real orders can have a subscription (no arbitrary writes to Redis).
    const payment = await getPaymentById(curatorSlug, paymentId);
    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 });
    }

    const serialized = JSON.stringify({
      curatorSlug,
      paymentId,
      subscription,
      createdAt: new Date().toISOString(),
    });
    const listKey = `${REDIS_SUB_PREFIX}:list:${curatorSlug}`;

    const ok = await runPipeline(url, token, [
      ["SET", `${REDIS_SUB_PREFIX}:${paymentId}`, serialized, "EX", String(SUBSCRIPTION_TTL_SECONDS)],
      // Also keep a bounded per-curator list (best effort, same call)
      ["LPUSH", listKey, serialized],
      ["LTRIM", listKey, "0", String(MAX_LIST_LENGTH - 1)],
    ]);

    if (!ok) {
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
  const rl = await rateLimit(`payment-lookup:${getClientId(request)}`, PAYMENT_LOOKUP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const body = (await request.json().catch(() => null)) as { paymentId?: unknown } | null;
    const paymentId = body?.paymentId;

    if (!paymentId) {
      return NextResponse.json(
        { error: "paymentId is required" },
        { status: 400 },
      );
    }
    // Strictly validated: this ID selects the key that is deleted.
    if (!isPaymentId(paymentId)) {
      return NextResponse.json({ error: "Invalid paymentId" }, { status: 400 });
    }

    const url = getRedisUrl();
    const token = getRedisToken();
    if (!url || !token) {
      return NextResponse.json(
        { error: "Push subscriptions not available" },
        { status: 503 },
      );
    }

    await runPipeline(url, token, [["DEL", `${REDIS_SUB_PREFIX}:${paymentId}`]]);

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
