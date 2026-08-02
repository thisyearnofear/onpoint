/**
 * Prava Client — transport layer for the agent checkout rail.
 *
 * Wraps Prava's agent buy-flow so OnPoint's backend (and the Linq iMessage
 * card) can drive a real purchase at a real fashion merchant without ever
 * touching raw card data.
 *
 * Two operating modes (mirrors the OKX facade's self-check / live pattern,
 * see ADR 0016 + ADR 0017):
 *
 *   • Self-check (default) — returns deterministic, correctly-shaped mock
 *     responses so the entire spine (search → quote → session → approval →
 *     checkout → order) is walkable and demoable before the `prava` CLI is
 *     installed / the agent is linked / production access is granted.
 *
 *   • Live — shells to the `prava` CLI (the fastest path to a real order;
 *     the CLI handles agent linking + passkey flow natively). The CLI is
 *     production-only with real cards (see docs/PRAVA-HACKATHON.md). The
 *     MCP-SDK path (`@modelcontextprotocol/sdk`) is the preferred production
 *     transport — credentials stay fully server-side — and can be swapped in
 *     behind this same interface. The buy-flow tool chain is identical:
 *     shop_search → shop_product → shop_quote → create_payment_session →
 *     get_payment_status → shop_checkout.
 *
 * Buy-flow (Prava MCP tools reference, docs.prava.space/mcp/tools):
 *   1. shop_search      → product listings (product_id, merchant)
 *   2. shop_product      → offers/variants (variant_id)
 *   3. shop_quote        → checkout_session_id + binding total
 *   4. create_payment_session → payment_url + session_id (user approves w/ passkey)
 *   5. get_payment_status     → pending | completed | failed
 *   6. shop_checkout          → { status, order_id, amount }  (places the real order)
 *
 * Env:
 *   PRAVA_CLI_PATH     — path to the `prava` binary (default: "prava" on PATH).
 *                       When unset OR the binary is not found, self-check mode is used.
 *   PRAVA_AGENT_LINKED — "1" asserts the agent is linked; gates live mode.
 *   PRAVA_MCP_URL      — (future) MCP endpoint for the SDK transport.
 *   PRAVA_MCP_TOKEN    — (future) bearer token for the MCP transport.
 */

const { execFile } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execFileAsync = promisify(execFile);

const CLI_PATH = process.env.PRAVA_CLI_PATH || 'prava';
const AGENT_LINKED = process.env.PRAVA_AGENT_LINKED === '1';

// ── REST sandbox transport (SDK/API integration path) ────────────────
// Per Prava docs, the CLI has NO sandbox host — agent-linked payments use
// real cards. Sandbox applies to the SDK/API path only. So when a REST key
// (sk_test_*) is configured, the payment steps (session → poll → checkout)
// run against Prava's REST sandbox, while discovery (search/product) can
// still use the CLI against production UCP (free, no payment).
const REST_SECRET = process.env.PRAVA_SECRET_KEY || '';
const REST_BASE = REST_SECRET.startsWith('sk_live_')
  ? (process.env.PRAVA_PRODUCTION_BASE || 'https://api.prava.space')
  : (process.env.PRAVA_SANDBOX_BASE || 'https://sandbox.api.prava.space');

/** True when the REST sandbox/live transport is configured (key present). */
function restMode() {
  return !!REST_SECRET;
}

async function restCall(method, path, body) {
  const r = await fetch(REST_BASE + path, {
    method,
    headers: { Authorization: 'Bearer ' + REST_SECRET, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    throw new PravaError('rest_error', `Prava REST ${method} ${path} failed ${r.status}: ${text}`, { status: r.status });
  }
  return json;
}

// ── Mode detection ───────────────────────────────────────────────────
// Live mode requires the CLI to be resolvable AND the agent to be linked.
// We probe lazily on first use rather than at import time so a missing CLI
// never crashes the server (matches the OKX facade's graceful no-creds path).
let _cliAvailable = null;

async function cliAvailable() {
  if (_cliAvailable !== null) return _cliAvailable;
  if (!AGENT_LINKED) {
    _cliAvailable = false;
    return false;
  }
  try {
    await execFileAsync(CLI_PATH, ['--version'], { timeout: 5000 });
    _cliAvailable = true;
  } catch {
    _cliAvailable = false;
    logger.warn(
      'prava CLI not resolvable or agent not linked — Prava client running in self-check mode. Set PRAVA_CLI_PATH + PRAVA_AGENT_LINKED=1 (and run `prava setup`) for live orders.',
      { component: 'prava-client' },
    );
  }
  return _cliAvailable;
}

function selfCheck() {
  // Safe default: undetermined (null) means self-check, not live.
  return _cliAvailable !== true;
}

// ── Live: shell to the prava CLI with --json ─────────────────────────
async function runCli(args, { timeoutMs = 60000 } = {}) {
  try {
    const { stdout } = await execFileAsync(CLI_PATH, args, {
      timeout: timeoutMs,
      maxBuffer: 4 * 1024 * 1024,
    });
    // CLI may print human lines before the JSON block; parse the last
    // {...} or [...] JSON object on stdout.
    const text = stdout.trim();
    try {
      return JSON.parse(text);
    } catch {
      const match = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])\s*$/);
      if (match) return JSON.parse(match[1]);
      return { raw: text };
    }
  } catch (err) {
    const code = err.code === 1 || err.code ? err.code : null;
    // Exit code 2 = not linked; surface distinctly.
    if (code === 2) {
      throw new PravaError('not_linked', 'Prava agent not linked. Run `prava setup --name "<name>"`.');
    }
    throw new PravaError('cli_error', `prava CLI failed: ${err.message}`, { code, stderr: err.stderr });
  }
}

