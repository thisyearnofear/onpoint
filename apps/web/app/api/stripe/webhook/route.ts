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
import {
  setStripeCustomerMapping,
  syncSubscriptionFromStripe,
  getUserIdByStripeCustomerId,
  pushNotification,
  buildSubscriptionNotification,
} from "../../../../lib/services/subscription-service";
import { sendSubscriptionEmail } from "../../../../lib/services/email";

// ============================================
// Server-side PostHog tracking (no client-side dependency)
// ============================================

async function trackEvent(
  event: string,
  distinctId: string,
  properties: Record<string, unknown> = {},
) {
  const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com";
  if (!posthogKey) return;

  try {
    await fetch(`${posthogHost}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: posthogKey,
        event,
        distinct_id: distinctId,
        properties: {
          ...properties,
          source: "stripe_webhook",
          $current_url: `${process.env.URL || "https://beonpoint.netlify.app"}/stripe/webhook`,
        },
      }),
    });
  } catch {
    // Best-effort analytics
  }
}

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

      // Store Stripe customer → OnPoint user mapping for lifecycle event sync
      const userId: string | undefined = session.client_reference_id
        || session.metadata?.userId
        || undefined;

      if (userId && session.customer) {
        const customerId = typeof session.customer === "string"
          ? session.customer
          : session.customer.id;
        await setStripeCustomerMapping(customerId, userId);

        // If this is a subscription (mode: "subscription"), sync immediately
        if (session.mode === "subscription" && session.subscription) {
          const subscriptionId = typeof session.subscription === "string"
            ? session.subscription
            : session.subscription.id;

          // Fetch full subscription from Stripe API for complete data
          try {
            const stripe = getStripe();
            if (stripe) {
              const fullSub = await stripe.subscriptions.retrieve(subscriptionId);
              await syncSubscriptionFromStripe(fullSub, { forcedUserId: userId });
            }
          } catch (fetchErr) {
            logger.warn("Failed to fetch subscription for sync", {
              component: "stripe-webhook",
              subscriptionId,
            });
          }
        }
      }

      logger.info("Checkout completed", {
        component: "stripe-webhook",
        sessionId: session.id,
        customerId: session.customer,
        userId,
        mode: session.mode,
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

      const synced = await syncSubscriptionFromStripe(subscription);

      logger.info("Subscription created" + (synced ? " — synced to Redis" : " — mapping not found"), {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
        tier: synced?.tier,
        status: subscription.status,
        userId: synced?.userId,
      });
      break;
    }

    // ============================================
    // Subscription Updated — tier change, renewal, status change, or
    // cancel_at_period_end flag flipped by Stripe customer portal
    // ============================================
    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const synced = await syncSubscriptionFromStripe(subscription);

      logger.info("Subscription updated" + (synced ? " — synced to Redis" : " — mapping not found"), {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
        tier: synced?.tier,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        userId: synced?.userId,
      });

      // Notify on renewal (past_due → active)
      if (synced?.userId && subscription.status === "active") {
        await pushNotification(
          synced.userId,
          buildSubscriptionNotification("subscription_renewed", { tier: synced.tier }),
        );
        await trackEvent("subscription_renewed", synced.userId, { tier: synced.tier });
        logger.info("Subscription renewed — notification pushed", {
          component: "stripe-webhook",
          subscriptionId: subscription.id,
        });
      }

      // Notify on upgrade (tier changed)
      if (synced?.userId && subscription.status === "active" && subscription.cancel_at_period_end === false) {
        const previousItems = subscription.items.data.filter(
          (item) => item.price?.id !== subscription.items.data[0]?.price?.id && item.price?.id,
        );
        if (previousItems.length > 0) {
          await pushNotification(
            synced.userId,
            buildSubscriptionNotification("subscription_upgraded", { tier: synced.tier }),
          );
          await trackEvent("subscription_upgraded", synced.userId, { tier: synced.tier });
        }
      }
      break;
    }

    // ============================================
    // Subscription Deleted — final cancellation
    // ============================================
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const synced = await syncSubscriptionFromStripe(subscription);

      if (synced?.userId) {
        await pushNotification(
          synced.userId,
          buildSubscriptionNotification("subscription_canceled"),
        );
        await trackEvent("subscription_canceled", synced.userId, { tier: synced.tier });
      }

      logger.info("Subscription deleted" + (synced ? " — notification pushed" : " — mapping not found"), {
        component: "stripe-webhook",
        subscriptionId: subscription.id,
        customerId,
        tier: synced?.tier,
        userId: synced?.userId,
      });
      break;
    }

    // ============================================
    // Invoice Payment Succeeded — recurring payment successful
    // Try to sync the related subscription so period dates update
    // ============================================
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice & { subscription: string };
      const subscriptionId = invoice.subscription;
      const customerId = invoice.customer as string;

      // Fetch the subscription to sync updated period dates
      let syncedUserId: string | undefined;
      let syncedTier: string | undefined;
      try {
        const stripe = getStripe();
        if (stripe && subscriptionId) {
          const fullSub = await stripe.subscriptions.retrieve(subscriptionId);
          const synced = await syncSubscriptionFromStripe(fullSub);
          syncedUserId = synced?.userId;
          syncedTier = synced?.tier;
        }
      } catch {
        // Fallback: subscription might already be synced by a parallel event
      }

      // Push notification + email + analytics
      if (syncedUserId) {
        await pushNotification(
          syncedUserId,
          buildSubscriptionNotification("payment_succeeded", {
            tier: syncedTier,
            amount: invoice.amount_paid ? invoice.amount_paid / 100 : undefined,
          }),
        );

        // Send email if we have the customer email from the invoice
        if (invoice.customer_email) {
          await sendSubscriptionEmail(
            invoice.customer_email,
            "payment_succeeded",
            { tier: syncedTier, amount: invoice.amount_paid ? invoice.amount_paid / 100 : undefined },
          );
        }

        await trackEvent("subscription_payment_succeeded", syncedUserId, {
          tier: syncedTier,
          amount: invoice.amount_paid,
        });
      }

      logger.info("Invoice payment succeeded", {
        component: "stripe-webhook",
        invoiceId: invoice.id,
        subscriptionId,
        customerId,
        userId: syncedUserId,
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

      // Find user for notification
      let failingUserId: string | undefined;
      try {
        failingUserId = (await getUserIdByStripeCustomerId(customerId)) || undefined;
      } catch {
        // Best-effort
      }

      // Push payment failure notification + email + analytics
      if (failingUserId) {
        await pushNotification(
          failingUserId,
          buildSubscriptionNotification("payment_failed", {
            tier: undefined,
            attemptCount: invoice.attempt_count,
          }),
        );

        // Send email if we have the customer email from the invoice
        if (invoice.customer_email) {
          await sendSubscriptionEmail(
            invoice.customer_email,
            "payment_failed",
            { attemptCount: invoice.attempt_count },
          );
        }

        await trackEvent("subscription_payment_failed", failingUserId, {
          attemptCount: invoice.attempt_count,
          failureMessage: invoice.last_finalization_error?.message,
        });
      }

      logger.error("Invoice payment failed" + (failingUserId ? " — notification pushed" : ""), {
        component: "stripe-webhook",
        invoiceId: invoice.id,
        subscriptionId,
        customerId,
        userId: failingUserId,
        failureMessage: invoice.last_finalization_error?.message,
        attemptCount: invoice.attempt_count,
        nextAttempt: invoice.next_payment_attempt
          ? new Date(invoice.next_payment_attempt * 1000).toISOString()
          : null,
      });

      // If multiple failures, mark subscription past_due in Redis
      if (invoice.attempt_count >= 3 && subscriptionId) {
        try {
          const fullSub = await stripe.subscriptions.retrieve(subscriptionId);
          await syncSubscriptionFromStripe(fullSub);
        } catch {
          // Best-effort sync
        }

        // Also push past_due notification
        if (failingUserId) {
          await pushNotification(
            failingUserId,
            buildSubscriptionNotification("subscription_past_due"),
          );
        }

        logger.warn("Multiple payment failures — synced past_due to Redis", {
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
      const currentPeriodEnd = sub.current_period_end as number | undefined;

      // Use the raw object for sync — syncSubscriptionFromStripe handles shape
      const synced = await syncSubscriptionFromStripe(sub as unknown as Stripe.Subscription);

      if (synced?.userId) {
        await pushNotification(
          synced.userId,
          buildSubscriptionNotification("subscription_past_due"),
        );
        await trackEvent("subscription_past_due", synced.userId, { tier: synced.tier });
      }

      logger.warn("Subscription past due" + (synced ? " — notification pushed" : " — mapping not found"), {
        component: "stripe-webhook",
        subscriptionId,
        customerId,
        userId: synced?.userId,
        tier: synced?.tier,
        currentPeriodEnd: currentPeriodEnd
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
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
      const trialEnd = sub.trial_end as number | undefined;

      const synced = await syncSubscriptionFromStripe(sub as unknown as Stripe.Subscription);

      if (synced?.userId && trialEnd) {
        const daysRemaining = Math.max(1, Math.ceil((trialEnd * 1000 - Date.now()) / 86400000));
        await pushNotification(
          synced.userId,
          buildSubscriptionNotification("trial_ending", { daysRemaining }),
        );
        await trackEvent("subscription_trial_ending", synced.userId, { daysRemaining });
      }

      logger.info("Trial will end" + (synced ? " — notification pushed" : " — mapping not found"), {
        component: "stripe-webhook",
        subscriptionId,
        customerId,
        userId: synced?.userId,
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
