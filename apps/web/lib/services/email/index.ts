/**
 * Email Service — Resend
 *
 * Sends transactional emails. Only active when RESEND_API_KEY is set.
 * All emails use a single composable send function (DRY).
 */

import { Resend } from "resend";
import { logger } from "../../utils/logger";

function getClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

const FROM = process.env.RESEND_FROM_EMAIL || "OnPoint <noreply@onpoint.style>";

interface SendParams {
  to: string;
  subject: string;
  html: string;
}

async function send({ to, subject, html }: SendParams): Promise<boolean> {
  const client = getClient();
  if (!client) return false;

  try {
    await client.emails.send({ from: FROM, to, subject, html });
    logger.info("Email sent", { component: "email", to, subject });
    return true;
  } catch (error) {
    logger.error("Email send failed", { component: "email", to }, error);
    return false;
  }
}

const APP_URL = process.env.AUTH0_BASE_URL || process.env.APP_BASE_URL || "https://onpoint.style";

export async function sendWelcomeEmail(email: string, name?: string): Promise<boolean> {
  return send({
    to: email,
    subject: "Welcome to OnPoint — your AI stylist is ready",
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 8px;">Hey${name ? ` ${name}` : ""} 👋</h1>
        <p style="color: #64748b; line-height: 1.6;">Your AI stylist is ready. Upload a photo, get instant fit analysis, and discover pieces that match your style.</p>
        <a href="${APP_URL}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">Start Styling →</a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">OnPoint — AI-powered personal styling</p>
      </div>
    `,
  });
}

export async function sendStyleReportEmail(
  email: string,
  name: string | undefined,
  score: number,
  takeaways: string[],
): Promise<boolean> {
  const insightsHtml = takeaways
    .slice(0, 3)
    .map((t) => `<li style="margin-bottom: 8px; color: #334155;">${t}</li>`)
    .join("");

  return send({
    to: email,
    subject: `Your style score: ${score}/10 — see your full report`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 24px; font-weight: 800; margin-bottom: 4px;">Your Style Report</h1>
        <p style="color: #6366f1; font-size: 36px; font-weight: 900; margin: 8px 0;">${score}/10</p>
        <h2 style="font-size: 14px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; margin-top: 24px;">AI Insights</h2>
        <ul style="padding-left: 16px; line-height: 1.8;">${insightsHtml}</ul>
        <a href="${APP_URL}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">Shop Recommended Items →</a>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">OnPoint — AI-powered personal styling</p>
      </div>
    `,
  });
}
