/**
 * Subscription Management API - Phase 6.3
 * 
 * Advanced subscription management with tiered permissions.
 * Supports trials, upgrades, cancellations, and usage tracking.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  requireAuthWithRateLimit,
  setUserSubscription,
} from "../../../../middleware/agent-auth";
import { logger } from "../../../../lib/utils/logger";
import {
  getUserSubscription,
  startTrial,
  hasActiveTrial,
  upgradeSubscription,
  cancelSubscription,
  reactivateSubscription,
  getUsage,
  getAllTiers,
  getTierConfig,
  type SubscriptionTier,
} from "../../../../lib/services/subscription-service";
import { corsHeaders } from "../../ai/_utils/http";

const StartTrialSchema = z.object({
  durationDays: z.number().min(1).max(30).default(14),
});
export { OPTIONS } from "../../ai/_utils/http";

const UpgradeSchema = z.object({
  tier: z.enum(["basic", "pro", "concierge"]),
  paymentMethod: z.enum(["stripe", "superfluid", "manual"]).default("manual"),
  paymentId: z.string().optional(),
});

const CancelSchema = z.object({
  immediate: z.boolean().default(false),
});

// GET - Check current subscription and usage
export async function GET(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    try {
      // List all available tiers
      if (action === "tiers") {
        const tiers = getAllTiers();
        return NextResponse.json(
          { tiers },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      // Get current subscription
      const subscription = await getUserSubscription(ctx.userId);
      const usage = await getUsage(ctx.userId);
      const hasTrial = await hasActiveTrial(ctx.userId);

      if (!subscription) {
        return NextResponse.json(
          {
            userId: ctx.userId,
            tier: "free",
            status: "active",
            hasTrial: false,
            canStartTrial: !hasTrial,
            usage: null,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      const config = getTierConfig(subscription.tier);

      return NextResponse.json(
        {
          subscription: {
            ...subscription,
            config,
          },
          usage,
          hasTrial,
          canStartTrial: !hasTrial && subscription.tier === "free",
        },
        { status: 200, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Subscription check error", { component: "subscription" }, error);
      return NextResponse.json(
        { error: "Failed to check subscription" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

// POST - Manage subscription (trial, upgrade, cancel, reactivate)
export async function POST(request: NextRequest): Promise<NextResponse> {
  return requireAuthWithRateLimit(async (req, ctx) => {
    const origin = req.headers.get("origin") ?? undefined;

    try {
      const body = await req.json();
      const action = body.action as "trial" | "upgrade" | "cancel" | "reactivate";

      if (action === "trial") {
        const parsed = StartTrialSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const hasTrial = await hasActiveTrial(ctx.userId);
        if (hasTrial) {
          return NextResponse.json(
            { error: "Trial already active or used" },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const subscription = await startTrial(ctx.userId, parsed.data.durationDays);

        // Update auth context
        await setUserSubscription(ctx.userId, subscription.tier);

        return NextResponse.json(
          {
            success: true,
            message: `${parsed.data.durationDays}-day trial started`,
            subscription,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "upgrade") {
        const parsed = UpgradeSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const { tier, paymentMethod, paymentId } = parsed.data;

        // In production, verify payment here
        // For Stripe: verify webhook or check payment intent
        // For Superfluid: verify flow rate on-chain

        const subscription = await upgradeSubscription(
          ctx.userId,
          tier,
          paymentMethod,
          paymentId,
        );

        // Update auth context
        await setUserSubscription(ctx.userId, subscription.tier);

        return NextResponse.json(
          {
            success: true,
            message: `Upgraded to ${tier}`,
            subscription,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "cancel") {
        const parsed = CancelSchema.safeParse(body);
        if (!parsed.success) {
          return NextResponse.json(
            { error: parsed.error.message },
            { status: 400, headers: corsHeaders(origin) },
          );
        }

        const subscription = await cancelSubscription(ctx.userId, parsed.data.immediate);

        if (!subscription) {
          return NextResponse.json(
            { error: "No active subscription found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: parsed.data.immediate
              ? "Subscription canceled immediately"
              : "Subscription will cancel at period end",
            subscription,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      if (action === "reactivate") {
        const subscription = await reactivateSubscription(ctx.userId);

        if (!subscription) {
          return NextResponse.json(
            { error: "No subscription found" },
            { status: 404, headers: corsHeaders(origin) },
          );
        }

        return NextResponse.json(
          {
            success: true,
            message: "Subscription reactivated",
            subscription,
          },
          { status: 200, headers: corsHeaders(origin) },
        );
      }

      return NextResponse.json(
        { error: "Invalid action. Use: trial, upgrade, cancel, or reactivate" },
        { status: 400, headers: corsHeaders(origin) },
      );
    } catch (error) {
      logger.error("Subscription operation error", { component: "subscription" }, error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Operation failed" },
        { status: 500, headers: corsHeaders(origin) },
      );
    }
  })(request);
}

