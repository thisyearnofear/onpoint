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
  return _cliAvailable === false;
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
  paymentStatus: (sessionId) => ({
    // self-check: pretend the user approved after a short delay handled by the facade
    session_id: sessionId,
    status: 'completed',
  }),
  checkout: (checkoutSessionId, paymentSessionId) => ({
    status: 'completed',
    order_id: 'ord_fixture_' + Math.random().toString(36).slice(2, 10),
    amount: '108.84',
    currency: 'USD',
    checkout_session_id: checkoutSessionId,
    payment_session_id: paymentSessionId,
  }),
};

// ── Public buy-flow API (transport-agnostic) ─────────────────────────

/** shop_search — discover products across UCP fashion merchants. */
async function shopSearch({ query, merchant, limit } = {}) {
  if (await cliAvailable()) {
    const args = ['shop', 'search', '--query', query, '--json'];
    if (merchant) args.push('--merchant', merchant);
    if (limit) args.push('--limit', String(limit));
    return runCli(args);
  }
  return FIXTURE.search(query);
}

/** shop_product — get offers/variants for one product. */
async function shopProduct({ productId, merchant } = {}) {
  if (await cliAvailable()) {
    const args = ['shop', 'product', '--product-id', productId, '--json'];
    if (merchant) args.push('--merchant', merchant);
    return runCli(args);
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

/** get_payment_status — pending | completed | failed. Credentials never leave Prava. */
async function getPaymentStatus({ sessionId } = {}) {
  if (await cliAvailable()) {
    // The CLI surfaces this via `prava sessions poll`; for a non-blocking
    // status check the MCP `get_payment_status` tool is preferred. We poll
    // once with a short timeout and read the resulting status.
    try {
      const r = await runCli(['sessions', 'poll', '--session-id', sessionId], { timeoutMs: 15000 });
      return { session_id: sessionId, status: 'completed', ...r };
    } catch (e) {
      if (e.code === 'not_linked') throw e;
      return { session_id: sessionId, status: 'pending' };
    }
  }
  return FIXTURE.paymentStatus(sessionId);
}

/** shop_checkout — places the real order against an approved session + prior quote. */
async function shopCheckout({ checkoutSessionId, paymentSessionId } = {}) {
  if (await cliAvailable()) {
    // CLI path needs the token/cryptogram (from sessions poll); the MCP
    // path takes only the payment_session_id. For live mode here we drive
    // `prava shop checkout` which, when given an approved session, resolves
    // the credential server-side. Swapping to the MCP SDK makes this exact.
    return runCli([
      'shop', 'checkout',
      '--checkout-session-id', checkoutSessionId,
      '--payment-session-id', paymentSessionId,
      '--yes', '--json',
    ], { timeoutMs: 120000 });
  }
  return FIXTURE.checkout(checkoutSessionId, paymentSessionId);
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

module.exports = {
  shopSearch,
  shopProduct,
  shopQuote,
  createPaymentSession,
  getPaymentStatus,
  shopCheckout,
  shopListAddresses,
  cliAvailable,
  selfCheck,
  PravaError,
};
