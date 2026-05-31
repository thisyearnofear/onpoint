/**
 * Daraja API — Safaricom M-Pesa STK Push (Lipa Na M-Pesa Online)
 *
 * Docs: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
 *
 * Uses sandbox environment when DARAJA_SANDBOX=true (default: true).
 * Switch to production by setting DARAJA_SANDBOX=false and using
 * live credentials.
 */

import { logger } from "../utils/logger";

// ─── Types ──────────────────────────────────────────────────────────

export type DarajaConfig = {
  consumerKey: string;
  consumerSecret: string;
  passkey: string;
  businessShortCode: string;
  callbackBaseUrl: string;
  sandbox: boolean;
};

export type StkPushRequest = {
  phoneNumber: string;       // 2547XXXXXXXX
  amount: number;
  accountReference: string;   // e.g. "onpoint/wanja/listing-abc123"
  transactionDesc: string;    // e.g. "Payment for Arsenal home kit"
};

export type StkPushResponse = {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
};

export type StkCallbackPayload = {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
};

// ─── Helpers ────────────────────────────────────────────────────────

function getBaseUrl(sandbox: boolean): string {
  return sandbox
    ? "https://sandbox.safaricom.co.ke"
    : "https://api.safaricom.co.ke";
}

/**
 * Normalize phone number: +2547XXXXXXXX or 07XXXXXXXX → 2547XXXXXXXX
 */
function normalizePhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s+\-()]/g, "");
  if (/^2547\d{8}$/.test(cleaned)) return cleaned;
  if (/^0?7\d{8}$/.test(cleaned)) return `254${cleaned.replace(/^0/, "")}`;
  if (/^\+2547\d{8}$/.test(cleaned)) return cleaned.slice(1);
  return null;
}

/**
 * Generate the timestamp in YYYYMMDDHHMMSS format.
 */
function timestamp(): string {
  const now = new Date();
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    String(now.getFullYear()) +
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds())
  );
}

/**
 * Generate the Base64-encoded password for STK Push:
 *   Base64(BusinessShortCode + Passkey + Timestamp)
 */
function generatePassword(
  businessShortCode: string,
  passkey: string,
  ts: string,
): string {
  return Buffer.from(businessShortCode + passkey + ts).toString("base64");
}

// ─── Configuration ─────────────────────────────────────────────────

function loadConfig(): DarajaConfig | null {
  const consumerKey = process.env.DARAJA_CONSUMER_KEY;
  const consumerSecret = process.env.DARAJA_CONSUMER_SECRET;
  const passkey = process.env.DARAJA_PASSKEY;
  const businessShortCode = process.env.DARAJA_BUSINESS_SHORTCODE;
  const callbackBaseUrl =
    process.env.DARAJA_CALLBACK_BASE_URL ||
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_AGENT_API_URL ||
    "http://localhost:3000";

  if (!consumerKey || !consumerSecret || !passkey || !businessShortCode) {
    return null;
  }

  return {
    consumerKey,
    consumerSecret,
    passkey,
    businessShortCode,
    callbackBaseUrl,
    sandbox: process.env.DARAJA_SANDBOX !== "false",
  };
}

// ─── Auth ───────────────────────────────────────────────────────────

/**
 * Get OAuth access token from Daraja API.
 */
async function getAccessToken(config: DarajaConfig): Promise<string | null> {
  const baseUrl = getBaseUrl(config.sandbox);
  const credentials = Buffer.from(
    `${config.consumerKey}:${config.consumerSecret}`,
  ).toString("base64");

  try {
    const res = await fetch(
      `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
      {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      },
    );

    if (!res.ok) {
      logger.warn("Daraja auth failed", { component: "daraja", status: res.status });
      return null;
    }

    const data = (await res.json()) as { access_token?: string };
    return data.access_token || null;
  } catch (error) {
    logger.warn("Daraja auth error", { component: "daraja" }, error);
    return null;
  }
}

// ─── STK Push ───────────────────────────────────────────────────────

/**
 * Initiate an STK Push (Lipa Na M-Pesa Online) payment.
 *
 * Returns the checkout request ID on success, or null on failure.
 */
export async function initiateStkPush(
  request: StkPushRequest,
): Promise<{ checkoutRequestId: string } | { error: string }> {
  const config = loadConfig();
  if (!config) {
    return { error: "Daraja not configured — set DARAJA_CONSUMER_KEY, DARAJA_CONSUMER_SECRET, DARAJA_PASSKEY, and DARAJA_BUSINESS_SHORTCODE" };
  }

  const token = await getAccessToken(config);
  if (!token) {
    return { error: "Failed to authenticate with Daraja API" };
  }

  const phone = normalizePhone(request.phoneNumber);
  if (!phone) {
    return { error: "Invalid phone number — use a valid Safaricom number (e.g. 2547XXXXXXXX)" };
  }

  const shortCode = parseInt(config.businessShortCode, 10);
  const ts = timestamp();
  const password = generatePassword(config.businessShortCode, config.passkey, ts);

  const payload = {
    BusinessShortCode: shortCode,
    Password: password,
    Timestamp: ts,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(request.amount),
    PartyA: parseInt(phone, 10),
    PartyB: shortCode,
    PhoneNumber: parseInt(phone, 10),
    CallBackURL: `${config.callbackBaseUrl}/api/curator/stk-callback`,
    AccountReference: request.accountReference.slice(0, 12),
    TransactionDesc: request.transactionDesc.slice(0, 13),
  };

  try {
    const baseUrl = getBaseUrl(config.sandbox);
    const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn("Daraja STK Push failed", {
        component: "daraja",
        status: res.status,
        body: text.slice(0, 500),
      });
      return { error: `Daraja API returned ${res.status}` };
    }

    const data = (await res.json()) as StkPushResponse;

    if (data.ResponseCode !== "0") {
      return { error: data.ResponseDescription || "STK Push request rejected" };
    }

    logger.info("STK Push initiated", {
      component: "daraja",
      checkoutRequestId: data.CheckoutRequestID,
      merchantRequestId: data.MerchantRequestID,
    });

    return { checkoutRequestId: data.CheckoutRequestID };
  } catch (error) {
    logger.warn("Daraja STK Push error", { component: "daraja" }, error);
    return { error: "Failed to initiate STK Push" };
  }
}

// ─── Callback handler ───────────────────────────────────────────────

/**
 * Parse and validate an STK Push callback payload from Safaricom.
 *
 * Returns the parsed result on success, or null if invalid.
 */
export function parseStkCallback(
  payload: unknown,
): {
  success: boolean;
  checkoutRequestId: string;
  merchantRequestId: string;
  resultCode: number;
  resultDesc: string;
  mpesaReceiptNumber?: string;
  phoneNumber?: string;
  amount?: number;
} | null {
  if (!payload || typeof payload !== "object") return null;

  const body = payload as StkCallbackPayload;
  const cb = body?.Body?.stkCallback;
  if (!cb) return null;

  const result: Record<string, string | number> = {};
  if (cb.CallbackMetadata?.Item) {
    for (const item of cb.CallbackMetadata.Item) {
      if (item.Value !== undefined) {
        result[item.Name] = item.Value;
      }
    }
  }

  return {
    success: cb.ResultCode === 0,
    checkoutRequestId: cb.CheckoutRequestID,
    merchantRequestId: cb.MerchantRequestID,
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    mpesaReceiptNumber: result.MpesaReceiptNumber as string | undefined,
    phoneNumber: result.PhoneNumber as string | undefined,
    amount: result.Amount as number | undefined,
  };
}
