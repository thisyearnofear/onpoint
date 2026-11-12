#!/usr/bin/env node
/**
 * paypal-verify.mjs — independently verify a PayPal rail receipt against PayPal.
 *
 * Given an OnPoint receipt id (or URL) it pulls the public receipt, then
 * re-reads the order, the capture and the payout batch at PayPal itself and
 * reports whether each claim on the receipt holds.
 *
 * Order + capture are read through the APIMatic-generated PayPal TypeScript
 * SDK (package `paypal`, installed from
 * github:context-plugins/paypal-typescript-sdk — built under the APIMatic
 * Context Plugin; see paypal-plan.md for the contract sheet). The SDK's
 * surface does not include the Payouts API, so the payout batch is read over
 * REST via the app's existing helper.
 *
 * Usage:
 *   PAYPAL_CLIENT_ID=… PAYPAL_CLIENT_SECRET=… \
 *     node scripts/paypal-verify.mjs receipt_mwdr4vi4_66d38caf
 *   node scripts/paypal-verify.mjs https://onpoint.trustfall.xyz/receipt/<id>
 *
 * Env: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET (the app's own sandbox/live
 * creds — orders live under the app that created them), PAYPAL_ENV
 * (sandbox|live), API_BASE (default https://api.onpoint.famile.xyz).
 * Without credentials the receipt-side checks still run and the PayPal half
 * is skipped with a note.
 */

import { createRequire } from 'node:module';
import { PaypalClient } from 'paypal';

const require = createRequire(import.meta.url);
const paypalLib = require('../apps/api/lib/paypal-payments.js');

const API_BASE = (process.env.API_BASE || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`  ${ok === true ? '✓' : ok === null ? '–' : '✗'} ${name}${detail ? ` — ${detail}` : ''}`);
}
function fail(msg, code = 2) {
  console.error(`\n✗ ${msg}`);
  process.exit(code);
}

// ── args ────────────────────────────────────────────────────────────────
const arg = process.argv[2];
if (!arg) {
  console.log('usage: node scripts/paypal-verify.mjs <receiptId|receiptUrl>');
  process.exit(1);
}
const receiptId = arg.replace(/\/$/, '').split('/').pop();

// ── 1. public receipt (no credentials) ──────────────────────────────────
console.log(`\nReceipt ${receiptId}`);
const receiptRes = await fetch(`${API_BASE}/api/receipts/${receiptId}`);
if (!receiptRes.ok) fail(`receipt fetch: HTTP ${receiptRes.status}`);
const { receipt } = await receiptRes.json();
const pp = receipt?.metadata?.paypal || {};

check('receipt is public', true, `${API_BASE}/api/receipts/${receiptId}`);
check('rail is PayPal', receipt.metadata?.paymentMethod === 'paypal',
  `paymentMethod=${receipt.metadata?.paymentMethod}`);
check('txHash is the capture id', Boolean(receipt.txHash), receipt.txHash);

// Older receipts predate the metadata.paypal block — txHash is still the
// capture id, so the capture half can still be verified.
const orderId = pp.orderId;
const captureId = pp.captureId || (receipt.metadata?.paymentMethod === 'paypal' ? receipt.txHash : undefined);
const amountUsd = pp.amountUsd;
const payoutBatchId = pp.payoutBatchId;
console.log(`  order ${orderId || '—'} · capture ${captureId || '—'} · $${amountUsd ?? '—'} · payout ${payoutBatchId || '—'}`);

// ── 2. PayPal side (needs this app's credentials) ───────────────────────
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  check('PayPal re-read', null,
    'skipped — set PAYPAL_CLIENT_ID/SECRET for the app that created the order');
  process.exit(0);
}

const baseUrl =
  paypalLib.paypalEnv() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
const client = new PaypalClient({
  serverOptions: { baseUrl },
  oauth2: { clientId, clientSecret },
  retry: { timeout: 10_000 },
});

function sdkFail(err, what) {
  if (err && err.kind === 'api') {
    const reason = err.payload?.kind ? ` (${err.payload.kind})` : '';
    if (err.status === 401 || err.status === 403)
      fail(`${what}: credentials rejected by this app — check PAYPAL_CLIENT_ID/SECRET${reason}`);
    if (err.status === 404)
      fail(`${what}: not found under this PayPal app — the receipt may name a different merchant app`);
    fail(`${what}: HTTP ${err.status}${reason}`);
  }
  if (err && err.kind === 'auth') fail(`${what}: token request refused — bad credentials`);
  if (err && (err.kind === 'connection' || err.kind === 'timeout'))
    fail(`${what}: PayPal unreachable — outcome unknown, retry`);
  throw err;
}

// order (skipped when the receipt predates metadata.paypal)
let order;
if (!orderId) {
  check('order exists at PayPal', null, 'skipped — receipt records no order id');
} else {
  try {
    order = await client.orders.getOrder({ id: orderId });
  } catch (err) {
    sdkFail(err, 'getOrder');
  }
  check('order exists at PayPal', true, orderId);
  check('order status COMPLETED', order.status === 'COMPLETED', order.status);

  const captures = (order.purchaseUnits || []).flatMap((u) => u.payments?.captures || []);
  check('capture id bound inside the order', captures.some((c) => c.id === captureId),
    captures.map((c) => c.id).join(', ') || 'no captures on order');

  const customId = (order.purchaseUnits || []).map((u) => u.customId || u.referenceId).find(Boolean) || '';
  const listingId = receipt.metadata?.listingId || '';
  check('custom_id binds this order to the item',
    /^(tryon|order):/.test(customId) && (!listingId || customId.includes(listingId)),
    customId || 'none');
}

// capture
if (!captureId) {
  check('capture status COMPLETED', null, 'skipped — no capture id on receipt');
} else {
  let capture;
  try {
    capture = await client.payments.getCapturedPayment({ captureId });
  } catch (err) {
    sdkFail(err, 'getCapturedPayment');
  }
  check('capture status COMPLETED', capture.status === 'COMPLETED', capture.status);
  const paid = Number(capture.amount?.value);
  check('captured amount matches the receipt',
    capture.amount?.currencyCode === 'USD' && (amountUsd == null || Math.abs(paid - Number(amountUsd)) < 0.005),
    `${capture.amount?.value} ${capture.amount?.currencyCode}`);
}

// payout batch — REST: Payouts is outside the generated SDK surface
if (!payoutBatchId) {
  check('payout batch', null, 'receipt records no payout (pending reconciliation)');
} else {
  const token = await paypalLib.getAccessToken();
  const res = await fetch(`${paypalLib.paypalBaseUrl()}/v1/payments/payouts/${payoutBatchId}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) fail(`payout batch: HTTP ${res.status}`);
  const batch = await res.json();
  const item = batch.items?.[0];
  check('payout batch exists', true,
    `${batch.batch_header?.batch_status} · ${item?.transaction_status} · ${item?.payout_item?.amount?.value} ${item?.payout_item?.amount?.currency} → ${item?.payout_item?.receiver}`);
}

const failed = results.filter((r) => r.ok === false);
console.log(failed.length ? `\n✗ ${failed.length} check(s) failed` : '\n✓ receipt verified against PayPal');
process.exit(failed.length ? 1 : 0);
