/**
 * Prava Card Route — GET /prava/card/:orderId
 *
 * The iMessage App card rendered inside the blue bubble. This is the hero
 * artifact of the demo (ADR 0017, Linq iMessage Agent track). It is a
 * server-rendered, self-updating HTML page that reflects the live order
 * state from the /prava facade and mutates through:
 *
 *   look → searching → quote+fit → permission → observed outcome
 *
 * Linq renders this URL inside the iMessage App part; in-place updates are
 * driven by PATCH /v3/messages (see lib/linq-client.js) and the card also
 * polls its own order state so it stays correct if re-rendered.
 *
 * Public (no service key) — it's the card content Linq fetches. The order
 * id is unguessable (UUID) and the public card payload carries no credential
 * data; credentials returned by REST remain server-side.
 */

const express = require('express');
const logger = require('../lib/logger');
const prava = require('../lib/prava-client');

const router = express.Router();

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');

function stateLabel(state) {
  return ({
    searching: 'Finding your fit',
    quoted: 'Quote ready',
    try_on_ready: 'Fit checked · quote ready',
    creating_session: 'Requesting permission',
    awaiting_approval: 'Awaiting your passkey',
    approved: 'Approved',
    credential_ready: 'Test credential ready',
    checking_out: 'Placing order',
    checkout_unknown: 'Checkout outcome unknown',
    confirmed: '✓ Order placed',
    sandbox_completed: '✓ Sandbox completed',
    self_check_completed: '✓ Self-check completed',
    failed: 'Checkout failed',
  })[state] || state;
}

function stateColor(state) {
  if (state === 'confirmed' || state === 'sandbox_completed') return '#1a7f37';
  if (state === 'failed') return '#d1242f';
  if (state === 'credential_ready' || state === 'checkout_unknown') return '#9a6700';
  if (state === 'awaiting_approval' || state === 'approved' || state === 'checking_out') return '#0a66c2';
  return '#6e6e73';
}

