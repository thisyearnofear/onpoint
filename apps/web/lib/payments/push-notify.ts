import { logger } from "../utils/logger";

const REDIS_SUB_PREFIX = "curator:push-subscriptions";

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

function getVapidKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

/**
 * Retrieve a push subscription for a given paymentId from Redis.
 */
async function getSubscription(
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

/**
 * Send a push notification to the subscriber of a given payment.
 * Uses web-push with VAPID keys.
 * Returns true if sent successfully, false if no subscription or failure.
 */
export async function sendPushNotification(params: {
  paymentId: string;
  orderNumber: string;
  statusLabel: string;
  curatorSlug: string;
}): Promise<boolean> {
  const { paymentId, orderNumber, statusLabel, curatorSlug } = params;

  const vapid = getVapidKeys();
  if (!vapid) {
    logger.info("VAPID keys not configured — skipping push notification", {
      component: "push-notify",
    });
    return false;
  }

  const record = await getSubscription(paymentId);
  if (!record) {
    logger.info("No push subscription found for payment", {
      component: "push-notify",
      paymentId,
    });
    return false;
  }

  // Dynamic import — web-push is an ESM-only module, used only at runtime
  let webPush: typeof import("web-push");
  try {
    webPush = await import("web-push");
  } catch {
    logger.warn("web-push module not available — skipping push", {
      component: "push-notify",
    });
    return false;
  }

  // VAPID requires a contact URI for push service abuse reports. Replace
  // with a real admin address (mailto:admin@yourdomain.com) when you have
  // a verified domain. example.com is RFC 2606 reserved and signals "set me."
  webPush.setVapidDetails(
    "mailto:admin@example.com",
    vapid.publicKey,
    vapid.privateKey,
  );

  const payload = JSON.stringify({
    title: "Order status updated",
    body: `${orderNumber}: ${statusLabel}`,
    tag: `onpoint-${paymentId}-${Date.now()}`,
    paymentId,
    curatorSlug,
  });

  try {
    const sub = record.subscription as {
      endpoint: string;
      keys: { auth: string; p256dh: string };
    };

    await webPush.sendNotification(sub, payload);
    return true;
  } catch (error: unknown) {
    const err = error as { statusCode?: number; message?: string };
    logger.warn("Failed to send push notification", {
      component: "push-notify",
      paymentId,
      statusCode: err.statusCode,
      error: err.message,
    });

    // If subscription is expired/invalid (410 Gone), delete it
    if (err.statusCode === 410) {
      const url = getRedisUrl();
      const token = getRedisToken();
      if (url && token) {
        const key = `${REDIS_SUB_PREFIX}:${paymentId}`;
        await fetch(`${url}/del/${key}`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => {});
      }
    }

    return false;
  }
}
