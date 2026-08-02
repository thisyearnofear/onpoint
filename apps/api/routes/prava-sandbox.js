/**
 * Prava Sandbox Fallback — /prava/sandbox/*
 *
 * The live-demo safety net (ADR 0017). The headline demo path is the live
 * UCP + Browser Harness order (production, real card). If a live Shopify
 * checkout hiccups mid-demo, this route exposes the REST sandbox contract:
 * create session → hosted verification → poll. It stops before external
 * checkout/reporting because no processor adapter is configured.
 *
 * Unlike the /prava facade (which drives the CLI/MCP buy-flow), this path
 * uses the same canonical Prava client as the /prava facade so request bodies
 * and error handling cannot drift.
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
const prava = require('../lib/prava-client');

const router = express.Router();

const SECRET = process.env.PRAVA_SECRET_KEY;
const PUBLISHABLE = process.env.PRAVA_PUBLISHABLE_KEY;
const live = prava.restMode();
const isLiveKeys = (SECRET || '').startsWith('sk_live_');

function base() {
  return isLiveKeys
    ? (process.env.PRAVA_PRODUCTION_BASE || 'https://api.prava.space')
    : (process.env.PRAVA_SANDBOX_BASE || 'https://sandbox.api.prava.space');
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
// Body: { totalAmount, currency, merchantName, merchantUrl, merchantCountry,
//         products }. Customer identity and callback URL come from the canonical
// Prava client rather than caller-provided overrides.
// Charges nothing. Returns { sessionId, iframeUrl, orderId, expiresAt }.
router.post('/order', async (req, res, next) => {
  try {
    const { totalAmount, currency = 'USD', merchantName, merchantUrl, merchantCountry = 'US', products } = req.body || {};
    if (!totalAmount || !merchantName || !merchantUrl) {
      return res.status(400).json({ error: 'totalAmount, merchantName, merchantUrl are required' });
    }
    const displayName = prava.humanizeMerchant(merchantName);

    if (live && !prava.restSandboxMode()) {
      return res.status(501).json({
        error: 'Live REST checkout is disabled until an external merchant checkout adapter is configured.',
        code: 'EXTERNAL_CHECKOUT_NOT_CONFIGURED',
      });
    }

    if (!live) {
      // Self-check mock shaped like the real Create Session response.
      const id = 'ses_mock_' + crypto.randomUUID();
      const session = {
        sessionId: id,
        iframeUrl: 'https://sandbox.collect.prava.space?session=' + id,
        orderId: 'ord_mock_' + crypto.randomUUID().slice(0, 8),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        merchantName: displayName, totalAmount, currency,
      };
      sessions.set(id, { ...session, state: 'pending', createdAt: Date.now() });
      logger.info('Prava sandbox session created (self-check)', { component: 'prava-sandbox', sessionId: id });
      return res.status(201).json(session);
    }

    const r = await prava.createRestSession({
      totalAmount,
      currency,
      merchantName,
      merchantUrl,
      merchantCountry,
      products: products || [{ description: 'Fashion item', unit_price: String(totalAmount), quantity: 1 }],
    });
    const session = {
      sessionId: r.session_id,
      iframeUrl: r.payment_url,
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
  let local;
  try {
    local = sessions.get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Session not found' });
    if (local.state === 'failed' && local.failure) {
      return res.json({
        session_id: req.params.id,
        status: 'failed',
        providerRecordId: local.providerRecordId || null,
        error: local.failure,
      });
    }

    if (!live) {
      local.state = 'self_check_credential_ready';
      return res.json({
        status: 'self_check_credential_ready',
        selfCheck: true,
      });
    }

    const r = await prava.pollRestSession({ sessionId: req.params.id });
    if (r.status === 'credential_ready' || r.status === 'failed') local.state = r.status;
    if (r.status === 'failed') {
      local.failure = r.error;
      local.providerRecordId = r.providerRecordId || null;
      return res.json({
        session_id: r.session_id,
        status: r.status,
        providerRecordId: r.providerRecordId,
        error: r.error,
      });
    }
    res.json({ session_id: r.session_id, status: r.status });
  } catch (e) {
    const definitive = e.code === 'incomplete_credential_response'
      || (e.status >= 400 && e.status < 500 && ![408, 425, 429].includes(e.status));
    if (local && definitive) {
      local.state = 'failed';
      local.failure = {
        code: e.code,
        message: e.message,
        status: e.status || null,
        details: e.context?.details || null,
        responseId: e.context?.responseId || null,
      };
    }
    next(e);
  }
});

// ── POST /prava/sandbox/order/:id/report — report outcome ────────────
// Fixture-only in self-check. Live reporting is disabled until an external
// checkout adapter can provide a processor-authenticated outcome.
router.post('/order/:id/report', async (req, res, next) => {
  try {
    const local = sessions.get(req.params.id);
    if (!local) return res.status(404).json({ error: 'Session not found' });
    const { status } = req.body || {};
    if (status !== 'APPROVED' && status !== 'DECLINED') {
      return res.status(400).json({ error: 'status must be APPROVED or DECLINED' });
    }

    if (!live) {
      local.state = status === 'APPROVED' ? 'completed' : 'failed';
      return res.json({
        status: status === 'APPROVED' ? 'self_check_completed' : 'self_check_failed',
        reportedFixture: status,
        selfCheck: true,
      });
    }

    if (isLiveKeys) {
      return res.status(409).json({
        error: 'Production outcomes must come from a real merchant checkout; this sandbox helper cannot synthesize one.',
      });
    }
    return res.status(501).json({
      error: 'External sandbox checkout adapter is not configured. Report the processor outcome only after a real checkout attempt.',
      code: 'EXTERNAL_CHECKOUT_REQUIRED',
    });
  } catch (e) { next(e); }
});

router.use((err, _req, res, _next) => {
  logger.error('Prava sandbox error', { component: 'prava-sandbox' }, err);
  res.status(err.status || 500).json({ error: err.message, code: err.code, context: err.context });
});

module.exports = router;
