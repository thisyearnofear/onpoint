import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";
import { initiateStkPush } from "../../../../lib/payments/daraja";
import { createPaymentNotification } from "../../../../lib/utils/notifications";

export { OPTIONS } from "../../ai/_utils/http";

const PAYMENT_PREFIX = "curator:payments";
const MAX_RECENT_PAYMENTS = 200;

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
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

async function persistPendingPayment(
  payment: Record<string, unknown>,
): Promise<boolean> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return false;

  const key = `${PAYMENT_PREFIX}:${payment.curatorSlug}`;
  const serialized = JSON.stringify(payment);

  const commands = [
    ["LPUSH", key, serialized],
    ["LTRIM", key, "0", String(MAX_RECENT_PAYMENTS - 1)],
    ["LPUSH", `${PAYMENT_PREFIX}:recent`, serialized],
    ["LTRIM", `${PAYMENT_PREFIX}:recent`, "0", String(MAX_RECENT_PAYMENTS - 1)],
    ["INCR", `${PAYMENT_PREFIX}:count:${payment.curatorSlug}`],
    ["INCR", `${PAYMENT_PREFIX}:daily:${new Date().toISOString().slice(0, 10)}`],
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

/**
 * POST /api/curator/stk-push
 *
 * Initiate an STK Push payment to the customer's phone.
 * Creates a pending payment record in Redis that gets
 * auto-verified when the callback arrives.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as Record<string, unknown>;

    const curatorSlug = cleanSlug(body.curatorSlug);
    const listingId = cleanText(body.listingId as string, 80);
    const itemName = cleanText(body.itemName as string, 160);
    const size = cleanText(body.size as string, 20);
    const amount = cleanAmount(body.amount);
    const customerPhone = cleanText(body.customerPhone as string, 40);

    if (!curatorSlug || !listingId || !size || !amount) {
      return NextResponse.json(
        { error: "curatorSlug, listingId, size, and amount are required" },
        { status: 400 },
      );
    }

    if (!customerPhone) {
      return NextResponse.json(
        { error: "customerPhone is required" },
        { status: 400 },
      );
    }

    // Initiate STK Push
    const accountRef = `onpoint/${curatorSlug.slice(0, 6)}`;
    const stkResult = await initiateStkPush({
      phoneNumber: customerPhone,
      amount,
      accountReference: accountRef,
      transactionDesc: itemName ? itemName.slice(0, 13) : "OnPoint payment",
    });

    if ("error" in stkResult) {
      return NextResponse.json(
        { error: stkResult.error },
        { status: 502 },
      );
    }

    // Create pending payment record
    const paymentId = `stk_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const payment = {
      id: paymentId,
      curatorSlug,
      listingId,
      itemName,
      size,
      amount,
      currency: "KES",
      customerPhone,
      provider: "mpesa_stk",
      status: "pending_verification",
      checkoutRequestId: stkResult.checkoutRequestId,
      createdAt: new Date().toISOString(),
    };

    let persisted = false;
    try {
      persisted = await persistPendingPayment(payment);
    } catch (error) {
      logger.warn(
        "STK Push payment persistence failed",
        { component: "curator-stk-push", curatorSlug },
        error,
      );
    }

    // Create notification
    if (persisted) {
      await createPaymentNotification(payment);
    }

    logger.info("STK Push initiated for payment", {
      component: "curator-stk-push",
      curatorSlug,
      listingId,
      amount,
      checkoutRequestId: stkResult.checkoutRequestId,
      persisted,
    });

    return NextResponse.json({
      success: true,
      checkoutRequestId: stkResult.checkoutRequestId,
      paymentId,
      persisted,
    });
  } catch (error) {
    logger.error(
      "STK Push endpoint error",
      { component: "curator-stk-push" },
      error,
    );
    return NextResponse.json(
      { error: "Failed to initiate payment" },
      { status: 500 },
    );
  }
}