// Render the order state from the facade's in-memory store directly (same
// process), so the card is correct on first paint without a round-trip.
function renderCard(orderId, order) {
  const state = order?.state || 'searching';
  const merchant = order?.merchant?.name;
  const total = order?.totalAmount;
  const currency = order?.currency || 'USD';
  const ceiling = order?.trust?.spendCeilingUsd;
  const pravaOrder = order?.orderIdPrava;
  const sandboxOrder = order?.sandboxOrderId;
  const selfCheckOrder = order?.selfCheckOrderId;
  const paymentUrl = order?.paymentUrl;
  const color = stateColor(state);

  const trustBlock = total ? `
    <div class="trust">
      <div class="row"><span>Requested ceiling</span><b>$${ceiling} ${currency}</b></div>
      <div class="row"><span>Merchant requested</span><b>${merchant}</b></div>
      <div class="row"><span>${state === 'credential_ready' ? 'Observed credential' : 'If issued'}</span><b>${state === 'credential_ready' ? 'single-use, scoped, server-held' : 'single-use, merchant-scoped'}</b></div>
      <div class="row"><span>Required step</span><b>${order?.selfCheck ? 'fixture only' : order?.restMode ? 'hosted card/device verification' : 'passkey on your device'}</b></div>
    </div>` : '';

  // Pre-checkout try-on render.
  const tryOnBlock = order?.tryOnUrl ? `
    <div class="tryon">
      <img src="${order.tryOnUrl}" alt="Try-on render"/>
      <div class="tryon-cap">How it looks on you · IDM-VTON</div>
    </div>` : '';

  const paymentBlock = ((state === 'awaiting_approval' || state === 'try_on_ready') && paymentUrl) ? `
    <a class="pay" href="${paymentUrl}">${order?.restMode ? 'Open Prava test-card flow' : order?.selfCheck ? 'Open self-check fixture' : 'Approve with passkey'} →</a>` : '';

  const confirmedBlock = state === 'confirmed' && pravaOrder ? `
    <div class="confirmed">
      <div class="orderno">Prava order ${pravaOrder}</div>
    </div>` : '';

  const sandboxBlock = state === 'sandbox_completed' ? `
    <div class="confirmed">
      <div class="orderno">Prava sandbox lifecycle completed</div>
      <div class="sub">Test credential issued and outcome reported. No merchant charge.</div>
      ${sandboxOrder ? `<div class="sub">Sandbox order ${sandboxOrder}</div>` : ''}
    </div>` : '';

  const selfCheckBlock = state === 'self_check_completed' ? `
    <div class="confirmed">
      <div class="orderno" style="color:#6e6e73">Self-check completed</div>
      <div class="sub">Deterministic fixture only. No credential, payment, or merchant order.</div>
      ${selfCheckOrder ? `<div class="sub">Fixture ${selfCheckOrder}</div>` : ''}
    </div>` : '';

  const credentialReadyBlock = state === 'credential_ready' ? `
    <div class="confirmed">
      <div class="orderno" style="color:#9a6700">Sandbox credential ready</div>
      <div class="sub">External checkout and a real processor outcome are required before report-status. No merchant order or charge is claimed.</div>
    </div>` : '';

  const checkoutUnknownBlock = state === 'checkout_unknown' ? `
    <div class="confirmed">
      <div class="orderno" style="color:#9a6700">Checkout outcome unknown</div>
      <div class="sub">The automation attempt timed out. OnPoint stopped, did not retry, and reported no processor status. No merchant order or charge is claimed.</div>
    </div>` : '';

  const title = order?.selfCheck
    ? 'Orchestration self-check'
    : state === 'quoted'
    ? 'Your binding quote is ready'
    : state === 'try_on_ready'
    ? 'Fit checked. Permission is next.'
    : state === 'confirmed'
    ? 'Your stylist bought it for you'
    : state === 'sandbox_completed'
      ? 'Sandbox lifecycle completed'
      : state === 'self_check_completed'
        ? 'Orchestration self-check'
      : 'Your stylist is finishing the job';
  const priceNote = order?.selfCheck
    ? 'deterministic fixture amount'
    : order?.restMode
    ? 'incl. shipping &amp; tax · binding quote'
    : 'incl. shipping &amp; tax · binding quote';
  const footer = state === 'confirmed'
    ? 'Paid via Prava · scoped card · network-level controls'
    : state === 'sandbox_completed'
      ? 'Prava sandbox · test lifecycle · no real charge'
      : state === 'self_check_completed'
        ? 'Self-check fixture · no transaction'
        : state === 'quoted' || state === 'try_on_ready'
          ? 'Binding quote · permission not requested'
          : 'Prava session requested · user approval required';

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1"/>
<title>OnPoint × Prava</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif;
    background: #f5f5f7; color: #1d1d1f; -webkit-font-smoothing: antialiased;
  }
  .card {
    max-width: 360px; margin: 0 auto; background: #fff; border-radius: 18px;
    overflow: hidden; box-shadow: 0 1px 4px rgba(0,0,0,.08);
  }
  .hero {
    background: linear-gradient(135deg, #0a66c2, #5b2c9e);
    color: #fff; padding: 18px 20px;
  }
  .brand { font-size: 13px; letter-spacing: .04em; opacity: .85; text-transform: uppercase; }
  .title { font-size: 20px; font-weight: 650; margin-top: 4px; }
  .state {
    display: inline-flex; align-items: center; gap: 7px; margin-top: 12px;
    font-size: 13px; font-weight: 600; color: ${color};
    background: ${color}14; padding: 5px 11px; border-radius: 999px;
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; background: ${color}; }
  .dot.pulse { animation: p 1.2s ease-in-out infinite; }
  @keyframes p { 0%,100%{opacity:.35} 50%{opacity:1} }
  .body { padding: 16px 20px 20px; }
  .merchant { font-size: 15px; font-weight: 600; }
  .total { font-size: 28px; font-weight: 700; margin-top: 2px; }
  .sub { font-size: 12px; color: #6e6e73; margin-top: 2px; }
  .trust { margin-top: 14px; border-top: 1px solid #f0f0f2; padding-top: 12px; }
  .trust .row { display: flex; justify-content: space-between; font-size: 12.5px; margin: 6px 0; }
  .trust .row span { color: #6e6e73; }
  .trust .row b { font-weight: 600; }
  .pay {
    display: block; text-align: center; margin-top: 16px; padding: 13px;
    background: #0a66c2; color: #fff; text-decoration: none; border-radius: 13px;
    font-size: 15px; font-weight: 600;
  }
  .confirmed { margin-top: 16px; text-align: center; }
  .orderno { font-size: 13px; color: #1a7f37; font-weight: 700; }
  .footer { font-size: 11px; color: #a1a1a6; text-align: center; padding: 0 20px 18px; }
  .tryon { margin-top: 14px; }
  .tryon img { width: 100%; border-radius: 13px; display: block; background: #f0f0f2; }
  .tryon-cap { font-size: 11px; color: #6e6e73; text-align: center; margin-top: 5px; }
  .skeleton { display: ${merchant ? 'none' : 'block'}; }
</style></head>
<body>
  <div class="card">
    <div class="hero">
      <div class="brand">OnPoint · Agent Outfitter</div>
      <div class="title">${title}</div>
      <div class="state"><span class="dot ${state==='awaiting_approval'||state==='checking_out'||state==='searching'?'pulse':''}"></span>${stateLabel(state)}</div>
    </div>
    <div class="body">
      <div class="skeleton">
        <div class="merchant" style="color:#a1a1a6">Composing your look…</div>
      </div>
      ${merchant ? `<div class="merchant">${merchant}</div><div class="total">$${total} ${currency}</div><div class="sub">${priceNote}</div>` : ''}
      ${tryOnBlock}
      ${trustBlock}
      ${paymentBlock}
      ${confirmedBlock}
      ${sandboxBlock}
      ${selfCheckBlock}
      ${credentialReadyBlock}
  ${checkoutUnknownBlock}
    </div>
    <div class="footer">${footer}</div>
  </div>
  <script>
    // Re-render from the live order state if the card is re-opened.
    (async () => {
      try {
        const r = await fetch("${PUBLIC_BASE}/prava/card/${orderId}/state");
        if (r.ok && (r.headers.get('content-type')||'').includes('json')) {
          const s = await r.json();
          if (s.state && s.state !== "${state}") location.reload();
        }
      } catch {}
    })();
  </script>
</body></html>`;
}

// ── GET /prava/card/:orderId/state — lightweight JSON for client poll ─
router.get('/:orderId/state', async (req, res) => {
  const order = await getOrderForCardAsync(req.params.orderId);
  res.json({
    state: order?.state || 'searching',
    merchant: order?.merchant?.name || null,
    totalAmount: order?.totalAmount || null,
    currency: order?.currency || 'USD',
    orderIdPrava: order?.orderIdPrava || null,
    sandboxOrderId: order?.sandboxOrderId || null,
    selfCheckOrderId: order?.selfCheckOrderId || null,
    paymentUrl: order?.paymentUrl || null,
    tryOnUrl: order?.tryOnUrl || null,
  });
});

// ── GET /prava/card/:orderId — the card HTML ─────────────────────────
// (Mounted at /prava/card, so the route path is /:orderId.)
router.get('/:orderId', async (req, res) => {
  // Prefer the Redis-backed accessor so a card reopened on another API
  // instance still reflects the order. It falls back to the local mirror.
  const order = await getOrderForCardAsync(req.params.orderId);
  res.set('Content-Type', 'text/html; charset=utf-8');
  res.send(renderCard(req.params.orderId, order));
});

// The order store lives in routes/prava-facade.js. Rather than duplicate it,
// we look it up via the facade's exported accessor if present, else return
// null (card renders in "searching" skeleton). This keeps the card correct on
// first paint in the same process without an HTTP hop.
function getOrderForCard(orderId) {
  const facade = require('./prava-facade');
  return typeof facade.getOrderForCard === 'function'
    ? facade.getOrderForCard(orderId)
    : null;
}

async function getOrderForCardAsync(orderId) {
  const facade = require('./prava-facade');
  if (typeof facade.getOrderForCardAsync === 'function') {
    return facade.getOrderForCardAsync(orderId);
  }
  return getOrderForCard(orderId);
}

module.exports = router;
module.exports.getOrderForCard = getOrderForCard;
