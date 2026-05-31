import { logger } from "./logger";

const REDIS_PAYMENT_PREFIX = "curator:payments";
const NOTIFICATION_PREFIX = "curator:notifications";
const MAX_RECENT_PAYMENTS = 200;
const MAX_NOTIFICATIONS = 100;

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

// ─── Payment record helpers ──────────────────────────────────────────

/**
 * Read all payments for a curator from the Redis list.
 */
export async function readPayments(
  curatorSlug: string,
): Promise<Record<string, unknown>[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return [];

  const key = `${REDIS_PAYMENT_PREFIX}:${curatorSlug}`;
  const response = await fetch(`${url}/lrange/${key}/0/49`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  const rows = Array.isArray(data?.result) ? data.result : [];
  return rows
    .map((row: unknown) => {
      if (typeof row !== "string") return null;
      try {
        return JSON.parse(row) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(
      (row: Record<string, unknown> | null): row is Record<string, unknown> =>
        Boolean(row),
    );
}

/**
 * Update a single payment record in the Redis list by ID.
 * Reads the list, patches the matching record, then deletes and rewrites the list.
 * Returns the updated record or null if not found.
 */
export async function updatePaymentInRedis(
  curatorSlug: string,
  paymentId: string,
  updates: Record<string, unknown>,
): Promise<Record<string, unknown> | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  const key = `${REDIS_PAYMENT_PREFIX}:${curatorSlug}`;

  const response = await fetch(
    `${url}/lrange/${key}/0/${MAX_RECENT_PAYMENTS - 1}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    },
  );
  if (!response.ok) return null;

  const data = await response.json();
  const rows = Array.isArray(data?.result) ? data.result : [];

  let updatedPayment: Record<string, unknown> | null = null;
  const updatedRows: string[] = [];

  for (const row of rows) {
    if (typeof row !== "string") continue;
    try {
      const parsed = JSON.parse(row) as Record<string, unknown>;
      if (parsed.id === paymentId) {
        Object.assign(parsed, updates, { updatedAt: new Date().toISOString() });
        updatedPayment = parsed;
      }
      updatedRows.push(JSON.stringify(parsed));
    } catch {
      updatedRows.push(row);
    }
  }

  if (!updatedPayment) return null;

  const pipelineCommands = [
    ["DEL", key],
    ...updatedRows.map((serialized) => ["RPUSH", key, serialized]),
  ];

  await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(pipelineCommands),
  });

  return updatedPayment;
}

// ─── Notification helpers ────────────────────────────────────────────

async function persistNotification(
  notification: Record<string, unknown>,
): Promise<boolean> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return false;

  const key = `${NOTIFICATION_PREFIX}:${notification.curatorSlug}`;
  const serialized = JSON.stringify(notification);

  const commands = [
    ["LPUSH", key, serialized],
    ["LTRIM", key, "0", String(MAX_NOTIFICATIONS - 1)],
    ["INCR", `${NOTIFICATION_PREFIX}:count:${notification.curatorSlug}`],
  ];

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

export async function createPaymentNotification(
  payment: Record<string, unknown>,
): Promise<void> {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    curatorSlug: payment.curatorSlug,
    type: "new_payment",
    message: `New M-Pesa payment of KES ${String(payment.amount || "0")} for ${String(payment.itemName || "an item")} — code ${String(payment.mpesaCode || "")}`,
    relatedId: payment.id,
    relatedType: "payment",
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await persistNotification(notification);
  } catch (error) {
    logger.warn(
      "Failed to persist payment notification",
      { component: "curator-notifications" },
      error,
    );
  }
}

export async function createLeadNotification(
  lead: Record<string, unknown>,
): Promise<void> {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    curatorSlug: lead.curatorSlug,
    type: "new_lead",
    message: `New lead from ${String(lead.source || "unknown")} — ${String(lead.selectedItem || lead.marketIntent || "style brief")}`,
    relatedId: lead.id,
    relatedType: "lead",
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await persistNotification(notification);
  } catch (error) {
    logger.warn(
      "Failed to persist lead notification",
      { component: "curator-notifications" },
      error,
    );
  }
}

export async function createDeliveryNotification(
  payment: Record<string, unknown>,
): Promise<void> {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    curatorSlug: payment.curatorSlug,
    type: "delivery_submitted",
    message: `Delivery details received for ${String(payment.itemName || "order")} — ready to arrange pickup via ${String(payment.courierMethod || "Bolt Send")}`,
    relatedId: payment.id,
    relatedType: "payment",
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await persistNotification(notification);
  } catch (error) {
    logger.warn(
      "Failed to persist delivery notification",
      { component: "curator-notifications" },
      error,
    );
  }
}

export async function createStkConfirmedNotification(
  payment: Record<string, unknown>,
): Promise<void> {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    curatorSlug: payment.curatorSlug,
    type: "payment_confirmed_stk",
    message: `STK payment confirmed — KES ${String(payment.verifiedAmount || payment.amount || "0")} for ${String(payment.itemName || "order")}${payment.mpesaCode ? ` (${String(payment.mpesaCode)})` : ""}`,
    relatedId: payment.id,
    relatedType: "payment",
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await persistNotification(notification);
  } catch (error) {
    logger.warn(
      "Failed to persist STK confirmation notification",
      { component: "curator-notifications" },
      error,
    );
  }
}

export async function createViewNotification(params: {
  curatorSlug: string;
  listingId: string;
  club?: string;
  kitType?: string;
}): Promise<void> {
  const notification = {
    id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    curatorSlug: params.curatorSlug,
    type: "high_intent_view",
    message: `High-intent view on ${String(params.club || "listing")} ${String(params.kitType || "")}${params.listingId ? ` (${params.listingId.slice(0, 8)})` : ""}`,
    relatedId: params.listingId,
    relatedType: "listing_view",
    read: false,
    createdAt: new Date().toISOString(),
  };
  try {
    await persistNotification(notification);
  } catch (error) {
    logger.warn(
      "Failed to persist view notification",
      { component: "curator-notifications" },
      error,
    );
  }
}

export async function readNotifications(
  curatorSlug: string,
): Promise<Record<string, unknown>[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return [];

  const key = `${NOTIFICATION_PREFIX}:${curatorSlug}`;
  const response = await fetch(`${url}/lrange/${key}/0/49`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  const rows = Array.isArray(data?.result) ? data.result : [];
  return rows
    .map((row: unknown) => {
      if (typeof row !== "string") return null;
      try {
        return JSON.parse(row) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter(
      (row: Record<string, unknown> | null): row is Record<string, unknown> =>
        Boolean(row),
    );
}
