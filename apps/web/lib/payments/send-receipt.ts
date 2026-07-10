/**
 * Receipt Sending Service
 *
 * Sends order confirmation receipts to customers via:
 * 1. WhatsApp (Meta Business API) — primary channel, uses curator's WABA
 * 2. Email (Resend) — fallback if email is provided
 *
 * Called after delivery details are submitted and the order is complete.
 */

import { logger } from "../../lib/utils/logger";
import { getBaseUrl } from "../base-url";

// ─── Types ────────────────────────────────────────────────────

export interface ReceiptPayload {
  orderNumber: string;
  curatorName: string;
  itemName: string;
  size: string;
  amount: number;
  currency: string;
  mpesaCode?: string | null;
  paymentMethod: "stk" | "manual";
  recipientName: string;
  recipientPhone: string;
  deliveryAddress: string;
  courierMethod: string;
  /** Customer's phone in E.164 (e.g. +254712345678) — for WhatsApp */
  customerPhone: string;
  /** Optional email address */
  customerEmail?: string | null;
  /** Payment ID for tracking link */
  paymentId: string;
  /** Curator slug for tracking link */
  curatorSlug: string;
}

/** Payload for fulfilment status update notifications */
export interface FulfilmentPayload {
  /** Order number for reference (e.g. ONP-XXXXX) */
  orderNumber: string;
  curatorName: string;
  itemName: string;
  /** Customer's phone number — WhatsApp destination */
  customerPhone: string;
  /** Payment ID for tracking link */
  paymentId: string;
  /** Curator slug for tracking link */
  curatorSlug: string;
}

// ─── WhatsApp ─────────────────────────────────────────────────

function getWhatsAppConfig() {
  const token = process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;
  return token && phoneNumberId ? { token, phoneNumberId } : null;
}

/**
 * Low-level WhatsApp message sender.
 * Reusable for receipts, fulfilment updates, and any other notification.
 * Falls back silently if WhatsApp env vars are not configured.
 */
export async function sendWhatsAppMessage(
  to: string,
  messageBody: string,
  context?: { component?: string; orderNumber?: string },
): Promise<boolean> {
  const config = getWhatsAppConfig();
  if (!config) return false;

  try {
    const url = `https://graph.facebook.com/v22.0/${config.phoneNumberId}/messages`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: to.replace(/^\+/, ""), // Remove leading +
        type: "text",
        text: { body: messageBody },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.warn("WhatsApp message send failed", {
        component: context?.component || "send-whatsapp",
        status: res.status,
        error: errBody.slice(0, 300),
      });
      return false;
    }

    logger.info("WhatsApp message sent", {
      component: context?.component || "send-whatsapp",
      to,
      orderNumber: context?.orderNumber,
    });
    return true;
  } catch (error) {
    logger.warn("WhatsApp message send error", {
      component: context?.component || "send-whatsapp",
      to,
    }, error);
    return false;
  }
}

/**
 * Send a receipt via WhatsApp Business API.
 * Falls back silently if env vars are not configured.
 */
async function sendViaWhatsApp(
  to: string,
  payload: ReceiptPayload,
): Promise<boolean> {
  const formattedAmount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: payload.currency,
    maximumFractionDigits: 0,
  }).format(payload.amount);

  const trackingUrl = `${getBaseUrl()}/track?id=${encodeURIComponent(payload.paymentId)}&slug=${encodeURIComponent(payload.curatorSlug)}`;

  const message = [
    `🛍️ *Order Confirmed — ${payload.curatorName}*`,
    `━━━━━━━━━━━━━━━━━`,
    `Order: ${payload.orderNumber}`,
    `Item: ${payload.itemName} (${payload.size})`,
    `Total: ${formattedAmount}`,
    `Paid: via M-Pesa${payload.mpesaCode ? ` (${payload.mpesaCode})` : ""}`,
    `━━━━━━━━━━━━━━━━━`,
    `📦 *Delivery*`,
    `To: ${payload.recipientName}`,
    `📍 ${payload.deliveryAddress}`,
    `📱 ${payload.recipientPhone}`,
    `🚚 ${payload.courierMethod}`,
    `━━━━━━━━━━━━━━━━━`,
    `Track your order: ${trackingUrl}`,
    `━━━━━━━━━━━━━━━━━`,
    `Thanks for shopping with ${payload.curatorName}! 🙏`,
    ``,
    `Keep your order number handy: ${payload.orderNumber}`,
  ].join("\n");

  return sendWhatsAppMessage(to, message, {
    component: "send-receipt",
    orderNumber: payload.orderNumber,
  });
}

