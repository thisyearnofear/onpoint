/**
 * Agent TopUp Route — /api/agent/topup and /api/webhooks/etherfuse
 *
 * Wraps the Etherfuse FX API to provide a fiat → USDC onramp for OnPoint
 * users. Extends the existing `agent-wallet` top-up concept; does NOT
 * create a parallel payment namespace.
 *
 * Exports:
 *   .router        — Express.Router mounted at /api/agent/topup (service-key auth)
 *                    Endpoints: POST /quote, POST /order, GET /order/:id, GET /balance
 *   .webhookRouter — Express.Router mounted at /api/webhooks/etherfuse (raw body, no auth)
 *                    Endpoints: POST /  (Etherfuse webhook delivery)
 *
 * Auth design:
 *   User-facing endpoints (quote, order, balance) require SERVICE_API_KEY
 *   via the serviceKeyAuth middleware in server.js. The webhook endpoint
 *   uses HMAC signature verification (X-Etherfuse-Signature) instead —
 *   no API key needed, because Etherfuse doesn't send one.
 */

const express = require('express');
const router = express.Router();
const webhookRouter = express.Router();
const logger = require('../lib/logger');
const { forwardedUser } = require('../middleware/forwarded-user');
const agentCore = require('@repo/agent-core');
const etherfuse = require('@repo/etherfuse');

router.use(forwardedUser);

// Lazily resolve the Etherfuse client so missing config doesn't crash
// the process — the route handlers return 503 with a "not configured"
// code that the UI can show as a friendly message.
function getClient() {
  return etherfuse.etherfuseClientFromEnv();
}

function validateAddress(addr) {
  return typeof addr === 'string' && /^0x[a-fA-F0-9]{40}$/.test(addr);
}

function validateTopUpBody(body) {
  const errors = [];
  if (!validateAddress(body.userAddress)) {
    errors.push('userAddress must be a valid 0x address');
  }
  if (!body.fiatAmount || Number.isNaN(parseFloat(body.fiatAmount))) {
    errors.push('fiatAmount must be a positive number string');
  }
  if (!body.fiat || !['MXN', 'USD', 'EUR'].includes(body.fiat)) {
    errors.push("fiat must be one of 'MXN', 'USD', 'EUR'");
  }
  if (body.chain && !['celo', 'base', 'ethereum', 'polygon'].includes(body.chain)) {
    errors.push("chain must be one of 'celo', 'base', 'ethereum', 'polygon'");
  }
  return errors.length ? errors.join('; ') : null;
}

// ── POST /quote ───────────────────────────────────────────────────────
router.post('/quote', async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      code: 'ETHERFUSE_NOT_CONFIGURED',
      error: 'Etherfuse onramp is not configured on the server. Set ETHERFUSE_API_KEY.',
    });
  }

  const validationError = validateTopUpBody(req.body);
  if (validationError) {
    return res.status(400).json({ success: false, error: validationError });
  }

  try {
    const quote = await etherfuse.getTopUpQuote(client, {
      userAddress: req.body.userAddress,
      fiatAmount: req.body.fiatAmount,
      fiat: req.body.fiat,
      chain: req.body.chain,
    });
    res.json({ success: true, quote });
  } catch (err) {
    logger.error('TopUp quote failed', { component: 'topup' }, err);
    res.status(502).json({ success: false, error: 'Upstream quote failed' });
  }
});

// ── POST /order ───────────────────────────────────────────────────────
router.post('/order', async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      code: 'ETHERFUSE_NOT_CONFIGURED',
      error: 'Etherfuse onramp is not configured on the server. Set ETHERFUSE_API_KEY.',
    });
  }

  const { quote, idempotencyKey } = req.body || {};
  if (!quote || !quote.quoteId) {
    return res.status(400).json({ success: false, error: 'quote with quoteId is required' });
  }
  if (!validateAddress(quote.recipientAddress)) {
    return res.status(400).json({ success: false, error: 'quote.recipientAddress invalid' });
  }

  try {
    const createReq = etherfuse.buildCreateOrderRequest(quote, idempotencyKey);
    const order = await etherfuse.createOrder(client, createReq);
    const topUpOrder = etherfuse.toTopUpOrder(order, quote);
    res.json({ success: true, order: topUpOrder });
  } catch (err) {
    logger.error('TopUp order failed', { component: 'topup' }, err);
    res.status(502).json({ success: false, error: 'Upstream order failed' });
  }
});