class PravaError extends Error {
  constructor(code, message, context = {}) {
    super(message);
    this.name = 'PravaError';
    this.code = code;
    this.context = context;
  }
}

// ── Self-check fixtures (shaped like real CLI --json output) ──────────
const FIXTURE = {
  search: (query) => ({
    query,
    results: [
      {
        product_id: 'prod_fixture_alo',
        title: 'Alo Yoga — 7/8 High-Waist Legging',
        price_estimate: '$98.00 USD',
        merchant: 'aloyoga.com',
        image: 'https://images.aloyoga.com/is/image/aloyoga/legging.jpg',
      },
      {
        product_id: 'prod_fixture_everlane',
        title: 'Everlane — The Silk Tee',
        price_estimate: '$50.00 USD',
        merchant: 'everlane.com',
        image: 'https://images.everlane.com/silk-tee.jpg',
      },
    ],
  }),
  product: (productId, merchant) => ({
    product_id: productId,
    merchant,
    offers: [
      {
        variant_id: 'var_fixture_' + productId.slice(-4),
        description: 'Size M · Black',
        unit_price: productId.includes('everlane') ? '50.00' : '98.00',
        currency: 'USD',
        available: true,
      },
    ],
  }),
  quote: (variantId, merchant, addressId) => {
    const subtotal = variantId.includes('ever') ? 50 : 98;
    const shipping = 5;
    const tax = Math.round((subtotal + shipping) * 0.08 * 100) / 100;
    return {
      checkout_session_id: 'ches_fixture_' + Math.random().toString(36).slice(2, 10),
      merchant,
      subtotal: subtotal.toFixed(2),
      shipping: shipping.toFixed(2),
      tax: tax.toFixed(2),
      total: (subtotal + shipping + tax).toFixed(2),
      currency: 'USD',
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      address_id: addressId || 'addr_home1',
    };
  },
  paymentSession: (total, currency, merchant) => ({
    session_id: 'ses_fixture_' + Math.random().toString(36).slice(2, 10),
    payment_url: 'https://collect.prava.space?session=ses_fixture_demo',
    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    merchant,
    total_amount: total,
    currency,
    replayed: false,
  }),
  // poll: self-check approves immediately and returns fake single-use creds,
  // shaped like the real CLI's Token/Cryptogram/Expiry output.
  poll: (sessionId) => ({
    session_id: sessionId,
    status: 'completed',
    token: '4323126882557932',
    cryptogram: '957',
    expiryMonth: '12',
    expiryYear: '2028',
  }),
  checkout: (checkoutSessionId) => ({
    status: 'completed',
    order_id: 'ord_fixture_' + Math.random().toString(36).slice(2, 10),
    amount: '108.84',
    currency: 'USD',
    checkout_session_id: checkoutSessionId,
  }),
};

// ── Normalizers: map real CLI JSON → canonical facade shape ──────────
// The live `@prava-sdk/cli` returns fields named/shaped differently from the
// self-check fixtures. These normalize the live output so every caller (the
// facade, the iMessage card, the activity feed) sees one consistent shape:
//   search result → { product_id, title, merchant, image, price_estimate, price }
//   product       → { product_id, merchant, description, image, offers[] }
//   offer         → { variant_id, description, unit_price, currency, available }

/** Normalize a price that may be a string ("$98.00 USD") or object
 *  ({ amount, currency }) into { amount, currency, display }. */