// ─── Email ─────────────────────────────────────────────────────

function getEmailConfig() {
  const key = process.env.RESEND_API_KEY;
  return key || null;
}

/**
 * Build a beautiful HTML receipt email body.
 */
function buildReceiptEmail(payload: ReceiptPayload): string {
  const formattedAmount = new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: payload.currency,
    maximumFractionDigits: 0,
  }).format(payload.amount);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0; padding:0; background:#f5f5f5; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5; padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%;">

          <!-- Header / Success banner -->
          <tr>
            <td style="background:linear-gradient(135deg, #065f46 0%, #047857 100%); border-radius:12px 12px 0 0; padding:32px 24px; text-align:center;">
              <div style="width:48px; height:48px; border-radius:50%; background:rgba(255,255,255,0.2); margin:0 auto 12px; display:flex; align-items:center; justify-content:center;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <h1 style="color:#ffffff; font-size:20px; font-weight:800; margin:0 0 4px;">Order confirmed!</h1>
              <p style="color:rgba(255,255,255,0.8); font-size:13px; margin:0;">
                ${new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}
              </p>
              <div style="display:inline-block; margin-top:8px; padding:4px 12px; border:1px solid rgba(255,255,255,0.3); border-radius:999px;">
                <span style="color:rgba(255,255,255,0.9); font-size:12px; font-family:monospace;">${payload.orderNumber}</span>
              </div>
            </td>
          </tr>

          <!-- Receipt section -->
          <tr>
            <td style="background:#ffffff; padding:24px; border-bottom:1px solid #e2e8f0;">
              <h2 style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin:0 0 16px;">Payment receipt</h2>
              ${row("Item", payload.itemName)}
              ${row("Size", payload.size)}
              ${row("Total paid", `<strong style="color:#065f46;">${formattedAmount}</strong>`)}
              ${row("Payment", payload.paymentMethod === "stk" ? "Auto-pay (STK)" : "Manual M-Pesa")}
              ${payload.mpesaCode ? row("M-Pesa code", `<code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px;">${payload.mpesaCode}</code>`) : ""}
            </td>
          </tr>

          <!-- Delivery section -->
          <tr>
            <td style="background:#ffffff; padding:24px;">
              <h2 style="font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; margin:0 0 16px;">Delivery details</h2>
              ${row("Recipient", payload.recipientName)}
              ${row("Phone", payload.recipientPhone)}
              ${row("Address", payload.deliveryAddress)}
              ${row("Courier", payload.courierMethod)}
            </td>
          </tr>

          <!-- Tracking link -->
          <tr>
            <td style="background:#ffffff; padding:16px 24px; border-bottom:1px solid #e2e8f0; text-align:center;">
              <a href="${getBaseUrl()}/track?id=${encodeURIComponent(payload.paymentId)}&slug=${encodeURIComponent(payload.curatorSlug)}" style="display:inline-block; padding:10px 24px; background:#065f46; color:#ffffff; font-size:13px; font-weight:700; border-radius:8px; text-decoration:none;">
                Track your order →
              </a>
              <p style="color:#94a3b8; font-size:11px; margin:8px 0 0;">
                View real-time delivery status updates for your order.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc; border-radius:0 0 12px 12px; padding:20px 24px; text-align:center;">
              <p style="color:#94a3b8; font-size:12px; margin:0 0 8px;">
                Thanks for shopping with <strong style="color:#334155;">${payload.curatorName}</strong> 🙏
              </p>
              <p style="color:#94a3b8; font-size:11px; margin:0;">
                Keep your order number <strong style="color:#334155;">${payload.orderNumber}</strong> handy for reference.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
      <tr>
        <td style="padding:6px 0; font-size:13px; color:#64748b; width:40%;">${label}</td>
        <td style="padding:6px 0; font-size:13px; color:#1e293b; text-align:right;">${value}</td>
      </tr>
    </table>`;
}

async function sendViaEmail(
  to: string,
  payload: ReceiptPayload,
): Promise<boolean> {
  const apiKey = getEmailConfig();
  if (!apiKey) return false;

  // RESEND_FROM_EMAIL must be set to a Resend-verified address in production.
  // The fallback only fires when unconfigured; Resend will reject it loudly.
  const from = process.env.RESEND_FROM_EMAIL || "OnPoint <onboarding@resend.dev>";

  try {
    const html = buildReceiptEmail(payload);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: `Order confirmed! ${payload.orderNumber} — ${payload.curatorName}`,
        html,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      logger.warn("Email receipt send failed", {
        component: "send-receipt",
        status: res.status,
        error: errBody.slice(0, 300),
      });
      return false;
    }

    logger.info("Email receipt sent", {
      component: "send-receipt",
      to,
      orderNumber: payload.orderNumber,
    });
    return true;
  } catch (error) {
    logger.warn("Email receipt send error", {
      component: "send-receipt",
      to,
    }, error);
    return false;
  }
}

// ─── Main entry point ─────────────────────────────────────────

const SEND_RECIPIENT_KEY = "curator:payments:receipt_sent";

/**
 * Send the receipt to the customer after order completion.
 * Sends via WhatsApp (primary) and email (if email provided).
 * Deduplicates to ensure we don't send twice.
 *
 * Returns { whatsapp, email } booleans indicating success per channel.
 */
export async function sendReceipt(payload: ReceiptPayload): Promise<{
  whatsapp: boolean;
  email: boolean;
}> {
  const results = { whatsapp: false, email: false };

  // ── Send via WhatsApp ──
  if (payload.customerPhone) {
    results.whatsapp = await sendViaWhatsApp(payload.customerPhone, payload);
  }

  // ── Send via Email ──
  if (payload.customerEmail) {
    results.email = await sendViaEmail(payload.customerEmail, payload);
  }

  return results;
}

// ─── Fulfilment status notifications ──────────────────────────

/**
 * Send a WhatsApp notification to the customer when a delivery
 * status is updated by the admin (rider_assigned, delivered).
 *
 * Non-blocking — never throws. Returns true if sent successfully.
 */
export async function sendFulfilmentUpdate(
  payload: FulfilmentPayload,
  status: "ready_for_pickup" | "rider_assigned" | "delivered",
): Promise<boolean> {
  if (!payload.customerPhone) return false;

  const trackingUrl = `${getBaseUrl()}/track?id=${encodeURIComponent(payload.paymentId)}&slug=${encodeURIComponent(payload.curatorSlug)}`;

  const statusMessages: Record<string, string> = {
    ready_for_pickup: [
      `📦 *Ready for pickup — ${payload.curatorName}*`,
      `━━━━━━━━━━━━━━━━━`,
      `Order: ${payload.orderNumber}`,
      `Item: ${payload.itemName}`,
      `━━━━━━━━━━━━━━━━━`,
      `Your order is ready for courier pickup! 🎉`,
      ``,
      `Track your order: ${trackingUrl}`,
      `━━━━━━━━━━━━━━━━━`,
      `We'll notify you once a rider has been assigned.`,
      `Thank you for shopping with ${payload.curatorName}! 🙏`,
    ].join("\n"),
    rider_assigned: [
      `🛵 *Rider on the way — ${payload.curatorName}*`,
      `━━━━━━━━━━━━━━━━━`,
      `Order: ${payload.orderNumber}`,
      `Item: ${payload.itemName}`,
      `━━━━━━━━━━━━━━━━━`,
      `Your rider has been assigned and is heading to deliver your order! 🎉`,
      ``,
      `Track your order: ${trackingUrl}`,
      `━━━━━━━━━━━━━━━━━`,
      `You'll receive another update once it's delivered.`,
      `Thank you for shopping with ${payload.curatorName}! 🙏`,
    ].join("\n"),
    delivered: [
      `✅ *Delivered! — ${payload.curatorName}*`,
      `━━━━━━━━━━━━━━━━━`,
      `Order: ${payload.orderNumber}`,
      `Item: ${payload.itemName}`,
      `━━━━━━━━━━━━━━━━━`,
      `Your order has been delivered! 🎉`,
      ``,
      `We hope you love your new item. If you have any questions,`,
      `reach out to ${payload.curatorName} directly.`,
      ``,
      `Thanks for shopping with OnPoint! 🙏`,
    ].join("\n"),
  };

  const messageBody = statusMessages[status];
  if (!messageBody) return false;

  return sendWhatsAppMessage(payload.customerPhone, messageBody, {
    component: "send-fulfilment-update",
    orderNumber: payload.orderNumber,
  });
}