// ── GET /order/:id ────────────────────────────────────────────────────
router.get('/order/:id', async (req, res) => {
  const client = getClient();
  if (!client) {
    return res.status(503).json({
      success: false,
      code: 'ETHERFUSE_NOT_CONFIGURED',
      error: 'Etherfuse onramp is not configured on the server.',
    });
  }
  try {
    const order = await etherfuse.getOrder(client, req.params.id);
    res.json({ success: true, order });
  } catch (err) {
    logger.error('TopUp order fetch failed', { component: 'topup' }, err);
    res.status(502).json({ success: false, error: 'Upstream order fetch failed' });
  }
});

// ── GET /balance ──────────────────────────────────────────────────────
// Read the per-user top-up ledger (sums credits, no signing required).
router.get('/balance', async (req, res) => {
  const userAddress = req.query.userAddress;
  if (!validateAddress(userAddress)) {
    return res.status(400).json({ success: false, error: 'userAddress query param required' });
  }
  try {
    const store = etherfuse.getTopUpBalanceStore();
    const credits = await store.getCredits(userAddress);
    const total = await store.getTotalCredited(userAddress, 'USDC');
    res.json({ success: true, userAddress, totalCredited: total, credits });
  } catch (err) {
    logger.error('TopUp balance read failed', { component: 'topup' }, err);
    res.status(500).json({ success: false, error: 'Failed to read balance' });
  }
});

// ── POST / (webhookRouter) ────────────────────────────────────────────
// Mounted at /api/webhooks/etherfuse with express.raw() parser.
// req.body is a Buffer — convert to string for HMAC verification.
webhookRouter.post('/', async (req, res) => {
  const client = getClient();
  const secret = client?.config.webhookSecret ?? process.env.ETHERFUSE_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(503).json({ success: false, error: 'Webhook secret not configured' });
  }

  // req.body is a Buffer from express.raw(). Convert to UTF-8 string.
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf-8') : JSON.stringify(req.body);
  const signature = req.get('x-etherfuse-signature') || req.get('X-Etherfuse-Signature');

  let payload;
  try {
    payload = etherfuse.parseVerifiedWebhook(rawBody, signature, secret);
  } catch (err) {
    logger.warn('Etherfuse webhook signature failed', { component: 'topup' }, err);
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  if (!etherfuse.isCreditableEvent(payload.event)) {
    // Acknowledge non-creditable events; nothing to do.
    return res.json({ success: true, ignored: payload.event });
  }

  if (!payload.recipientAddress || !validateAddress(payload.recipientAddress)) {
    return res.status(400).json({ success: false, error: 'recipientAddress missing' });
  }

  try {
    const store = etherfuse.getTopUpBalanceStore();
    await store.recordCredit({
      userAddress: payload.recipientAddress,
      orderId: payload.orderId,
      fiat: 'MXN',
      fiatAmount: payload.sourceAmount ?? '0',
      cryptoAsset: 'USDC',
      cryptoAmount: payload.targetAmount ?? '0',
      chain: payload.chain ?? 'base',
      transactionHash: payload.transactionHash,
      creditedAt: payload.timestamp,
    });

    logger.info('Etherfuse top-up credited', {
      component: 'topup',
      orderId: payload.orderId,
      userAddress: payload.recipientAddress,
      txHash: payload.transactionHash,
    });

    res.json({ success: true });
  } catch (err) {
    logger.error('Etherfuse credit record failed', { component: 'topup' }, err);
    res.status(500).json({ success: false, error: 'Failed to record credit' });
  }
});

module.exports = { router, webhookRouter };
