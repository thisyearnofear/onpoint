/**
 * Stripe Checkout Session API
 *
 * Creates a Stripe Checkout session for premium features.
 * Supports: premium styling session, product purchases.
 */

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { corsHeaders } from "../../ai/_utils/http";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

export { OPTIONS } from "../../ai/_utils/http";

function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  return new Stripe(key);
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin") || "*";
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: corsHeaders(origin) },
    );
  }

  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: "Payments not configured" },
        { status: 503, headers: corsHeaders(origin) },
      );
    }

    const { type, returnUrl } = await request.json();
    const baseUrl = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
    const successUrl = returnUrl || `${baseUrl}/style?session=premium&paid=true`;
    const cancelUrl = `${baseUrl}/style`;

    if (type === "premium_session") {
      const priceId = process.env.STRIPE_PREMIUM_PRICE_ID;

      if (!priceId) {
        return NextResponse.json(
          { error: "Premium pricing not configured" },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${successUrl}&stripe_session={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
      });

      return NextResponse.json(
        { url: session.url },
        { headers: corsHeaders(origin) },
      );
    }

    return NextResponse.json(
      { error: "Invalid checkout type" },
      { status: 400, headers: corsHeaders(origin) },
    );
  } catch (error) {
    logger.error("Stripe checkout failed", { component: "stripe" }, error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500, headers: corsHeaders(origin) },
    );
  }
}
