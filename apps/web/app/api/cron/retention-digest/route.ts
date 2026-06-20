import { NextRequest, NextResponse } from "next/server";
import { corsHeaders } from "../../ai/_utils/http";
import { getRetentionReport } from "../../../../lib/utils/analytics-store";
import { send } from "../../../../lib/services/email";
import { getBaseUrl } from "../../../../lib/base-url";
import { logger } from "../../../../lib/utils/logger";
import { rateLimit, RateLimits, getClientId } from "../../../../lib/utils/rate-limit";
import { auth0 } from "../../../../lib/auth0";

/**
 * POST /api/cron/retention-digest
 *
 * Generates and sends a weekly retention digest email to the admin.
 * Can be triggered:
 *   1. Automatically — called weekly by the Hetzner worker (x-service-key auth)
 *   2. Manually — from the admin analytics dashboard (Auth0 session auth)
 *
 * Auth: accepts either x-service-key (internal) or valid Auth0 session (dashboard)
 */
export async function POST(request: NextRequest) {
  const rl = await rateLimit(getClientId(request), RateLimits.general);
  if (!rl.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  try {
    // Auth: accept either service key (internal calls) OR Auth0 session (admin dashboard)
    const serviceKey = process.env.SERVICE_API_KEY;
    let authorized = false;

    // Check 1: service API key (used by Hetzner worker)
    if (serviceKey) {
      const provided =
        request.headers.get("x-service-key") ??
        request.headers.get("authorization")?.replace("Bearer ", "")?.trim() ??
        null;
      if (provided && provided === serviceKey) {
        authorized = true;
      }
    }

    // Check 2: Auth0 session (used by admin dashboard)
    if (!authorized) {
      try {
        const session = await auth0.getSession();
        if (session?.user) {
          authorized = true;
        }
      } catch {
        // Not authenticated via Auth0 — continue
      }
    }

    if (!authorized) {
      return NextResponse.json(
        { error: "Unauthorized — provide x-service-key or authenticate via Auth0" },
        { status: 401, headers: corsHeaders("*") },
      );
    }

    // Determine recipient
    const adminEmail =
      process.env.ADMIN_EMAIL ??
      process.env.RESEND_FROM_EMAIL?.replace(/.*<(.+)>/, "$1") ??
      null;

    if (!adminEmail) {
      return NextResponse.json(
        {
          error:
            "No admin email configured. Set ADMIN_EMAIL or RESEND_FROM_EMAIL in env.",
        },
        { status: 400, headers: corsHeaders("*") },
      );
    }

    // Fetch retention data
    const report = await getRetentionReport();
    if (!report) {
      return NextResponse.json(
        { error: "Retention data unavailable — Redis not configured?" },
        { status: 503, headers: corsHeaders("*") },
      );
    }

    // ── Build the HTML email ────────────────────────────────────
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const weekLabel = `${weekStart.toLocaleDateString("en-US", { month: "long", day: "numeric" })} – ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

    const shareMethodRows = Object.entries(report.byShareMethod)
      .sort(([, a], [, b]) => b - a)
      .map(
        ([method, count]) =>
          `<tr>
            <td style="padding: 6px 12px; text-transform: capitalize; color: #64748b;">${method.replace(/_/g, " ")}</td>
            <td style="padding: 6px 12px; text-align: right; font-weight: 600;">${count.toLocaleString()}</td>
            <td style="padding: 6px 12px; text-align: right; color: #94a3b8;">${report.totalShares > 0 ? Math.round((count / report.totalShares) * 100) : 0}%</td>
          </tr>`,
      )
      .join("");

    const personaShareRows = Object.entries(report.bySharePersona)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(
        ([persona, count]) =>
          `<span style="display: inline-block; margin-right: 8px; padding: 2px 8px; border-radius: 4px; background: #f1f5f9; font-size: 12px; color: #334155;">${persona}: ${count}</span>`,
      )
      .join("");

    // Compute weekly totals (last 7 days from report)
    const weeklySaves = report.last7Days.reduce((sum, d) => sum + d.saves, 0);
    const weeklyCardOpens = report.last7Days.reduce(
      (sum, d) => sum + d.cardOpens,
      0,
    );
    const weeklyShares = report.last7Days.reduce((sum, d) => sum + d.shares, 0);
    const weeklyShareRate =
      weeklyCardOpens > 0
        ? `${Math.round((weeklyShares / weeklyCardOpens) * 100)}%`
        : "—";

    const APP_URL = getBaseUrl();

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <div style="margin-bottom: 32px;">
          <h1 style="font-size: 24px; font-weight: 800; margin: 0 0 4px; letter-spacing: -0.02em;">
            📊 Weekly Retention Digest
          </h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">
            ${weekLabel}
          </p>
        </div>

        <!-- Summary stats -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 32px;">
          <tr>
            <td style="width: 25%; padding: 16px 8px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #6366f1;">${report.totalSaves.toLocaleString()}</p>
              <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">Total saves</p>
            </td>
            <td style="width: 25%; padding: 16px 8px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #8b5cf6;">${report.totalCardOpens.toLocaleString()}</p>
              <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">Card opens</p>
            </td>
            <td style="width: 25%; padding: 16px 8px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #10b981;">${report.totalShares.toLocaleString()}</p>
              <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">Shares</p>
            </td>
            <td style="width: 25%; padding: 16px 8px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #f59e0b;">${report.shareRate}</p>
              <p style="font-size: 12px; color: #94a3b8; margin: 4px 0 0;">Share rate</p>
            </td>
          </tr>
        </table>

        <!-- This week summary -->
        <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin-bottom: 28px;">
          <h2 style="font-size: 14px; font-weight: 700; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">This week</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 4px 0; color: #334155; font-size: 14px;">Looks saved</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; font-size: 14px;">${weeklySaves.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #334155; font-size: 14px;">Style cards opened</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; font-size: 14px;">${weeklyCardOpens.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #334155; font-size: 14px;">Shares</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; font-size: 14px;">${weeklyShares.toLocaleString()}</td>
            </tr>
            <tr>
              <td style="padding: 4px 0; color: #334155; font-size: 14px;">Share rate</td>
              <td style="padding: 4px 0; text-align: right; font-weight: 700; font-size: 14px;">${weeklyShareRate}</td>
            </tr>
          </table>
        </div>

        <!-- Share channels -->
        ${shareMethodRows ? `
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 14px; font-weight: 700; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Share channels</h2>
          <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 12px; overflow: hidden;">
            <thead>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Channel</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Count</th>
                <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 600; text-transform: uppercase; color: #94a3b8;">Share</th>
              </tr>
            </thead>
            <tbody>
              ${shareMethodRows}
            </tbody>
          </table>
        </div>
        ` : ""}

        <!-- Top personas -->
        ${personaShareRows ? `
        <div style="margin-bottom: 28px;">
          <h2 style="font-size: 14px; font-weight: 700; margin: 0 0 12px; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b;">Shares by persona</h2>
          <div style="background: #f8fafc; border-radius: 12px; padding: 16px;">
            ${personaShareRows}
          </div>
        </div>
        ` : ""}

        <!-- CTA -->
        <div style="text-align: center; margin: 32px 0;">
          <a href="${APP_URL}/admin/analytics" style="display: inline-block; padding: 14px 28px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700; font-size: 14px;">
            View full dashboard →
          </a>
        </div>

        <!-- Footer -->
        <p style="color: #94a3b8; font-size: 11px; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 16px;">
          OnPoint — AI-powered personal styling<br>
          Sent automatically every week from the retention analytics pipeline.
        </p>
      </div>
    `;

    // ── Send ────────────────────────────────────────────────────
    const sent = await send({
      to: adminEmail,
      subject: `📊 Weekly Retention Digest — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`,
      html,
    });

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send digest email — Resend key configured?" },
        { status: 500, headers: corsHeaders("*") },
      );
    }

    logger.info("Retention digest sent", {
      component: "cron",
      adminEmail,
      totalSaves: report.totalSaves,
      totalShares: report.totalShares,
      shareRate: report.shareRate,
    });

    return NextResponse.json(
      {
        sent: true,
        recipient: adminEmail,
        summary: {
          totalSaves: report.totalSaves,
          totalCardOpens: report.totalCardOpens,
          totalShares: report.totalShares,
          shareRate: report.shareRate,
          weeklySaves,
          weeklyShares,
        },
      },
      { headers: corsHeaders("*") },
    );
  } catch (error) {
    logger.error("Retention digest failed", { component: "cron" }, error);
    return NextResponse.json(
      { error: "Failed to generate retention digest" },
      { status: 500, headers: corsHeaders("*") },
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders("*") });
}
