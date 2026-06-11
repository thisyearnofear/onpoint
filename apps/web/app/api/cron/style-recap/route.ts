import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { getRetentionReport } from "../../../../lib/utils/analytics-store";
import { send } from "../../../../lib/services/email";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";

/**
 * POST /api/cron/style-recap
 *
 * Monthly re-engagement email using aggregate platform stats.
 * Triggered by the Hetzner worker with x-service-key auth.
 *
 * Future enhancement: when per-user style sessions are tracked server-side,
 * this will send personalized recaps (best score, trend, persona usage).
 */
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

    const adminEmail =
      process.env.ADMIN_EMAIL ??
      process.env.RESEND_FROM_EMAIL?.replace(/.*<(.+)>/, "$1") ??
      null;

    if (!adminEmail) {
      return NextResponse.json(
        { error: "No admin email configured" },
        { status: 400, headers: corsHeaders("*") },
      );
    }

    const report = await getRetentionReport();

    const APP_URL =
      process.env.AUTH0_BASE_URL ||
      process.env.APP_BASE_URL ||
      "https://onpoint.style";

    const monthLabel = new Date().toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });

    const totalSaves = report?.totalSaves ?? 0;
    const totalShares = report?.totalShares ?? 0;
    const shareRate = report?.shareRate ?? "—";

    const html = `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 4px;">
          OnPoint — ${monthLabel} in review
        </h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 24px;">Here's what the community has been up to this month.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #6366f1;">${totalSaves.toLocaleString()}</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Looks saved</p>
            </td>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #10b981;">${totalShares.toLocaleString()}</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Shared</p>
            </td>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #f59e0b;">${shareRate}</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Share rate</p>
            </td>
          </tr>
        </table>

        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 14px; font-weight: 600; color: #334155; margin: 0;">
            Your style is waiting — analyze your next look and see how you compare.
          </p>
        </div>

        <a href="${APP_URL}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">Analyze your next look →</a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">OnPoint — AI-powered personal styling</p>
      </div>
    `;

    const sent = await send({
      to: adminEmail,
      subject: `OnPoint ${monthLabel} — style recap`,
      html,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send recap email" },
        { status: 500, headers: corsHeaders("*") },
      );
    }

    logger.info("Style recap sent", {
      component: "cron",
      adminEmail,
      totalSaves,
      totalShares,
    });

    return NextResponse.json(
      { sent: true, recipient: adminEmail, totalSaves, totalShares },
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
