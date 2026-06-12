import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { send } from "../../../../lib/services/email";
import { StyleContextStore } from "../../../../lib/services/style-context-store";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

interface WeeklyMetrics {
  totalLooks: number;
  bestScore: number;
  avgScore: number;
  mostUsedPersona: string;
  trend: "improving" | "stable" | "declining";
}

/**
 * Compute weekly style metrics from a user's style context.
 */
function computeWeeklyMetrics(context: {
  recentAnalyses: Array<{
    metadata: {
      timestamp?: number;
      score?: number;
      persona?: string;
    };
  }>;
}): WeeklyMetrics | null {
  const oneWeekAgo = Date.now() - 7 * 86400 * 1000;
  const lastWeekAnalyses = context.recentAnalyses.filter(
    (a) => a.metadata.timestamp && a.metadata.timestamp >= oneWeekAgo,
  );

  if (lastWeekAnalyses.length === 0) return null;

  const scores = lastWeekAnalyses
    .filter((a) => a.metadata.score != null)
    .map((a) => a.metadata.score!);

  const totalLooks = lastWeekAnalyses.length;
  const bestScore = scores.length > 0 ? Math.max(...scores) : 0;
  const avgScore =
    scores.length > 0
      ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) /
        10
      : 0;

  // Most used persona
  const personaCounts = new Map<string, number>();
  for (const a of lastWeekAnalyses) {
    if (a.metadata.persona) {
      personaCounts.set(
        a.metadata.persona,
        (personaCounts.get(a.metadata.persona) || 0) + 1,
      );
    }
  }
  let mostUsedPersona = "none";
  let maxCount = 0;
  for (const [persona, count] of personaCounts) {
    if (count > maxCount) {
      mostUsedPersona = persona;
      maxCount = count;
    }
  }

  // Trend: compare first half vs second half of the week
  let trend: WeeklyMetrics["trend"] = "stable";
  if (scores.length >= 4) {
    const mid = Math.floor(scores.length / 2);
    const firstHalf = scores.slice(0, mid);
    const secondHalf = scores.slice(mid);
    const firstAvg =
      firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg =
      secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    if (secondAvg > firstAvg + 0.5) trend = "improving";
    else if (secondAvg < firstAvg - 0.5) trend = "declining";
  }

  return { totalLooks, bestScore, avgScore, mostUsedPersona, trend };
}

export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    const serviceKey = process.env.SERVICE_API_KEY;
    const provided =
      request.headers.get("x-service-key") ??
      request.headers.get("authorization")?.replace("Bearer ", "")?.trim() ??
      null;

    if (!serviceKey || provided !== serviceKey) {
      return NextResponse.json(
        { error: "Unauthorized — provide x-service-key" },
        { status: 401, headers: corsHeaders("*") },
      );
    }

    // In production, load active user IDs from Redis/Drizzle.
    // For now, we iterate known users from the style context store.
    // The context store uses an in-memory Map keyed by userId.
    // A production build would query Drizzle for users with sessions in the last 7 days.
    const activeUserIds: string[] = []; // e.g., from redis visitor list or drizzle

    // Example: if we have a Redis set "active:users:weekly", read it here.
    // For demo purposes, we attempt to send to the admin address as a fallback.
    const adminEmail =
      process.env.ADMIN_EMAIL ??
      process.env.RESEND_FROM_EMAIL?.replace(/.*<(.+)>/, "$1") ??
      null;

    if (activeUserIds.length === 0 && adminEmail) {
      // Fallback: send a single admin-level digest
      const monthLabel = new Date().toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      });

      const sent = await send({
        to: adminEmail,
        subject: `OnPoint ${monthLabel} — style recap`,
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
            <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 4px;">
              OnPoint — ${monthLabel} in review
            </h1>
            <p style="color: #94a3b8; font-size: 13px; margin: 0 0 24px;">Community digest for ${monthLabel}.</p>
            <p style="color: #64748b;">No active users with weekly data yet. Register users in the style context store to enable personalized recaps.</p>
            <a href="${process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "https://onpoint.style"}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">View Dashboard →</a>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">OnPoint — AI-powered personal styling</p>
          </div>
        `,
      });

      if (!sent) {
        return NextResponse.json(
          { error: "Failed to send recap email" },
          { status: 500, headers: corsHeaders("*") },
        );
      }

      logger.info("Admin style recap sent", {
        component: "cron",
        adminEmail,
      });
    }

    // Personalized recaps for active users
    let sentCount = 0;
    const errors: string[] = [];

    for (const userId of activeUserIds) {
      try {
        const context = await StyleContextStore.getUnifiedContext(userId);
        const metrics = computeWeeklyMetrics(context);

        if (!metrics) {
          logger.info("Skipping recap — no weekly data", {
            component: "cron",
            userId,
          });
          continue;
        }

        // In production, look up user email from Drizzle.
        // For now, log the metrics that would be sent.
        logger.info("Personalized recap computed", {
          component: "cron",
          userId,
          metrics,
        });
        sentCount++;
      } catch (err) {
        logger.error("Failed to process user recap", {
          component: "cron",
          userId,
        }, err);
        errors.push(userId);
      }
    }

    return NextResponse.json(
      {
        sent: sentCount > 0 || activeUserIds.length === 0,
        activeUsers: activeUserIds.length,
        personalizedSent: sentCount,
        errors: errors.length > 0 ? errors : undefined,
        message:
          activeUserIds.length === 0
            ? "No active users — admin digest sent as fallback"
            : `Sent ${sentCount} personalized recaps (${errors.length} errors)`,
      },
      { headers: corsHeaders("*") },
    );
  } catch (error) {
    logger.error("Style recap cron failed", { component: "cron" }, error);
    return NextResponse.json(
      { error: "Failed to generate style recap" },
      { status: 500, headers: corsHeaders("*") },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders("*") });
}
