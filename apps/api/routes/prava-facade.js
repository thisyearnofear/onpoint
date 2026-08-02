/**
 * Prava Facade — /prava/*
 *
 * Exposes Prava orchestration as HTTP endpoints. The production CLI rail can
 * drive a merchant checkout; REST sandbox stops at credential readiness until
 * an external checkout adapter supplies a real processor outcome; self-check
 * is fixture-only.
 *
 * The flow is an async state machine because the user approves the spend
 * with a passkey on their device (out-of-band), which can take seconds to
 * minutes. The Linq card mutates through states:
 *
 *   look → search → product → session(payment_url) → hosted verification →
 *     credential_ready (REST) OR checkout → confirmed(order_id) (production CLI)
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

function failureView(err) {
  return {
    code: err?.code || 'PRAVA_ERROR',
    message: err?.message || 'Prava request failed.',
    status: err?.status || null,
    details: err?.context?.details || null,
    responseId: err?.context?.responseId || null,
  };
}

// Trust fields surfaced to the user (the Visa "controls + protections" story).
function trustView(o) {
  const selfCheck = !o.restMode && prava.selfCheck();
  const approvalMethod = selfCheck
    ? 'not applicable: deterministic fixture only'
    : o.restMode
      ? 'hosted card and device verification required before issuance'
      : 'passkey (WebAuthn) required on the owner device before issuance';
  return {
    spendCeilingUsd: o.totalAmount,
    currency: o.currency,
    merchantScope: { merchant: o.merchantName, url: o.merchantUrl, locked: false },
    credentialScope: 'expected if issued: single-use, merchant-locked, amount-scoped',
    approvalMethod,
    guardrails: [
      'session requests this amount and merchant metadata',
      approvalMethod,
      'credential controls follow Prava’s documented model if issuance succeeds',
      '15-minute session window',
    ],
  };
}

function orderView(o) {
  return {
    orderId: o.id,
    state: o.state, // searching|quoted|awaiting_approval|approved|credential_ready|checking_out|checkout_unknown|confirmed|sandbox_completed|sandbox_declined|self_check_completed|failed
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
    sandboxOrderId: o.sandboxOrderId || null,
    selfCheckOrderId: o.selfCheckOrderId || null,
    failure: o.failure || null,
    // Which payment rail this order uses — lets the client render the right
    // approval UX (hosted card-entry link for REST sandbox vs passkey button).
    restMode: !!o.restMode,
    garmentImageUrl: o.garmentImageUrl || null,
    tryOnUrl: o.tryOnUrl || null,
    trust: o.totalAmount ? trustView(o) : null,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
    selfCheck: !o.restMode && prava.selfCheck(),
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
  const rest = prava.restMode();
  const mode = rest
    ? (prava.restSandboxMode() ? 'sandbox-rest' : 'live-rest')
    : (prava.selfCheck() ? 'self-check' : 'live');
  const transport = rest
    ? 'rest:' + (prava.restSandboxMode()
        ? (process.env.PRAVA_SANDBOX_BASE || 'https://sandbox.api.prava.space')
        : (process.env.PRAVA_PRODUCTION_BASE || 'https://api.prava.space'))
    : (prava.selfCheck() ? 'mock-fixtures' : `cli:${process.env.PRAVA_CLI_PATH || 'prava'}`);
  res.json({
    status: 'ok',
    mode,
    transport,
    restMode: rest,
    agentLinked: process.env.PRAVA_AGENT_LINKED === '1',
    cliAvailable: cliOk,
    buyFlow: rest
      ? ['shop_search', 'shop_product', 'create_rest_session', 'poll_rest_session', 'external_checkout_required']
      : ['shop_search', 'shop_product', 'shop_quote', 'create_payment_session', 'poll_payment_session', 'shop_checkout'],
    note: rest
      ? (prava.restSandboxMode()
          ? 'Sandbox REST mode — real Prava session with a test card (no real money). Discovery via CLI/UCP.'
          : 'Live REST session mode — a separate merchant checkout must charge the credential before report-status.')
      : prava.selfCheck()
        ? 'Self-check mode — walkable mock. Set PRAVA_SECRET_KEY (sk_test_*) for sandbox, or PRAVA_CLI_PATH + PRAVA_AGENT_LINKED=1 for live.'
        : 'Live mode — real orders via the prava CLI (production, real card).',
  });
});

// ── GET /prava/orders/recent — privacy-safe public activity projection ─
router.get('/orders/recent', async (_req, res) => {
  const limit = Math.min(parseInt(_req.query.limit) || 10, 50);
  const recent = [...orders.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit)
    .map((o) => ({
      orderId: crypto.createHash('sha256').update(o.id).digest('hex').slice(0, 16),
      state: o.state,
      query: null,
      merchant: o.merchantName ? { name: o.merchantName, url: '', country: o.merchantCountry } : null,
      totalAmount: o.totalAmount || null,
      currency: o.currency || null,
      hasTryOn: !!o.tryOnUrl,
      orderIdPrava: o.state === 'confirmed' ? o.orderIdPrava || null : null,
      sandboxOrderId: o.state === 'sandbox_completed' ? o.sandboxOrderId || null : null,
      selfCheckOrderId: null,
      restMode: !!o.restMode,
      selfCheck: !o.restMode && prava.selfCheck(),
      createdAt: o.createdAt,
    }));
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
// Body: { query?, productId?, variantId?, merchant?, addressId? }
//   - If productId+variantId+merchant are given, reload and verify the offer.
//   - Else if query given, search first and pick the top product/variant.
// Creates a payment session (charges nothing) and returns the payment_url
// for the owner to approve with a passkey.
router.post('/order', async (req, res, next) => {
  try {
    const { query, productId, variantId, merchant, addressId } = req.body || {};
    if (prava.restMode() && !prava.restSandboxMode()) {
      return res.status(501).json({
        error: 'Live REST checkout is disabled until an external merchant checkout adapter is configured.',
        code: 'EXTERNAL_CHECKOUT_NOT_CONFIGURED',
      });
    }
    let chosenVariant = variantId;
    let chosenMerchant = merchant;
    let chosenProduct = null;
    let selectedOffer = null;

    // Resolve an explicitly selected search result server-side. Re-run the
    // originating search and match productId so merchant provenance comes
    // from Prava rather than the browser request.
    if (productId && chosenMerchant) {
      if (!query) {
        return res.status(400).json({ error: 'query is required when selecting a productId.' });
      }
      const search = await prava.shopSearch({ query, intent: query });
      const matched = search.results?.find((result) => result.product_id === productId);
      if (!matched) {
        return res.status(409).json({ error: 'Selected product could not be verified against Prava search results.' });
      }
      if (matched.merchant !== chosenMerchant) {
        return res.status(400).json({ error: 'Merchant does not match the selected Prava search result.' });
      }
      chosenMerchant = matched.merchant;
      const prod = await prava.shopProduct({ productId, merchant: chosenMerchant });
      const offer = chosenVariant
        ? prod.offers?.find((o) => o.variant_id === chosenVariant && o.available)
        : (prod.offers?.find((o) => o.available) || prod.offers?.[0]);
      if (!offer) return res.status(409).json({ error: 'No available variant', product: prod });
      chosenProduct = {
        ...prod,
        title: matched.title || prod.description,
        image: matched.image || prod.image,
        product_id: productId,
      };
      selectedOffer = offer;
      chosenVariant = offer.variant_id;
    }

    // Discover from natural-language intent when no product is pinned.
    if (!chosenVariant && query) {
      const search = await prava.shopSearch({ query, intent: query });
      const top = search.results?.[0];
      if (!top) return res.status(404).json({ error: 'No products found for query', query });
      chosenMerchant = top.merchant;
      const prod = await prava.shopProduct({ productId: top.product_id, merchant: chosenMerchant });
      const offer = prod.offers?.find((o) => o.available) || prod.offers?.[0];
      if (!offer) return res.status(409).json({ error: 'No available variant', product: prod });
      chosenProduct = { ...prod, title: top.title, image: top.image || prod.image, product_id: top.product_id };
      selectedOffer = offer;
      chosenVariant = offer.variant_id;
    }
    if (chosenVariant && !chosenProduct) {
      return res.status(400).json({ error: 'query and productId are required to verify a selected variant.' });
    }
    if (!chosenVariant || !chosenMerchant || !chosenProduct || !selectedOffer) {
      return res.status(400).json({ error: 'Provide productId+variantId+merchant, or a query to discover.' });
    }

    // Two payment rails:
    //  • REST sandbox (PRAVA_SECRET_KEY set) — use Browser Harness for a
    //    binding merchant quote, then Prava's SDK/API path for the sandbox
    //    card credential tied to that exact total.
    //  • CLI / self-check — full quote → createPaymentSession (real-card prod
    //    or deterministic fixtures).
    const useRest = prava.restMode();
    let quote = null;
    let totalAmount;
    let products;
    let session;

    if (useRest) {
      // Browser Harness owns the merchant checkout, so create the REST
      // credential for its binding total (item + shipping + tax), not the
      // discovery/listed price.
      quote = await prava.shopQuote({
        variantId: chosenVariant,
        merchant: chosenMerchant,
        addressId,
      });
      const quoteAmount = quote.total || quote.final_price?.amount;
      const quoteCurrency = quote.currency || quote.final_price?.currency || selectedOffer.currency || 'USD';
      if (!quote.checkout_session_id || !quoteAmount) {
        return res.status(409).json({ error: 'Prava did not return a binding checkout quote.' });
      }
      totalAmount = String(quoteAmount);
      products = [{
        product_id: chosenProduct.product_id,
        description: chosenProduct.title || chosenProduct.description || selectedOffer.description || 'Fashion item',
        unit_price: String(selectedOffer.unit_price),
        quantity: 1,
      }];
      session = await prava.createRestSession({
        totalAmount,
        currency: quoteCurrency,
        merchantName: chosenMerchant,
        merchantUrl: `https://${chosenMerchant}`,
        merchantCountry: 'US',
        products,
      });
    } else {
      // Lock the binding total via the CLI quote.
      quote = await prava.shopQuote({ variantId: chosenVariant, merchant: chosenMerchant, addressId });
      totalAmount = quote.total;
      products = [{ description: chosenProduct.title || chosenProduct.description || selectedOffer.description || 'Fashion item', unit_price: quote.subtotal, quantity: 1 }];
      const currency = quote.currency || selectedOffer.currency || 'USD';
      // Authorize payment (charges nothing). User approves via payment_url.
      session = await prava.createPaymentSession({
        totalAmount,
        currency,
        merchantName: prava.humanizeMerchant(chosenMerchant),
        merchantUrl: `https://${chosenMerchant}`,
        merchantCountry: 'US',
        products,
      });
    }

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
      currency: quote?.currency || quote?.final_price?.currency || selectedOffer.currency || 'USD',
      quote,
      // Which payment rail this order uses (drives poll/checkout routing).
      restMode: useRest,
      checkoutSessionId: quote?.checkout_session_id || null,
      paymentSessionId: session.session_id,
      paymentUrl: session.payment_url,
      // REST session carries Prava's sandbox session-order record id. It is
      // not a merchant order confirmation.
      pravaOrderId: session.order_id || null,
      // txn_ref_id captured on poll; needed to report the charge outcome.
      txnRefId: null,
      // Single-use tokenized card credentials, populated once the owner
      // approves the payment session (poll). Used by checkout. Null until approved.
      token: null,
      cryptogram: null,
      expiryMonth: null,
      expiryYear: null,
      // UCP product image used for the pre-checkout try-on leg.
      garmentImageUrl: chosenProduct?.image || null,
      tryOnUrl: null,
      createdAt: now,
      updatedAt: now,
    };
    orders.set(id, order);

    logger.info(useRest
      ? 'Prava sandbox order initiated — awaiting hosted card flow'
      : prava.selfCheck()
        ? 'Prava self-check order fixture initiated'
        : 'Prava order initiated — awaiting passkey approval', {
      component: 'prava-facade',
      orderId: id,
      merchant: chosenMerchant,
      total: totalAmount,
    });

    res.status(201).json(orderView(order));
  } catch (e) { next(e); }
});

// ── POST /prava/order/:id/try-on — IDM-VTON on the garment + user photo ─
// The pre-checkout try-on leg. Takes the person photo (base64 data
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
  let o;
  try {
    o = getOrder(req.params.id);
    if (o.state !== 'awaiting_approval' && o.state !== 'try_on_ready' && o.state !== 'approved') {
      return res.status(409).json({ error: `Cannot poll in state ${o.state}`, order: orderView(o) });
    }
    const status = o.restMode
      ? await prava.pollRestSession({ sessionId: o.paymentSessionId })
      : await prava.pollPaymentSession({ sessionId: o.paymentSessionId });
    if (status.status === 'completed' || status.status === 'credential_ready') {
      o.state = status.status === 'credential_ready' ? 'credential_ready' : 'approved';
      // Store the single-use tokenized credentials so checkout can use them.
      o.token = status.token || null;
      o.cryptogram = status.cryptogram || null;
      o.expiryMonth = status.expiryMonth || null;
      o.expiryYear = status.expiryYear || null;
      // REST sessions carry a txn_ref_id needed to report the charge outcome.
      o.txnRefId = status.txnRefId || null;
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    } else if (status.status === 'failed') {
      o.state = 'failed';
      o.failure = status.error || null;
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    }
    const fixtureApproved = !o.restMode && prava.selfCheck() && o.state === 'approved';
    res.json({
      state: fixtureApproved ? 'self_check_approved' : o.state,
      paymentStatus: fixtureApproved ? 'self_check_completed' : status.status,
      order: orderView(o),
    });
  } catch (e) {
    const definitive = e.code === 'incomplete_credential_response'
      || (e.status >= 400 && e.status < 500 && ![408, 425, 429].includes(e.status));
    if (o && definitive) {
      o.state = 'failed';
      o.failure = failureView(e);
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    }
    next(e);
  }
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
    if (o.restMode) {
      return res.status(400).json({
        error: 'Sandbox REST order: enter your test card via the payment_url, then use /poll to detect approval.',
      });
    }
    o.state = 'approved';
    o.updatedAt = Date.now();
    orders.set(o.id, o);
    res.json({ state: 'self_check_approved', order: orderView(o) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// ── POST /prava/order/:id/checkout — place the real order ───────────
// Requires the payment session to be approved first.
router.post('/order/:id/checkout', async (req, res, next) => {
  let o;
  try {
    o = getOrder(req.params.id);
    if (o.restMode && o.state !== 'credential_ready') {
      return res.status(409).json({
        error: `REST order must have a credential before checkout (state=${o.state}).`,
        code: 'CREDENTIAL_NOT_READY',
        order: orderView(o),
      });
    }
    if (!o.restMode && o.state !== 'approved') {
      return res.status(409).json({
        error: `Order must be approved before checkout (state=${o.state}). POST /prava/order/:id/poll first.`,
        order: orderView(o),
      });
    }
    o.state = 'checking_out';
    o.updatedAt = Date.now();
    orders.set(o.id, o);

    let result;
    try {
      result = await prava.shopCheckout({
        checkoutSessionId: o.checkoutSessionId,
        token: o.token,
        cryptogram: o.cryptogram,
        expiryMonth: o.expiryMonth,
        expiryYear: o.expiryYear,
      });
    } catch (e) {
      if (o.restMode && e.context?.processorDeclined) {
        const reported = await prava.reportRestSession({
          sessionId: o.paymentSessionId,
          txnRefId: o.txnRefId,
          status: 'DECLINED',
          responseCode: e.context.responseCode || undefined,
        });
        o.state = 'sandbox_declined';
        o.failure = {
          code: 'EXPECTED_SANDBOX_DECLINE',
          message: 'The end merchant declined the sandbox/test credential as expected.',
          status: null,
          details: null,
          responseId: null,
        };
        o.updatedAt = Date.now();
        orders.set(o.id, o);
        return res.json({ state: o.state, order: orderView(o), result: reported });
      }
      throw e;
    }

    if (result.status === 'completed' && result.order_id) {
      if (o.restMode) {
        const reported = await prava.reportRestSession({
          sessionId: o.paymentSessionId,
          txnRefId: o.txnRefId,
          status: 'APPROVED',
          orderId: result.order_id,
          authorizationCode: result.authorization_code,
          responseCode: result.response_code,
        });
        o.state = 'sandbox_completed';
        o.sandboxOrderId = result.order_id;
        o.updatedAt = Date.now();
        orders.set(o.id, o);
        return res.json({ state: o.state, order: orderView(o), result: reported });
      }
      o.state = result.sandbox
        ? 'sandbox_completed'
        : result.self_check
          ? 'self_check_completed'
          : 'confirmed';
      if (result.sandbox) o.sandboxOrderId = result.order_id;
      else if (result.self_check) o.selfCheckOrderId = result.order_id;
      else o.orderIdPrava = result.order_id;
      o.updatedAt = Date.now();
      orders.set(o.id, o);
      logger.info(result.sandbox
        ? 'Prava sandbox lifecycle completed'
        : result.self_check
          ? 'Prava self-check fixture completed'
          : 'Prava order confirmed', {
        component: 'prava-facade', orderId: o.id, pravaOrder: result.order_id,
        amount: result.amount, sandbox: !!result.sandbox, selfCheck: !!result.self_check,
      });
      return res.json({ state: o.state, order: orderView(o), result });
    }
    const explicitlyFailed = result.status === 'failed';
    o.state = explicitlyFailed ? 'failed' : 'checkout_unknown';
    o.failure = {
      code: explicitlyFailed ? 'CHECKOUT_FAILED' : 'CHECKOUT_OUTCOME_UNKNOWN',
      message: explicitlyFailed
        ? 'Prava reported that the merchant checkout failed.'
        : 'The merchant checkout returned no definitive outcome; do not retry automatically.',
      status: null,
      responseId: null,
    };
    o.updatedAt = Date.now();
    orders.set(o.id, o);
    return res.status(explicitlyFailed ? 502 : 202).json({ state: o.state, order: orderView(o), result });
  } catch (e) {
    if (o?.state === 'checking_out') {
      const ambiguous = e.code === 'cli_error'
        && (e.context?.killed || e.context?.code === 'ETIMEDOUT');
      o.state = ambiguous ? 'checkout_unknown' : 'failed';
      o.failure = failureView(e);
      o.updatedAt = Date.now();
      orders.set(o.id, o);
    }
    next(e);
  }
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
