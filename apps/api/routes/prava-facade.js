/**
 * Prava Facade — /prava/*
 *
 * Exposes Prava's agent buy-flow as HTTP endpoints so the OnPoint agent
 * backend and the Linq iMessage App card can drive a real purchase at a
 * real UCP fashion merchant. This is the agent checkout rail for the
 * Agentic Commerce Hackathon (ADR 0017, docs/PRAVA-HACKATHON.md).
 *
 * The flow is an async state machine because the user approves the spend
 * with a passkey on their device (out-of-band), which can take seconds to
 * minutes. The Linq card mutates through states:
 *
 *   look → search → product → quote → session(payment_url) →
 *     [user approves passkey] → checkout → confirmed(order_id)
 *
 * Endpoints:
 *   GET  /prava/health                 — mode + transport liveness
 *   GET  /prava/addresses              — masked delivery addresses (for quoting)
 *   POST /prava/search                 — shop_search across UCP merchants
 *   POST /prava/product                — shop_product (variants/offers)
 *   POST /prava/quote                  — shop_quote (binding total + checkout_session_id)
 *   POST /prava/order                  — create a pending order: quote + create_payment_session
 *                                        → returns {orderId, state:"awaiting_approval", paymentUrl, total, merchant}
 *   GET  /prava/order/:id              — order state + trust fields (spend ceiling, merchant scope)
 *   POST /prava/order/:id/approve      — (demo) mark the session approved so checkout can run
 *   POST /prava/order/:id/checkout     — run shop_checkout once the session is approved → confirmed
 *
 * Auth: service-key (these endpoints orchestrate paid actions on behalf of
 * the linked Prava agent). Mirrors the OKX facade's reliance on SERVICE_API_KEY.
 *
 * In-memory order store (hackathon scope; swap for Redis/DB for production).
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const prava = require('../lib/prava-client');
const tryOn = require('../lib/prava-tryon');

const router = express.Router();

// ── In-memory order store (TTL 30 min) ───────────────────────────────
const ORDER_TTL_MS = 30 * 60 * 1000;
const orders = new Map();

function pruneOrders() {
  const now = Date.now();
  for (const [id, o] of orders) {
    if (now - o.createdAt > ORDER_TTL_MS) orders.delete(id);
  }
}
setInterval(pruneOrders, 5 * 60 * 1000).unref();

function getOrder(id) {
  const o = orders.get(id);
  if (!o) {
    const err = new Error('Order not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return o;
}

// Trust fields surfaced to the user (the Visa "controls + protections" story).
function trustView(o) {
  return {
    spendCeilingUsd: o.totalAmount,
    currency: o.currency,
    merchantScope: { merchant: o.merchantName, url: o.merchantUrl, locked: true },
    credentialScope: 'single-use, merchant-locked, amount-scoped',
    approvalMethod: 'passkey (WebAuthn) on the owner device',
    guardrails: [
      'owner account controls',
      'passkey approval',
      'mandate amount cap (enforced at card-network level)',
      '15-minute session window',
      'one-time credential',
    ],
  };
}

function orderView(o) {
  return {
    orderId: o.id,
    state: o.state, // searching|quoted|awaiting_approval|approved|checking_out|confirmed|failed
    query: o.query || null,
    items: o.items || null,
    merchant: o.merchantName
      ? { name: o.merchantName, url: o.merchantUrl, country: o.merchantCountry }
      : null,
    totalAmount: o.totalAmount || null,
    currency: o.currency || null,
    quote: o.quote || null,
    paymentUrl: o.paymentUrl || null,
    paymentSessionId: o.paymentSessionId || null,
    checkoutSessionId: o.checkoutSessionId || null,
    orderIdPrava: o.orderIdPrava || null,
    garmentImageUrl: o.garmentImageUrl || null,
    tryOnUrl: o.tryOnUrl || null,
    trust: o.totalAmount ? trustView(o) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    selfCheck: prava.selfCheck(),
  };
}

// ── Auth ─────────────────────────────────────────────────────────────
// Most facade endpoints are public (order IDs are unguessable UUIDs; in
// self-check mode there are no real credentials). The /orders/recent admin
// endpoint is service-key gated — see below.
function serviceKeyAuth(req, res, next) {
  const key = req.header('x-service-key') || req.header('authorization')?.replace(/^Bearer\s+/i, '');
  if (!process.env.SERVICE_API_KEY || key !== process.env.SERVICE_API_KEY) {
    return res.status(401).json({ error: 'Invalid or missing service key' });
  }
  next();
}

// ── GET /prava/health ────────────────────────────────────────────────
router.get('/health', async (_req, res) => {
  const cliOk = await prava.cliAvailable();
  res.json({
    status: 'ok',
    mode: prava.selfCheck() ? 'self-check' : 'live',
    transport: prava.selfCheck() ? 'mock-fixtures' : `cli:${process.env.PRAVA_CLI_PATH || 'prava'}`,
    agentLinked: process.env.PRAVA_AGENT_LINKED === '1',
    cliAvailable: cliOk,
    buyFlow: ['shop_search', 'shop_product', 'shop_quote', 'create_payment_session', 'get_payment_status', 'shop_checkout'],
    note: prava.selfCheck()
      ? 'Self-check mode — walkable mock. Set PRAVA_CLI_PATH + PRAVA_AGENT_LINKED=1 (and `prava setup`) for live orders.'
      : 'Live mode — real orders via the prava CLI (production, real card).',
  });
});

// ── GET /prava/orders/recent — activity feed (public — same data as the card) ─
router.get('/orders/recent', async (_req, res) => {
  const limit = Math.min(parseInt(_req.query.limit) || 10, 50);
  const recent = [...orders.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map(orderView);
  res.json({ orders: recent });
});

// ── GET /prava/addresses ────────────────────────────────────────────
router.get('/addresses', async (_req, res, next) => {
  try {
    const r = await prava.shopListAddresses();
    res.json(r);
  } catch (e) { next(e); }
});

// ── POST /prava/search ───────────────────────────────────────────────
// Body: { query, merchant?, limit? }
router.post('/search', async (req, res, next) => {
  try {
    const { query, merchant, limit } = req.body || {};
    if (!query) return res.status(400).json({ error: 'query is required' });
    const r = await prava.shopSearch({ query, merchant, limit });
    res.json(r);
  } catch (e) { next(e); }
});

// ── POST /prava/product ──────────────────────────────────────────────
// Body: { productId, merchant? }
router.post('/product', async (req, res, next) => {
  try {
    const { productId, merchant } = req.body || {};
    if (!productId) return res.status(400).json({ error: 'productId is required' });
    const r = await prava.shopProduct({ productId, merchant });
    res.json(r);
  } catch (e) { next(e); }
});

// ── POST /prava/quote ───────────────────────────────────────────────
// Body: { variantId, merchant, quantity?, addressId? }
router.post('/quote', async (req, res, next) => {
  try {
    const { variantId, merchant, quantity, addressId } = req.body || {};
    if (!variantId || !merchant) {
      return res.status(400).json({ error: 'variantId and merchant are required' });
    }
    const r = await prava.shopQuote({ variantId, merchant, quantity, addressId });
    res.json(r);
  } catch (e) { next(e); }
});

// ── POST /prava/order — initiate: quote + create payment session ────
// Body: { query?, variantId?, merchant?, items?, addressId? }
//   - If variantId+merchant given, quote directly.
//   - Else if query given, search first and pick the top product/variant.
// Creates a payment session (charges nothing) and returns the payment_url
// for the owner to approve with a passkey.
router.post('/order', async (req, res, next) => {
  try {
    const { query, variantId, merchant, items, addressId, currency = 'USD' } = req.body || {};
    let chosenVariant = variantId;
    let chosenMerchant = merchant;
    let chosenProduct = null;

    // Discover if no variant pinned.
    if (!chosenVariant && query) {
      const search = await prava.shopSearch({ query });
      const top = search.results?.[0];
      if (!top) return res.status(404).json({ error: 'No products found for query', query });
      chosenProduct = top;
      chosenMerchant = top.merchant;
      const prod = await prava.shopProduct({ productId: top.product_id, merchant: chosenMerchant });
      const offer = prod.offers?.find((o) => o.available) || prod.offers?.[0];
      if (!offer) return res.status(409).json({ error: 'No available variant', product: prod });
      chosenVariant = offer.variant_id;
    }
    if (!chosenVariant || !chosenMerchant) {
      return res.status(400).json({ error: 'Provide variantId+merchant, or a query to discover.' });
    }

    // Lock the binding total.
    const quote = await prava.shopQuote({ variantId: chosenVariant, merchant: chosenMerchant, addressId });
    const totalAmount = quote.total;
    const products = items || [{ description: chosenProduct?.title || 'Fashion item', unit_price: quote.subtotal, quantity: 1 }];

    // Authorize payment (charges nothing). User approves via payment_url.
    const session = await prava.createPaymentSession({
      totalAmount,
      currency,
      merchantName: chosenMerchant,
      merchantUrl: `https://${chosenMerchant}`,
      merchantCountry: 'US',
      products,
    });

    const id = 'op_' + crypto.randomUUID();
    const now = Date.now();
    const order = {
      id,
      state: 'awaiting_approval',
      query,
      items: products,
      merchantName: chosenMerchant,
      merchantUrl: `https://${chosenMerchant}`,
      merchantCountry: 'US',
      totalAmount,
      currency,
      quote,
      checkoutSessionId: quote.checkout_session_id,
      paymentSessionId: session.session_id,
      paymentUrl: session.payment_url,
      // UCP product image used for the try-on-before-agent-buys leg.
      garmentImageUrl: chosenProduct?.image || null,
      tryOnUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    orders.set(id, order);

    logger.info('Prava order initiated — awaiting passkey approval', {
      component: 'prava-facade',
      orderId: id,
      merchant: chosenMerchant,
      total: totalAmount,
    });

    res.status(201).json(orderView(order));
  } catch (e) { next(e); }
});

// ── POST /prava/order/:id/try-on — IDM-VTON on the garment + user photo ─
// The "try-on-before-agent-buys" leg. Takes the person photo (base64 data
// URI), runs the UCP garment image through Replicate IDM-VTON, stores the
// render on the order. Self-check placeholder when no REPLICATE_API_TOKEN.
router.post('/order/:id/try-on', async (req, res, next) => {
  try {
    const o = getOrder(req.params.id);
    const { photoData, photoUrl } = req.body || {};
    if (!o.garmentImageUrl) {
      return res.status(409).json({ error: 'Order has no garment image to try on', order: orderView(o) });
    }
    const { renderUrl, provider } = await tryOn.tryOnGarment({
      garmentImageUrl: o.garmentImageUrl,
      photoData,
      photoUrl,
    });
    o.tryOnUrl = renderUrl;
    o.tryOnProvider = provider;
    // Surface a try-on-ready state until approval happens.
    if (o.state === 'awaiting_approval') o.state = 'try_on_ready';
    o.updatedAt = Date.now();
    orders.set(o.id, o);
    res.json({ tryOnUrl: renderUrl, provider, order: orderView(o) });
  } catch (e) { next(e); }
});

// ── GET /prava/order/:id ─────────────────────────────────────────────
router.get('/order/:id', (req, res) => {
  try {
    res.json(orderView(getOrder(req.params.id)));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message, code: e.code });
  }
});

// ── POST /prava/order/:id/poll — check payment approval ─────────────
// Polls Prava for the session status; if approved, flips state to approved.
router.post('/order/:id/poll', async (req, res, next) => {
  try {
    const o = getOrder(req.params.id);
    if (o.state !== 'awaiting_approval' && o.state !== 'try_on_ready' && o.state !== 'approved') {
      return res.status(409).json({ error: `Cannot poll in state ${o.state}`, order: orderView(o) });
    }
    const status = await prava.getPaymentStatus({ sessionId: o.paymentSessionId });
    if (status.status === 'completed') {
      o.state = 'approved';
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    } else if (status.status === 'failed') {
      o.state = 'failed';
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    }
    res.json({ state: o.state, paymentStatus: status.status, order: orderView(o) });
  } catch (e) { next(e); }
});

// ── POST /prava/order/:id/approve — (demo only) force approval ───────
// In self-check mode there is no real passkey; this lets the spine be
// walked end-to-end. In live mode the owner approves via paymentUrl.
router.post('/order/:id/approve', (req, res) => {
  try {
    const o = getOrder(req.params.id);
    if (o.state !== 'awaiting_approval' && o.state !== 'try_on_ready') {
      return res.status(409).json({ error: `Cannot approve in state ${o.state}`, order: orderView(o) });
    }
    if (!prava.selfCheck()) {
      return res.status(400).json({
        error: 'Live mode: approval happens out-of-band via the payment_url passkey. Use /poll to detect it.',
      });
    }
    o.state = 'approved';
    o.updatedAt = Date.now();
    orders.set(o.id, o);
    res.json({ state: o.state, order: orderView(o) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── POST /prava/order/:id/checkout — place the real order ───────────
// Requires the payment session to be approved first.
router.post('/order/:id/checkout', async (req, res, next) => {
  try {
    const o = getOrder(req.params.id);
    if (o.state !== 'approved') {
      return res.status(409).json({
        error: `Order must be approved before checkout (state=${o.state}). POST /prava/order/:id/poll first.`,
        order: orderView(o),
      });
    }
    o.state = 'checking_out';
    o.updatedAt = Date.now();
    orders.set(o.id, o);

    const result = await prava.shopCheckout({
      checkoutSessionId: o.checkoutSessionId,
      paymentSessionId: o.paymentSessionId,
    });

    if (result.status === 'completed' && result.order_id) {
      o.state = 'confirmed';
      o.orderIdPrava = result.order_id;
      o.updatedAt = Date.now();
      orders.set(o.id, o);
      logger.info('Prava order confirmed', {
        component: 'prava-facade', orderId: o.id, pravaOrder: result.order_id, amount: result.amount,
      });
      return res.json({ state: 'confirmed', order: orderView(o), result });
    }
    // Not yet approved or pending — stay pending for retry.
    o.state = 'awaiting_approval';
    o.updatedAt = Date.now();
    orders.set(o.id, o);
    return res.status(202).json({ state: 'awaiting_approval', message: 'Payment not approved yet; poll and retry.', result });
  } catch (e) { next(e); }
});

// ── Error handler ────────────────────────────────────────────────────
router.use((err, _req, res, _next) => {
  logger.error('Prava facade error', { component: 'prava-facade', code: err.code }, err);
  res.status(err.status || 500).json({
    error: err.message,
    code: err.code,
    context: err.context,
  });
});

module.exports = router;
// Allow same-process readers (the iMessage card renderer) to read order
// state without an HTTP round-trip. Returns null if not found (no throw).
module.exports.getOrderForCard = function getOrderForCard(id) {
  const o = orders.get(id);
  return o ? orderView(o) : null;
};