function normPrice(raw, fallbackCurrency = 'USD') {
  if (raw == null) return { amount: null, currency: fallbackCurrency, display: null };
  if (typeof raw === 'object') {
    const amount = raw.amount != null ? String(raw.amount) : null;
    const currency = raw.currency || fallbackCurrency;
    return { amount, currency, display: amount ? `$${amount} ${currency}` : null };
  }
  // String like "$98.00 USD".
  const s = String(raw);
  const m = s.match(/([\d,]+(?:\.\d+)?)/);
  const amt = m ? m[1].replace(/,/g, '') : null;
  const cur = (s.match(/[A-Z]{3}/) || [fallbackCurrency])[0];
  return { amount: amt, currency: cur, display: s };
}

function normSearchResult(r) {
  const price = normPrice(r.price_estimate);
  return {
    product_id: r.product_id || r.id || null,
    title: r.title || null,
    merchant: r.merchant || r.merchantDomain || null,
    // Live uses image_url; fixtures use image.
    image: r.image || r.image_url || (Array.isArray(r.images) && r.images[0]) || null,
    price_estimate: price.display,
    price,
  };
}

function normOffer(v, productImage) {
  return {
    variant_id: v.variant_id || v.id || null,
    description: v.description || v.label || (Array.isArray(v.options) ? v.options.join(' · ') : null) || null,
    // Live uses priceAmount in integer cents; fixtures use unit_price as a decimal string.
    unit_price: v.unit_price != null
      ? String(v.unit_price)
      : (v.priceAmount != null ? (Number(v.priceAmount) / 100).toFixed(2) : null),
    currency: v.currency || 'USD',
    available: v.available !== false,
    image: v.image || productImage || null,
  };
}

function normProduct(raw, productId, merchant) {
  const p = raw?.product || raw || {};
  const productImage = (Array.isArray(p.images) && p.images[0]) || p.image || null;
  const variants = p.variants || raw?.variants || raw?.offers || [];
  return {
    product_id: p.id || productId || null,
    merchant: p.merchant || merchant || null,
    description: p.description || null,
    image: productImage,
    offers: variants.map((v) => normOffer(v, productImage)),
    raw,
  };
}

// ── Public buy-flow API (transport-agnostic) ─────────────────────────

/** shop_search — discover products across UCP fashion merchants.
 *  `intent` carries the user's full natural-language ask (occasion, budget,
 *  vibe) to UCP for better ranking — pass it whenever it's available. */
async function shopSearch({ query, intent, merchant, limit } = {}) {
  if (await cliAvailable()) {
    const args = ['shop', 'search', '--query', query, '--json'];
    if (intent) args.push('--intent', intent);
    if (merchant) args.push('--merchant', merchant);
    if (limit) args.push('--limit', String(limit));
    const r = await runCli(args);
    return { ...r, results: (r.results || []).map(normSearchResult) };
  }
  return FIXTURE.search(query);
}

/** shop_product — get offers/variants for one product. */
async function shopProduct({ productId, merchant } = {}) {
  if (await cliAvailable()) {
    const args = ['shop', 'product', '--product-id', productId, '--json'];
    if (merchant) args.push('--merchant', merchant);
    const raw = await runCli(args);
    return normProduct(raw, productId, merchant);
  }
  return FIXTURE.product(productId, merchant);
}

/** shop_quote — lock a live binding total; returns checkout_session_id. */
async function shopQuote({ variantId, merchant, quantity, addressId } = {}) {
  if (await cliAvailable()) {
    const args = [
      'shop', 'quote', '--variant-id', variantId, '--merchant', merchant, '--yes', '--json',
    ];
    if (quantity) args.push('--quantity', String(quantity));
    if (addressId) args.push('--address-id', addressId);
    return runCli(args, { timeoutMs: 90000 });
  }
  return FIXTURE.quote(variantId, merchant, addressId);
}

/** create_payment_session — authorize payment; returns payment_url for passkey approval. Charges nothing. */
async function createPaymentSession({ totalAmount, currency, merchantName, merchantUrl, merchantCountry, products } = {}) {
  if (await cliAvailable()) {
    const args = [
      'sessions', 'create',
      '--total-amount', String(totalAmount),
      '--currency', currency,
      '--merchant-name', merchantName,
      '--merchant-url', merchantUrl,
      '--merchant-country', merchantCountry,
    ];
    for (const p of products || []) {
      args.push('--product', JSON.stringify(p));
    }
    return runCli(args);
  }
  return FIXTURE.paymentSession(totalAmount, currency, merchantName);
}

