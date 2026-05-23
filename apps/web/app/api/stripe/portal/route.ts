/**
 * Stripe Customer Portal API
 *
 * Creates a Stripe Billing Portal session so users can manage their
 * subscription, payment methods, and billing details directly via Stripe.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { corsHeaders } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";
import { getStripeCustomerIdByUserId } from "../../../../lib/services/subscription-service";

export { OPTIONS } from "../../ai/_utils/http";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") || "*";

    try {
      const stripe = getStripe();
      if (!stripe) {
        return NextResponse.json(
          { error: "Payments not configured" },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      // Look up the user's Stripe customer ID from the reverse mapping
      const customerId = await getStripeCustomerIdByUserId(ctx.userId);

      if (!customerId) {
        return NextResponse.json(
          {
            error: "No billing account found",
            hint: "Complete a purchase or subscription first to create a billing account.",
          },
          { status: 404, headers: corsHeaders(origin) },
        );
      }

      // Determine the return URL — the subscription management page
      const baseUrl =
        process.env.AUTH0_BASE_URL ||
        process.env.APP_BASE_URL ||
        "http://localhost:3000";
      const returnUrl = `${baseUrl}/account/subscription`;

      const session = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      return NextResponse.json(
        { url: session.url },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Stripe portal session failed", { component: "stripe-portal" }, error);
      return NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
