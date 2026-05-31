import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import {
  createPaymentNotification,
  readPayments,
} from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

const PAYMENT_PREFIX = "curator:payments";
const MAX_RECENT_PAYMENTS = 200;

type PaymentPayload = {
  curatorSlug?: string;
  listingId?: string;
  itemName?: string;
  size?: string;
  amount?: number;
  customerPhone?: string;
  mpesaCode?: string;
  status?: string;
};

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

function getServiceKey(): string | undefined {
  return process.env.SERVICE_API_KEY;
}

function cleanText(value: unknown, max = 160): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function cleanSlug(value: unknown): string | null {
  const clean = cleanText(value, 64)?.toLowerCase() || null;
  if (!clean || !/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

function cleanAmount(value: unknown): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return Math.round(amount);
}

async function persistPayment(payment: Record<string, unknown>): Promise<boolean> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return false;

  const key = `${PAYMENT_PREFIX}:${payment.curatorSlug}`;
  const recentKey = `${PAYMENT_PREFIX}:recent`;
  const dailyKey = `${PAYMENT_PREFIX}:daily:${new Date().toISOString().slice(0, 10)}`;
  const serialized = JSON.stringify(payment);

  const commands = [
    ["LPUSH", key, serialized],
    ["LTRIM", key, "0", String(MAX_RECENT_PAYMENTS - 1)],
    ["LPUSH", recentKey, serialized],
    ["LTRIM", recentKey, "0", String(MAX_RECENT_PAYMENTS - 1)],
    ["INCR", `${PAYMENT_PREFIX}:count:${payment.curatorSlug}`],
    ["INCR", dailyKey],
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const serviceKey = getServiceKey();
  const providedKey = request.headers.get("x-service-key");
  if (!serviceKey || providedKey !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const curatorSlug = cleanSlug(new URL(request.url).searchParams.get("curatorSlug"));
  if (!curatorSlug) {
    return NextResponse.json({ error: "Valid curatorSlug is required" }, { status: 400 });
  }

  try {
    const payments = await readPayments(curatorSlug);
    return NextResponse.json({ payments, total: payments.length });
  } catch (error) {
    logger.error("Curator payment read error", { component: "curator-payments", curatorSlug }, error);
    return NextResponse.json({ error: "Failed to read payments" }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as PaymentPayload;
    const curatorSlug = cleanSlug(body.curatorSlug);
    const amount = cleanAmount(body.amount);
    const mpesaCode = cleanText(body.mpesaCode, 40)?.toUpperCase() || null;
    const customerPhone = cleanText(body.customerPhone, 40);

    if (!curatorSlug) {
      return NextResponse.json({ error: "Valid curatorSlug is required" }, { status: 400 });
    }
    if (!cleanText(body.listingId, 80) || !cleanText(body.size, 20) || !amount) {
      return NextResponse.json({ error: "listingId, size, and amount are required" }, { status: 400 });
    }
    if (!customerPhone || !mpesaCode) {
      return NextResponse.json({ error: "customerPhone and mpesaCode are required" }, { status: 400 });
    }

    const payment = {
      id: `mpesa_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      curatorSlug,
      listingId: cleanText(body.listingId, 80),
      itemName: cleanText(body.itemName),
      size: cleanText(body.size, 20),
      amount,
      currency: "KES",
      customerPhone,
      mpesaCode,
      provider: "mpesa_manual",
      status: cleanText(body.status, 40) || "pending_verification",
      createdAt: new Date().toISOString(),
    };

    let persisted = false;
    try {
      persisted = await persistPayment(payment);
    } catch (error) {
      logger.warn(
        "Curator payment persistence failed",
        { component: "curator-payments", curatorSlug },
        error,
      );
    }

    // Create notification for new payment
    if (persisted) {
      await createPaymentNotification(payment);
    }

    logger.info("Curator payment captured", {
      component: "curator-payments",
      curatorSlug,
      listingId: payment.listingId,
      amount,
      persisted,
    });

    return NextResponse.json({ success: true, persisted, payment });
  } catch (error) {
    logger.error("Curator payment capture error", { component: "curator-payments" }, error);
    return NextResponse.json({ error: "Failed to capture payment" }, { status: 500 });
  }
}