/** poll_payment_session — wait for the owner to approve the payment session
 *  and return the single-use tokenized card credentials.
 *
 *  Real CLI: `prava sessions poll --session-id S` blocks (up to ~10 min) while
 *  the owner approves in the browser, then returns a Visa network Token, a
 *  one-time Cryptogram (dynamic CVV), and an Expiry (MM/YYYY). Those creds are
 *  what `shop_checkout` needs to actually place the order — nothing leaves
 *  Prava except single-use, merchant-bound credentials.
 *
 *  Returns { session_id, status, token?, cryptogram?, expiryMonth?, expiryYear? }.
 *  `status` is 'completed' once creds are available, 'pending' otherwise. */
async function pollPaymentSession({ sessionId, timeoutMs = 620000 } = {}) {
  if (await cliAvailable()) {
    try {
      const r = await runCli(['sessions', 'poll', '--session-id', sessionId], { timeoutMs });
      if (r && r.token) {
        const [mm, yyyy] = String(r.expiry || '').split('/');
        return {
          session_id: sessionId,
          status: 'completed',
          token: String(r.token),
          cryptogram: String(r.cryptogram),
          expiryMonth: mm || undefined,
          expiryYear: yyyy || undefined,
        };
      }
      return { session_id: sessionId, status: 'pending' };
    } catch (e) {
      if (e.code === 'not_linked') throw e;
      return { session_id: sessionId, status: 'pending' };
    }
  }
  return FIXTURE.poll(sessionId);
}

/** shop_checkout — place the real order against a quoted session using the
 *  single-use credentials obtained from poll_payment_session.
 *
 *  Real CLI: `prava shop checkout --checkout-session-id CS --token T
 *  --cryptogram C --expiry-month MM --expiry-year YYYY --yes`. On success it
 *  prints "✓ Paid" + an order id. The wallet binds the charge to the quoted
 *  amount, so no amount is passed here. */
async function shopCheckout({ checkoutSessionId, token, cryptogram, expiryMonth, expiryYear } = {}) {
  if (await cliAvailable()) {
    const args = ['shop', 'checkout', '--checkout-session-id', checkoutSessionId];
    if (token) args.push('--token', token);
    if (cryptogram) args.push('--cryptogram', cryptogram);
    if (expiryMonth) args.push('--expiry-month', String(expiryMonth));
    if (expiryYear) args.push('--expiry-year', String(expiryYear));
    args.push('--yes', '--json');
    return runCli(args, { timeoutMs: 120000 });
  }
  return FIXTURE.checkout(checkoutSessionId);
}

/** shop_list_addresses — masked delivery addresses on the owner's account. */
async function shopListAddresses() {
  if (await cliAvailable()) {
    return runCli(['shop', 'address', 'list', '--json']);
  }
  return {
    addresses: [
      { id: 'addr_home1', label: 'Home', summary: 'San Francisco, CA 94103, US', default: true },
    ],
    phone_on_file: true,
  };
}

// ── REST sandbox payment transport ───────────────────────────────────
// These drive Prava's SDK/API payment path (the only path with a sandbox).
// Used by the facade when restMode() is true. Return shapes are normalizedized
// to match the CLI-path counterparts so the facade can treat them alike.

/** Humanize a merchant identifier/domain into a Visa-safe display name.
 *
 *  UCP discovery hands us merchants as bare domains (e.g.
 *  `eliteelevensporting.com`). Prava forwards `merchant_details.name` to Visa
 *  as the merchant of record and renders it as the checkout header, so a raw
 *  domain is wrong — it must be a readable name. This turns a domain into a
 *  title-cased display name:
 *    eliteelevensporting.com → "Elite Eleven Sporting"
 *    alo-yoga.com            → "Alo Yoga"
 *
 *  Idempotent: running it on an already-humanized name is a no-op, so callers
 *  can apply it defensively. Falls back to the raw input if nothing usable is
 *  produced. */
