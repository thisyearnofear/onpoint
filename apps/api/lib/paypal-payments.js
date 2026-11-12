/**
 * PayPal Payment Rail — approval-relay checkout via Orders v2.
 *
 * Third rail alongside Celo cUSD/x402 and NEAR. The flow mirrors the
 * challenge/verify pattern: the 402 response carries a `paypal` quote
 * block (orderId + approveUrl), the human payer approves at PayPal, then
 * the agent re-POSTs with { paypalOrderId }. We verify the order
 * server-side (custom_id binds it to exactly one resource) and capture
 * it — the capture id is the canonical proof, replay-guarded like a
 * chain tx hash.
 *
 * Config (all optional — rail is disabled when unset):
 *   PAYPAL_CLIENT_ID      REST app client id
 *   PAYPAL_CLIENT_SECRET  REST app secret (never logged)
 *   PAYPAL_ENV            'sandbox' (default) | 'live'
 *   PAYPAL_SELLER_PAYOUT_EMAIL  sandbox/live PayPal email that stands in for
 *                               the seller; when set, the platform pays out the
 *                               seller share over Payouts after capture.
 */

const logger = require('./logger');

function paypalEnv() {
  return process.env.PAYPAL_ENV === 'live' ? 'live' : 'sandbox';
}

function paypalBaseUrl() {
  return paypalEnv() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

function paypalRailEnabled() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

/** PayPal order ids are uppercase alphanumeric tokens (typically 17 chars). */
function isPaypalOrderId(value) {
  return typeof value === 'string' && /^[A-Z0-9]{10,32}$/.test(value);
}

// ── OAuth2 client-credentials token (cached until ~60s before expiry) ──
let cachedToken = null;
let cachedTokenExpiry = 0;

async function getAccessToken({ fetchImpl = fetch } = {}) {
  if (!paypalRailEnabled()) {
    const err = new Error('PayPal rail is not configured');
    err.code = 'PAYPAL_NOT_CONFIGURED';
    throw err;
  }
  if (cachedToken && Date.now() < cachedTokenExpiry) return cachedToken;

  const res = await fetchImpl(`${paypalBaseUrl()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(
        `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`,
      ).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const err = new Error(`PayPal auth failed (${res.status})`);
    err.code = 'PAYPAL_AUTH_FAILED';
    throw err;
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiry = Date.now() + (Number(data.expires_in || 300) - 60) * 1000;
  return cachedToken;
}

/**
 * Create an Orders v2 CAPTURE order. `referenceId` is stamped into the
 * purchase unit's custom_id so verify can bind an approved order to
 * exactly one resource.
 * @returns {Promise<{orderId: string, approveUrl: string|null}>}
 */
async function createPaypalOrder({
  amountUsd,
  referenceId,
  description,
  returnUrl,
  cancelUrl,
  requestId,
  fetchImpl = fetch,
} = {}) {
  const token = await getAccessToken({ fetchImpl });
  const res = await fetchImpl(`${paypalBaseUrl()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: referenceId,
          custom_id: referenceId,
          description: description || 'OnPoint order',
          amount: { currency_code: 'USD', value: Number(amountUsd).toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          experience_context: {
            user_action: 'PAY_NOW',
            ...(returnUrl ? { return_url: returnUrl } : {}),
            ...(cancelUrl ? { cancel_url: cancelUrl } : {}),
          },
        },
      },
    }),
  });
  if (!res.ok) {
    const err = new Error(`PayPal order create failed (${res.status})`);
    err.code = 'PAYPAL_CREATE_FAILED';
    throw err;
  }
  const data = await res.json();
  const links = data.links || [];
  const approve = links.find((l) => l.rel === 'payer-action') || links.find((l) => l.rel === 'approve');
  return { orderId: data.id, approveUrl: approve?.href || null };
}

/**
 * Verify an approved order belongs to this resource and capture it.
 *
 * @param {string} orderId
 * @param {string} [expectedReferenceId] — exact custom_id match
 * @param {string} [expectedReferencePrefix] — custom_id must start with this
 * @param {number} minAmountUsd
 * @returns {Promise<{ok:true, orderId, captureId, payerId, payerEmail,
 *   amountUsd, status} | {ok:false, reason:string}>}
 */
