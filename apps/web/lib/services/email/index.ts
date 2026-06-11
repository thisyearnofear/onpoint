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

export async function send({ to, subject, html }: SendParams): Promise<boolean> {
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

export async function sendSubscriptionEmail(
  email: string,
  event: "trial_ending" | "payment_succeeded" | "payment_failed" | "subscription_canceled" | "subscription_renewed" | "subscription_upgraded" | "subscription_past_due",
  details?: { tier?: string; amount?: number; daysRemaining?: number; attemptCount?: number },
): Promise<boolean> {
  const subjects: Record<string, string> = {
    trial_ending: "Your OnPoint trial is ending soon",
    payment_succeeded: "Payment successful — OnPoint subscription",
    payment_failed: "Payment failed — update your billing info",
    subscription_canceled: "OnPoint subscription canceled",
    subscription_renewed: "Your OnPoint subscription has renewed",
    subscription_upgraded: "You've been upgraded! 🎉",
    subscription_past_due: "OnPoint subscription past due",
  };

  const bodies: Record<string, string> = {
    trial_ending: details?.daysRemaining
      ? `Your Pro trial ends in ${details.daysRemaining} days. Subscribe now to keep your premium features.`
      : "Your Pro trial is ending soon. Subscribe to keep your premium features.",
    payment_succeeded: `Your ${details?.tier || "subscription"} payment of $${(details?.amount || 0).toFixed(2)} was processed successfully.`,
    payment_failed: `Your ${details?.tier || "subscription"} payment failed${details?.attemptCount ? ` (attempt ${details.attemptCount})` : ""}. Update your payment method to avoid losing access.`,
    subscription_canceled: "Your subscription has been canceled. You'll lose access at the end of your billing period.",
    subscription_renewed: `Your ${details?.tier || "plan"} has been renewed successfully.`,
    subscription_upgraded: `You've been upgraded to ${details?.tier || "a new plan"}! Enjoy your enhanced features.`,
    subscription_past_due: "Your subscription is past due. Please update your payment method to restore access.",
  };

  const actionTexts: Record<string, string> = {
    trial_ending: "Manage Subscription →",
    payment_succeeded: "View Details →",
    payment_failed: "Update Payment Method →",
    subscription_canceled: "Reactivate →",
    subscription_renewed: "View Subscription →",
    subscription_upgraded: "Explore New Features →",
    subscription_past_due: "Update Payment →",
  };

  const subject = subjects[event]!;
  const body = bodies[event]!;
  const actionText = actionTexts[event]!;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
      <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 12px;">${subject}</h1>
      <p style="color: #64748b; line-height: 1.6; margin-bottom: 24px;">${body}</p>
      <a href="${APP_URL}/account/subscription" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">${actionText}</a>
      <p style="color: #94a3b8; font-size: 12px; margin-top: 32px;">OnPoint — AI-powered personal styling</p>
    </div>
  `;

  return send({ to: email, subject, html });
}

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

export async function sendStyleRecapEmail(
  email: string,
  name: string | undefined,
  recap: {
    totalLooks: number;
    bestScore: number;
    avgScore: number;
    mostUsedPersona: string;
    trend: "improving" | "stable" | "declining";
  },
): Promise<boolean> {
  const trendLabel =
    recap.trend === "improving"
      ? "Your scores are trending up — keep pushing."
      : recap.trend === "declining"
        ? "Try a bolder palette or a new stylist to shake things up."
        : "Consistent style — ready to level up?";

  const tip =
    recap.avgScore < 7
      ? "Try a bolder palette — experimentation pays off."
      : recap.avgScore < 8
        ? "Focus on accessories to push from good to great."
        : "Your eye is sharp. Try a new persona for fresh perspectives.";

  return send({
    to: email,
    subject: `Your OnPoint month in review — ${recap.totalLooks} looks analyzed`,
    html: `
      <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 20px; font-weight: 800; margin-bottom: 4px;">
          Hey${name ? ` ${name}` : ""} — your style month
        </h1>
        <p style="color: #94a3b8; font-size: 13px; margin: 0 0 24px;">Here's what you've been up to on OnPoint.</p>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
          <tr>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #6366f1;">${recap.totalLooks}</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Looks analyzed</p>
            </td>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #10b981;">${recap.bestScore}/10</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Best score</p>
            </td>
            <td style="width: 33%; padding: 12px 4px; text-align: center;">
              <p style="font-size: 28px; font-weight: 900; margin: 0; color: #f59e0b;">${recap.avgScore}/10</p>
              <p style="font-size: 11px; color: #94a3b8; margin: 4px 0 0;">Average</p>
            </td>
          </tr>
        </table>

        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Most-used stylist</p>
          <p style="font-size: 16px; font-weight: 700; color: #334155; margin: 0; text-transform: capitalize;">${recap.mostUsedPersona}</p>
        </div>

        <div style="background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
          <p style="font-size: 13px; color: #64748b; margin: 0 0 4px;">Trend</p>
          <p style="font-size: 14px; font-weight: 600; color: #334155; margin: 0;">${trendLabel}</p>
        </div>

        <div style="border-left: 3px solid #6366f1; padding-left: 12px; margin-bottom: 28px;">
          <p style="font-size: 13px; color: #334155; margin: 0;"><strong>Tip:</strong> ${tip}</p>
        </div>

        <a href="${APP_URL}" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 999px; font-weight: 700;">Analyze your next look →</a>
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
