/**
 * Stripe Webhook Handler
 *
 * Verifies Stripe webhook signatures and processes payment events.
 * On successful payment, creates a session token for premium access.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "../../../../lib/utils/logger";
import { createSessionToken } from "../../../../lib/utils/session-token";
import { redisSetEx } from "../../../../lib/utils/redis-helpers";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    logger.error("Stripe webhook signature verification failed", { component: "stripe-webhook" }, err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;

    // Create a premium session token (same format as CELO payment path)
    const token = createSessionToken({
      sub: session.customer_email || session.id,
      provider: "gemini",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24h
    });

    // Store token keyed by Stripe session ID so the frontend can retrieve it
    await redisSetEx(
      `stripe:session:${session.id}`,
      { token, email: session.customer_email },
      86400, // 24h
    );

    logger.info("Stripe payment completed", {
      component: "stripe-webhook",
      sessionId: session.id,
      amount: session.amount_total,
    });
  }

  return NextResponse.json({ received: true });
}
