/**
 * Stripe Webhook Handler
 *
 * Verifies Stripe webhook signatures and processes payment events.
 * On successful payment, creates a session token for premium access.
 * Handles subscription lifecycle events (created, updated, deleted, past_due).
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { logger } from "../../../../lib/utils/logger";
import { createSessionToken } from "../../../../lib/utils/session-token";
import { redisSetEx } from "../../../../lib/utils/redis-helpers";
import { type SubscriptionTier } from "../../../../lib/services/subscription-service";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

/**
 * Map Stripe price IDs to OnPoint subscription tiers
 */
function mapPriceToTier(priceId: string): SubscriptionTier | null {
  const env = process.env;
  if (priceId === env.STRIPE_PREMIUM_PRICE_ID) return "pro";
  if (priceId === env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === env.STRIPE_CONCIERGE_PRICE_ID) return "concierge";
  return null;
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

  // Use type assertion to handle subscription lifecycle event types not in Stripe's strict union
  const eventType = event.type as string;

  switch (eventType) {
    // ============================================
    // Checkout Completed — one-time payment or initial subscription
    // ============================================
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Create a premium session token
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
      break;
    }

    // ============================================
    // Subscription Created — new subscription starts
    // ============================================
    case "customer.subscription.created": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId ? mapPriceToTier(priceId) : null;

      if (!tier) {
        logger.warn("Unknown subscription price ID", {
          component: "stripe-webhook",
          priceId,
          subscriptionId: subscription.id,
        });
        break;
      }

      logger.info("Subscription created", {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
        tier,
        status: subscription.status,
      });
      break;
    }

    // ============================================
    // Subscription Updated — tier change, renewal, or status change
    // ============================================
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      const priceId = subscription.items.data[0]?.price?.id;
      const tier = priceId ? mapPriceToTier(priceId) : null;

      logger.info("Subscription updated", {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
        tier,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      });

      // If subscription was past_due and is now active, renewal succeeded
      if (subscription.status === "active") {
        logger.info("Subscription renewed successfully", {
          component: "stripe-webhook",
          subscriptionId: subscription.id,
        });
      }
      break;
    }

    // ============================================
    // Subscription Deleted — final cancellation
    // ============================================
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      logger.info("Subscription deleted", {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
      });
      break;
    }

    // ============================================
    // Invoice Payment Succeeded — recurring payment successful
    // ============================================
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice & { subscription: string };
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer as string;

      logger.info("Invoice payment succeeded", {
        component: "stripe-webhook",
        invoiceId: invoice.id,
        subscriptionId,
        customerId,
        amountPaid: invoice.amount_paid,
      });
      break;
    }

    // ============================================
    // Invoice Payment Failed — payment issue, downgrade or alert
    // ============================================
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice & { subscription: string };
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer as string;

      logger.error("Invoice payment failed", {
        component: "stripe-webhook",
        invoiceId: invoice.id,
        subscriptionId,
        customerId,
        failureMessage: invoice.last_finalization_error?.message,
        attemptCount: invoice.attempt_count,
        nextAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
      });

      // If multiple failures, should downgrade to free tier
      if (invoice.attempt_count >= 3) {
        logger.warn("Multiple payment failures — marking subscription past_due", {
          component: "stripe-webhook",
          subscriptionId,
          customerId,
        });
      }
      break;
    }

    // ============================================
    // Customer Subscription Past Due — late payment
    // ============================================
    case "customer.subscription.past_due": {
      const sub = event.data.object as unknown as Record<string, unknown>;
      const subscriptionId = sub.id as string;
      const customerId = sub.customer as string;
      const currentPeriodEnd = sub.current_period_end as number;

      logger.warn("Subscription past due", {
        component: "stripe-webhook",
        subscriptionId,
        customerId,
        currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
      });
      break;
    }

    // ============================================
    // Trial Will End — notify user
    // ============================================
    case "customer.subscription.trial_will_end": {
      const sub = event.data.object as unknown as Record<string, unknown>;
      const subscriptionId = sub.id as string;
      const customerId = sub.customer as string;
      const trialEnd = sub.trial_end as number | null;

      logger.info("Trial will end", {
        component: "stripe-webhook",
        subscriptionId,
        customerId,
        trialEnd: trialEnd ? new Date(trialEnd * 1000).toISOString() : null,
      });
      break;
    }

    default:
      logger.info("Unhandled Stripe event type", {
        component: "stripe-webhook",
        type: eventType,
      });
  }

  return NextResponse.json({ received: true });
}
