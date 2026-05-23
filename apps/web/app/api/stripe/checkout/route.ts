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
import { requireAuthWithRateLimit } from "../../../../middleware/agent-auth";

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

      const { type, tier, returnUrl } = await req.json();
      const baseUrl = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "http://localhost:3000";
      const successUrl = returnUrl || `${baseUrl}/account/subscription?paid=true`;
      const cancelUrl = `${baseUrl}/pricing`;

      // Backward compat: old callers used type="premium_session", new API uses type="subscription" + tier
      const resolvedType = type === "premium_session" ? "payment" : type;
      const resolvedTier = tier || "pro";

      // Map tier names to Stripe price IDs
      const priceEnvMap: Record<string, string | undefined> = {
        basic: process.env.STRIPE_BASIC_PRICE_ID,
        pro: process.env.STRIPE_PREMIUM_PRICE_ID,
        concierge: process.env.STRIPE_CONCIERGE_PRICE_ID,
      };

      const priceId = priceEnvMap[resolvedTier];

      if (!priceId) {
        return NextResponse.json(
          { error: `Pricing not configured for tier: ${resolvedTier}` },
          { status: 503, headers: corsHeaders(origin) },
        );
      }

      const mode = resolvedType === "subscription" ? "subscription" : "payment";

      const session = await stripe.checkout.sessions.create({
        mode,
        line_items: [{ price: priceId, quantity: 1 }],
        success_url: `${successUrl}&stripe_session={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl,
        client_reference_id: ctx.userId,
        metadata: {
          userId: ctx.userId,
          tier: resolvedTier,
          auth0Id: ctx.auth0Id || "",
        },
        ...(mode === "subscription" && {
          subscription_data: {
            metadata: {
              userId: ctx.userId,
            },
          },
        }),
      });

      return NextResponse.json(
        { url: session.url, sessionId: session.id },
        { headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Stripe checkout failed", { component: "stripe" }, error);
      return NextResponse.json(
        { error: "Failed to create checkout session" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}