async function verifyAndCapturePaypalOrder({
  orderId,
  expectedReferenceId,
  expectedReferencePrefix,
  minAmountUsd,
  fetchImpl = fetch,
} = {}) {
  let token;
  try {
    token = await getAccessToken({ fetchImpl });
  } catch (err) {
    return { ok: false, reason: 'auth_failed' };
  }

  const getRes = await fetchImpl(`${paypalBaseUrl()}/v2/checkout/orders/${orderId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (getRes.status === 404) return { ok: false, reason: 'order_not_found' };
  if (!getRes.ok) return { ok: false, reason: `orders_get_${getRes.status}` };
  const order = await getRes.json();

  const unit = order.purchase_units?.[0];
  const reference = unit?.custom_id || unit?.reference_id || '';
  if (expectedReferenceId && reference !== expectedReferenceId) {
    return { ok: false, reason: 'reference_mismatch' };
  }
  if (expectedReferencePrefix && !reference.startsWith(expectedReferencePrefix)) {
    return { ok: false, reason: 'reference_mismatch' };
  }
  if (unit?.amount?.currency_code !== 'USD') {
    return { ok: false, reason: 'currency_mismatch' };
  }
  const amountUsd = Number(unit?.amount?.value);
  if (!Number.isFinite(amountUsd) || amountUsd < minAmountUsd) {
    return { ok: false, reason: 'insufficient_amount' };
  }

  let final = order;
  if (order.status === 'APPROVED') {
    const capRes = await fetchImpl(
      `${paypalBaseUrl()}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'PayPal-Request-Id': `capture-${orderId}`,
        },
      },
    );
    if (!capRes.ok) return { ok: false, reason: `capture_failed_${capRes.status}` };
    final = await capRes.json();
  }

  if (final.status !== 'COMPLETED') {
    return { ok: false, reason: 'not_approved', status: final.status };
  }
  const capture = final.purchase_units?.[0]?.payments?.captures?.[0];
  if (!capture || capture.status !== 'COMPLETED') {
    return { ok: false, reason: 'capture_incomplete', status: capture?.status || final.status };
  }

  return {
    ok: true,
    orderId: final.id || orderId,
    captureId: capture.id,
    payerId: final.payer?.payer_id || null,
    payerEmail: final.payer?.email_address || null,
    amountUsd: Number(capture.amount?.value ?? amountUsd),
    status: 'COMPLETED',
  };
}

function paypalSellerPayoutEmail() {
  const email = process.env.PAYPAL_SELLER_PAYOUT_EMAIL;
  return typeof email === 'string' && email.includes('@') ? email : null;
}

/**
 * Pay the seller share over PayPal Payouts after a capture.
 *
 * `senderBatchId` must be deterministic per payment so a retried verify
 * (the claim-first replay path re-checks the order) can never double-pay:
 * PayPal dedupes on sender_batch_id and returns the existing batch.
 *
 * @returns {Promise<{ok:true, payoutBatchId, batchStatus, amountUsd} |
 *   {ok:false, reason:string}>}
 */
async function sendPaypalPayout({
  receiverEmail,
  amountUsd,
  senderBatchId,
  note,
  fetchImpl = fetch,
} = {}) {
  if (!paypalRailEnabled()) return { ok: false, reason: 'not_configured' };
  const amount = Number(amountUsd);
  if (!Number.isFinite(amount) || amount < 0.01) {
    return { ok: false, reason: 'below_minimum' };
  }
  let token;
  try {
    token = await getAccessToken({ fetchImpl });
  } catch (err) {
    return { ok: false, reason: 'auth_failed' };
  }
  const res = await fetchImpl(`${paypalBaseUrl()}/v1/payments/payouts`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender_batch_header: {
        sender_batch_id: String(senderBatchId).slice(0, 64),
        email_subject: 'Your OnPoint sale payout',
        email_message: note || 'OnPoint curator payout',
      },
      items: [
        {
          recipient_type: 'EMAIL',
          amount: { value: amount.toFixed(2), currency: 'USD' },
          receiver: receiverEmail,
          note: note || 'OnPoint curator payout',
          sender_item_id: String(senderBatchId).slice(0, 64),
        },
      ],
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { ok: false, reason: `payout_failed_${res.status}_${data?.name || 'unknown'}` };
  }
  return {
    ok: true,
    payoutBatchId: data?.batch_header?.payout_batch_id || null,
    batchStatus: data?.batch_header?.batch_status || null,
    amountUsd: amount,
  };
}

/**
 * Best-effort PayPal quote block for a 402 challenge. Returns null when
 * the rail is disabled or order creation fails — never throws.
 */
async function paypalQuoteForUsd({ amountUsd, referenceId, description, fetchImpl = fetch } = {}) {
  if (!paypalRailEnabled()) return null;
  try {
    const { orderId, approveUrl } = await createPaypalOrder({
      amountUsd,
      referenceId,
      description,
      requestId: `onpoint-${referenceId}`.slice(0, 128),
      fetchImpl,
    });
    return { env: paypalEnv(), orderId, approveUrl, amountUsd: Number(amountUsd.toFixed(2)) };
  } catch (err) {
    logger.warn('PayPal order creation failed — rail omitted from quote', {
      component: 'paypal-payments',
      error: err?.message,
    });
    return null;
  }
}

module.exports = {
  paypalEnv,
  paypalBaseUrl,
  paypalRailEnabled,
  isPaypalOrderId,
  getAccessToken,
  createPaypalOrder,
  verifyAndCapturePaypalOrder,
  paypalQuoteForUsd,
  paypalSellerPayoutEmail,
  sendPaypalPayout,
};
module.exports.__test = {
  resetTokenCache() { cachedToken = null; cachedTokenExpiry = 0; },
};
