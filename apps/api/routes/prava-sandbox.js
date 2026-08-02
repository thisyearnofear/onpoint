/**
 * Prava Sandbox Fallback — /prava/sandbox/*
 *
 * The live-demo safety net (ADR 0017). The headline demo path is the live
 * UCP + Browser Harness order (production, real card). If a live Shopify
 * checkout hiccups mid-demo, this route runs the **same trust story** via
 * Prava's REST session API in sandbox: create session → cardholder enters
 * card + passkey → poll for the one-time credential → report APPROVED →
 * `completed`. No real money, fully under our control.
 *
 * Unlike the /prava facade (which drives the CLI/MCP buy-flow), this path
 * uses the REST `POST /v1/sessions` + `payment-result` + `report-status`
 * endpoints directly. It is the "sandbox/test flow" the hackathon brief
 * explicitly allows.
 *
 * Self-check (PRAVA_SECRET_KEY unset): returns correctly-shaped mock
 * responses so the fallback is walkable without Prava sandbox keys.
 *
 * Env:
 *   PRAVA_SECRET_KEY      — sk_test_* (sandbox) or sk_live_* (production)
 *   PRAVA_PUBLISHABLE_KEY — pk_test_* / pk_live_* (for the SDK iframe)
 *   PRAVA_SANDBOX_BASE    — default https://sandbox.api.prava.space
 *   PRAVA_PRODUCTION_BASE — default https://api.prava.space
 *   SERVICE_API_KEY       — gates these endpoints
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const { humanizeMerchant } = require('../lib/prava-client');

const router = express.Router();

const SB_BASE = process.env.PRAVA_SANDBOX_BASE || 'https://sandbox.api.prava.space';
const PROD_BASE = process.env.PRAVA_PRODUCTION_BASE || 'https://api.prava.space';
const SECRET = process.env.PRAVA_SECRET_KEY;
const PUBLISHABLE = process.env.PRAVA_PUBLISHABLE_KEY;
const live = !!SECRET;
const isLiveKeys = (SECRET || '').startsWith('sk_live_');

function base() {
  return isLiveKeys ? PROD_BASE : SB_BASE;
}

// In-memory session store (hackathon scope).
const SESSION_TTL_MS = 20 * 60 * 1000;
const sessions = new Map();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) if (now - v.createdAt > SESSION_TTL_MS) sessions.delete(k);
}, 5 * 60 * 1000).unref();

// ── Service-key auth ─────────────────────────────────────────────────
function serviceKeyAuth(req, res, next) {
  const key = req.header('x-service-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.SERVICE_API_KEY || key !== process.env.SERVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing service key' });
  }
  next();
}
router.use(serviceKeyAuth);

// ── Prava REST call ──────────────────────────────────────────────────
async function pravaRest(method, path, body) {
  const r = await fetch(base() + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + SECRET,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) throw new Error('Prava REST ' + method + ' ' + path + ' failed ' + r.status + ': ' + text);
  return json;
}

// ── GET /prava/sandbox/health ────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: live ? (isLiveKeys ? 'live-rest' : 'sandbox-rest') : 'self-check',
    base: base(),
    secretKeyConfigured: !!SECRET,
    publishableKeyConfigured: !!PUBLISHABLE,
    note: live
      ? 'REST session flow against Prava ' + (isLiveKeys ? 'production' : 'sandbox') + '.'
      : 'Self-check — set PRAVA_SECRET_KEY (sk_test_*) + PRAVA_PUBLISHABLE_KEY (pk_test_*) for a real sandbox session.',
  });
});

// ── POST /prava/sandbox/order — create a Prava payment session ───────
// Body: { userId, email, totalAmount, currency, merchantName, merchantUrl,
//         merchantCountry, products }
// Charges nothing. Returns { sessionId, iframeUrl, sessionToken, expiresAt }.
router.post('/order', async (req, res, next) => {
  try {
    const { userId, email, totalAmount, currency = 'USD', merchantName, merchantUrl, merchantCountry = 'US', products, callbackUrl } = req.body || {};
    if (!totalAmount || !merchantName || !merchantUrl) {
      return res.status(400).json({ error: 'totalAmount, merchantName, merchantUrl are required' });
    }
    const displayName = humanizeMerchant(merchantName);

    if (!live) {
      // Self-check mock shaped like the real Create Session response.
      const id = 'ses_mock_' + crypto.randomUUID();
      const session = {
        sessionId: id,
        iframeUrl: 'https://sandbox.collect.prava.space?session=' + id,
        sessionToken: 'mock.jwt.' + id,
        orderId: 'ord_mock_' + crypto.randomUUID().slice(0, 8),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        merchantName: displayName, totalAmount, currency,
      };
      sessions.set(id, { ...session, state: 'pending', createdAt: Date.now() });
      logger.info('Prava sandbox session created (self-check)', { component: 'prava-sandbox', sessionId: id });
      return res.status(201).json(session);
    }

    const r = await pravaRest('POST', '/v1/sessions', {
      user_id: userId || 'onpoint_demo',
      user_email: email || 'demo@onpoint.famile.xyz',
      total_amount: String(totalAmount),
      currency,
      description: `${displayName} order via OnPoint`,
      integration_type: 'full_checkout',
      callback_url: callbackUrl || 'https://beonpoint.netlify.app/agent',
      purchase_context: [{
        merchant_details: {
          name: displayName,
          url: merchantUrl,
          country_code_iso2: merchantCountry,
          category_code: '5691',
          category: "Men's and Women's Clothing Stores",
        },
        product_details: (products || [{ description: 'Fashion item', unit_price: String(totalAmount), quantity: 1 }]),
      }],
    });
    const session = {
      sessionId: r.session_id,
      iframeUrl: r.iframe_url,
      sessionToken: r.session_token,
      orderId: r.order_id,
      expiresAt: r.expires_at,
      merchantName: displayName, totalAmount, currency,
    };
    sessions.set(r.session_id, { ...session, state: 'pending', createdAt: Date.now() });
    res.status(201).json(session);
  } catch (e) { next(e); }
});

// ── GET /prava/sandbox/order/:id/result — poll payment result ────────
// Returns the session status + one-time credentials when ready (awaiting_result).
router.get('/order/:id/result', async (req, res, next) => {
  try {
    const local = sessions.get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Session not found' });

    if (!live) {
      // Self-check: pretend the cardholder completed card entry + passkey.
      local.state = 'awaiting_result';
      return res.json({
        status: 'awaiting_result',
        transactions: [{
          txn_id: 'txn_mock_001',
          status: 'awaiting_result',
          line_items: [{
            txn_ref_id: 'tli_mock_001',
            merchant_name: local.merchantName,
            total_amount: String(local.totalAmount),
            status: 'awaiting_result',
            token: '4323126882557932',
            dynamic_cvv: '957',
            expiry_month: '12',
            expiry_year: '2028',
            products: [{ name: 'Fashion item', unit_price: String(local.totalAmount), quantity: 1 }],
          }],
        }],
      });
    }

    const r = await pravaRest('GET', '/v1/sessions/' + req.params.id + '/payment-result');
    if (r.status === 'completed' || r.status === 'failed') local.state = r.status;
    res.json(r);
  } catch (e) { next(e); }
});

// ── POST /prava/sandbox/order/:id/report — report outcome ────────────
// Body: { txnRefId, status: "APPROVED" | "DECLINED" }
// Closes the loop → status becomes completed/failed.
router.post('/order/:id/report', async (req, res, next) => {
  try {
    const local = sessions.get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Session not found' });
    const { txnRefId, status } = req.body || {};
    if (status !== 'APPROVED' && status !== 'DECLINED') {
      return res.status(400).json({ error: 'status must be APPROVED or DECLINED' });
    }

    if (!live) {
      local.state = status === 'APPROVED' ? 'completed' : 'failed';
      return res.json({ status: local.state, reported: status });
    }

    if (isLiveKeys) {
      return res.status(409).json({
        error: 'Production outcomes must come from a real merchant checkout; this sandbox helper cannot synthesize one.',
      });
    }

    const r = await pravaRest('POST', '/v1/sessions/' + req.params.id + '/report-status', {
      txn_ref_id: txnRefId,
      txn_status: status,
      txn_type: 'PURCHASE',
      response_code: status === 'APPROVED' ? '00' : '05',
      // Explicitly a sandbox processor simulation, not a merchant auth code.
      authorization_code: status === 'APPROVED' ? 'SANDBOX' : undefined,
    });
    local.state = status === 'APPROVED' ? 'completed' : 'failed';
    res.json({ ...r, status: local.state });
  } catch (e) { next(e); }
});

router.use((err, _req, res, _next) => {
  logger.error('Prava sandbox error', { component: 'prava-sandbox' }, err);
  res.status(500).json({ error: err.message });
});

module.exports = router;