function humanizeMerchant(raw) {
  const s = String(raw || '').trim();
  if (!s) return s;
  let base = s
    .replace(/^https?:\/\//i, '') // strip scheme
    .replace(/\/.*$/, '')         // strip path
    .replace(/\.(com|net|org|io|co|shop|store|us|uk|ca|au)$/i, '') // strip common TLD
    .replace(/^www\./i, '');      // strip www
  // Split camelCase runs, then break on any non-alphanumeric separator.
  base = base
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  // Prava sanitizes to a Visa-safe set anyway; keep it conservative here.
  base = base.replace(/[^A-Za-z0-9 &.'-]/g, '').trim();
  return base || String(raw);
}

// Fashion/apparel merchant category (MCC 5691) — every UCP merchant we
// discover is a clothing brand. Prava's provisioning/lookup keys on this, and
// the spec example bodies omit it to their detriment.
const FASHION_MCC = '5691';
const FASHION_CATEGORY = "Men's and Women's Clothing Stores";

/** create_rest_session — open a hosted payment session. Returns a payment_url
 *  (the Prava-hosted card-entry iframe URL) the owner opens to enter their
 *  (test) card + passkey. Charges nothing. Mirrors createPaymentSession's
 *  return shape: { session_id, payment_url, ... }. */
async function createRestSession({ totalAmount, currency = 'USD', merchantName, merchantUrl, merchantCountry, products, cardId } = {}) {
  const displayName = humanizeMerchant(merchantName);
  const productList = (products || []).map((p) => ({
    description: p.description,
    unit_price: String(p.unit_price),
    quantity: p.quantity || 1,
  }));
  const body = {
    user_id: 'onpoint_agent',
    user_email: 'agent@onpoint.famile.xyz',
    total_amount: String(totalAmount),
    currency,
    description: `${displayName} order via OnPoint`,
    integration_type: 'full_checkout',
    callback_url: process.env.PUBLIC_BASE_URL || 'https://beonpoint.netlify.app/agent',
    purchase_context: [{
      merchant_details: {
        name: displayName,
        url: merchantUrl,
        country_code_iso2: merchantCountry,
        category_code: FASHION_MCC,
        category: FASHION_CATEGORY,
      },
      product_details: productList,
    }],
  };
  // Pre-select an already-enrolled card (from /v1/listCards). This skips the
  // addCard/provisioning step in the hosted surface and goes straight to
  // passkey verification. Per the create-session spec, send card_id OR
  // vault_ref_id — card_id wins if both are present.
  if (cardId) body.card = { card_id: cardId };
  const r = await restCall('POST', '/v1/sessions', body);
  return {
    session_id: r.session_id,
    payment_url: r.iframe_url,
    session_token: r.session_token,
    order_id: r.order_id,
    expires_at: r.expires_at,
  };
}

/** poll_rest_session — check whether the cardholder has completed card entry
 *  + passkey. When ready, the line item carries a one-time token + dynamic_cvv
 *  (the sandbox equivalent of the CLI's Token/Cryptogram). Normalized to the
 *  same shape as pollPaymentSession. */
async function pollRestSession({ sessionId } = {}) {
  const r = await restCall('GET', '/v1/sessions/' + sessionId + '/payment-result');
  if (r.status === 'failed') return { session_id: sessionId, status: 'failed' };
  const li = r.transactions?.[0]?.line_items?.[0];
  if (li && li.token) {
    return {
      session_id: sessionId,
      status: 'completed',
      token: String(li.token),
      cryptogram: String(li.dynamic_cvv),
      expiryMonth: li.expiry_month ? String(li.expiry_month) : undefined,
      expiryYear: li.expiry_year ? String(li.expiry_year) : undefined,
      txnRefId: li.txn_ref_id,
    };
  }
  return { session_id: sessionId, status: 'pending' };
}

/** report_rest_session — close the loop by reporting the charge outcome. In
 *  sandbox this flips the session to completed (APPROVED) or failed (DECLINED).
 *  Returns { status, order_id }. */
async function reportRestSession({ sessionId, txnRefId, status, orderId } = {}) {
  const approved = status === 'APPROVED';
  await restCall('POST', '/v1/sessions/' + sessionId + '/report-status', {
    txn_ref_id: txnRefId,
    txn_status: status,
    txn_type: 'PURCHASE',
    // Spec examples canonically include a processor response/authorization
    // code; "00" = approved, "05" = declined. OnPoint is the reporting party.
    response_code: approved ? '00' : '05',
    authorization_code: approved
      ? 'OK' + Math.random().toString(36).slice(2, 8).toUpperCase()
      : undefined,
  });
  return {
    status: approved ? 'completed' : 'failed',
    order_id: approved ? (orderId || sessionId) : null,
  };
}

module.exports = {
  shopSearch,
  shopProduct,
  shopQuote,
  createPaymentSession,
  pollPaymentSession,
  // Back-compat alias for older callers.
  getPaymentStatus: pollPaymentSession,
  shopCheckout,
  shopListAddresses,
  // REST sandbox transport.
  restMode,
  createRestSession,
  pollRestSession,
  reportRestSession,
  humanizeMerchant,
  cliAvailable,
  selfCheck,
  PravaError,
};
