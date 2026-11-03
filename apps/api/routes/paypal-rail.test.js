import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);

// Patch getDb BEFORE the routes destructure it (module registry is shared).
const dbModule = require('../lib/db');
let currentDb = null;
dbModule.getDb = () => {
  if (!currentDb) throw new Error('db not set');
  return currentDb;
};

const paypal = require('../lib/paypal-payments');
const tryonRouter = require('./agent-tryon');
const storefrontRouter = require('./curator-storefront');

// ── Fake drizzle ──
function q(result) {
  const node = {
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    limit: () => q(result),
    returning: () => q(result),
    onConflictDoNothing: () => q(result),
  };
  for (const m of ['from', 'innerJoin', 'leftJoin', 'where', 'orderBy', 'groupBy', 'values', 'set']) {
    node[m] = () => q(result);
  }
  return node;
}

function fakeDb({ selectResults = [], insertResult = [{ id: 'order-1' }], executeResult = { rows: [{ id: 'l-1' }] } } = {}) {
  let selectIdx = 0;
  return {
    select: () => q(selectResults[Math.min(selectIdx++, selectResults.length - 1)] ?? []),
    insert: () => q(insertResult),
    update: () => q([{ id: 'order-1' }]),
    execute: async () => executeResult,
  };
}

const WALLET = `0x${'1'.repeat(40)}`;
const LISTING_ROW = {
  listing: {
    id: 'l-1', curatorSlug: 'nia', status: 'live', inventoryType: 'physical',
    sizes: [{ size: 'M', stock: 2, price: 1000 }],
    photoKeys: ['k1'], title: 'Test Tee', tags: [],
    lastVerifiedAt: new Date().toISOString(),
  },
  curator: { slug: 'nia', name: 'Nia', type: 'human', commerce: { walletAddress: WALLET } },
  kit: { id: 'kit-1', club: 'Test FC', kitType: 'home', season: '2025', officialImageKey: 'k1' },
};

const CAPTURE = { status: 'COMPLETED', id: 'CAPTURE99', amount: { currency_code: 'USD', value: '7.69' } };

function paypalFetch({ orderStatus = 'APPROVED', captureStatus = 'COMPLETED', orderOverrides = {} } = {}) {
  return vi.fn(async (url, init = {}) => {
    if (url.includes('/v1/oauth2/token')) {
      return { ok: true, json: async () => ({ access_token: 'tok', expires_in: 3600 }) };
    }
    if (init.method === 'POST' && url.endsWith('/capture')) {
      return {
        ok: captureStatus === 'COMPLETED',
        status: captureStatus === 'COMPLETED' ? 200 : 500,
        json: async () => paypalOrder('COMPLETED'),
      };
    }
    if (init.method === 'POST' && url.endsWith('/v2/checkout/orders')) {
      return {
        ok: true,
        json: async () => ({
          id: 'ORDER123ABC',
          links: [{ rel: 'payer-action', href: 'https://paypal.example/approve/ORDER123ABC' }],
        }),
      };
    }
    if (url.includes('/v2/checkout/orders/')) {
      return { ok: true, json: async () => paypalOrder(orderStatus) };
    }
    throw new Error(`unexpected fetch ${url}`);
  });
}

function paypalOrder(status) {
  return {
    id: 'ORDER123ABC',
    status,
    payer: { payer_id: 'PAYER9', email_address: 'payer@example.com' },
    purchase_units: [
      {
        custom_id: 'order:nia:l-1:M:quote',
        amount: { currency_code: 'USD', value: '7.69' },
        payments: status === 'COMPLETED' ? { captures: [CAPTURE] } : { captures: [] },
      },
    ],
  };
}

function completedCaptureOrder() {
  const o = paypalOrder('COMPLETED');
  o.purchase_units[0].payments = { captures: [CAPTURE] };
  return o;
}

function app(router, mount) {
  const a = express();
  a.use(express.json());
  a.use(mount, router);
  return a;
}

async function post(a, path, body, headers = {}) {
  const { default: supertest } = await import('supertest');
  return supertest(a).post(path).set(headers).send(body);
}

const ENV = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV', 'NEAR_USD_PRICE', 'NEAR_PAYOUT_ACCOUNT', 'R2_PUBLIC_URL'];

describe('PayPal rail — order route', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    ENV.forEach((k) => delete process.env[k]);
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    paypal.__test.resetTokenCache();
    currentDb = null;
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    process.env = OLD_ENV;
    paypal.__test.resetTokenCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('rejects malformed or mixed payment proofs', async () => {
    const a = app(storefrontRouter, '/api/curator');
    const bad = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', paypalOrderId: 'not-an-order!' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/paypalOrderId/);

    const mixed = await post(a, '/api/curator/nia/order', {
      listingId: 'l-1', size: 'M',
      paypalOrderId: 'ORDER123ABC', paymentTxHash: `0x${'a'.repeat(64)}`,
    });
    expect(mixed.status).toBe(400);
    expect(mixed.body.error).toBe('Provide exactly one payment proof');
  });

  it('advertises the paypal rail in the 402 only when configured', async () => {
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    global.fetch = paypalFetch();
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', quantity: 1 });
    expect(res.status).toBe(402);
    expect(res.body.quote.paymentRails).toContain('paypal');
    expect(res.body.quote.paypal).toMatchObject({
      env: 'sandbox',
      orderId: 'ORDER123ABC',
      approveUrl: 'https://paypal.example/approve/ORDER123ABC',
      currency: 'USD',
    });
    // custom_id binds the order to this listing+size+quote
    const createCall = global.fetch.mock.calls.find(([u, i]) => i?.method === 'POST' && u.endsWith('/v2/checkout/orders'));
    expect(JSON.parse(createCall[1].body).purchase_units[0].custom_id).toMatch(/^order:nia:l-1:M:/);
  });

  it('omits the paypal rail when credentials are unset', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', quantity: 1 });
    expect(res.status).toBe(402);
    expect(res.body.quote.paymentRails).not.toContain('paypal');
    expect(res.body.quote.paypal).toBeUndefined();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('409s a paypalOrderId proof when the rail is not configured', async () => {
    delete process.env.PAYPAL_CLIENT_SECRET;
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_RAIL_UNAVAILABLE');
  });

  it('verifies, captures, and confirms a PayPal order (201, paymentMethod paypal)', async () => {
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    global.fetch = paypalFetch({ orderStatus: 'APPROVED' });
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', quantity: 1, paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(201);
    expect(res.body.order.payment).toMatchObject({
      txHash: 'CAPTURE99',
      explorerUrl: null,
      paymentMethod: 'paypal',
    });
    expect(res.body.order.payment.paypal).toMatchObject({ orderId: 'ORDER123ABC', captureId: 'CAPTURE99', env: 'sandbox' });
    expect(res.body.order.payout).toMatchObject({ status: 'pending_reconciliation', asset: 'USD' });
    // token → GET order → POST capture
    expect(global.fetch.mock.calls.some(([u]) => u.endsWith('/capture'))).toBe(true);
  });

  it('rejects a replayed capture id via the idempotent order path', async () => {
    const existingOrder = {
      id: 'order-1', curatorSlug: 'nia', listingId: 'l-1', size: 'M', quantity: 1,
      amountCusd: '7.69', status: 'confirmed', paymentTxHash: 'CAPTURE99', payoutTxHash: null,
    };
    currentDb = fakeDb({
      selectResults: [[LISTING_ROW], [existingOrder]],
      insertResult: [], // onConflictDoNothing → already claimed
    });
    // already COMPLETED — no new capture call should happen
    global.fetch = paypalFetch({ orderStatus: 'COMPLETED' });
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', quantity: 1, paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(200);
    expect(res.body.idempotent).toBe(true);
    expect(res.body.order.payment.txHash).toBe('CAPTURE99');
    // no capture call for an already-COMPLETED order
    expect(global.fetch.mock.calls.some(([u]) => u.endsWith('/capture'))).toBe(false);
  });

  it('returns 402 when PayPal verification fails', async () => {
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    // custom_id mismatch → reference_mismatch
    global.fetch = vi.fn(async (url, init = {}) => {
      if (url.includes('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
      if (url.includes('/v2/checkout/orders/')) {
        const o = paypalOrder('APPROVED');
        o.purchase_units[0].custom_id = 'order:other:l-9:M:quote';
        return { ok: true, json: async () => o };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const a = app(storefrontRouter, '/api/curator');

    const res = await post(a, '/api/curator/nia/order', { listingId: 'l-1', size: 'M', quantity: 1, paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('PayPal payment not verified: reference_mismatch');
  });
});

describe('PayPal rail — try-on route', () => {
  const OLD_ENV = process.env;
  const PHOTO = `data:image/jpeg;base64,${'a'.repeat(100)}`;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    ENV.forEach((k) => delete process.env[k]);
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
    process.env.PAYPAL_CLIENT_ID = 'cid';
    process.env.PAYPAL_CLIENT_SECRET = 'secret';
    paypal.__test.resetTokenCache();
    currentDb = null;
    vi.stubGlobal('fetch', vi.fn());
  });
  afterEach(() => {
    process.env = OLD_ENV;
    paypal.__test.resetTokenCache();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('advertises the paypal rail in the 402 only when configured', async () => {
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    global.fetch = paypalFetch();
    const a = app(tryonRouter, '/api/agent/try-on');

    const res = await post(a, '/api/agent/try-on', { curatorSlug: 'nia', listingId: 'l-1', photoData: PHOTO });
    expect(res.status).toBe(402);
    expect(res.body.quote.paymentRails).toContain('paypal');
    expect(res.body.quote.paypal).toMatchObject({ orderId: 'ORDER123ABC', currency: 'USD' });
    expect(res.body.quote.paypal.approveUrl).toBe('https://paypal.example/approve/ORDER123ABC');
  });

  it('rejects mixed proofs and malformed order ids', async () => {
    const a = app(tryonRouter, '/api/agent/try-on');
    const bad = await post(a, '/api/agent/try-on', { curatorSlug: 'nia', listingId: 'l-1', photoData: PHOTO, paypalOrderId: 'bad!' });
    expect(bad.status).toBe(400);

    const mixed = await post(a, '/api/agent/try-on', {
      curatorSlug: 'nia', listingId: 'l-1', photoData: PHOTO,
      paypalOrderId: 'ORDER123ABC', paymentTxHash: `0x${'a'.repeat(64)}`,
    });
    expect(mixed.status).toBe(400);
    expect(mixed.body.error).toBe('Provide exactly one payment proof');
  });

  it('409s a paypalOrderId proof when the rail is not configured', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    const a = app(tryonRouter, '/api/agent/try-on');

    const res = await post(a, '/api/agent/try-on', { curatorSlug: 'nia', listingId: 'l-1', photoData: PHOTO, paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('PAYMENT_RAIL_UNAVAILABLE');
  });

  it('returns 402 when PayPal verification fails', async () => {
    currentDb = fakeDb({ selectResults: [[LISTING_ROW]] });
    global.fetch = vi.fn(async (url) => {
      if (url.includes('/v1/oauth2/token')) return { ok: true, json: async () => ({ access_token: 't', expires_in: 3600 }) };
      if (url.includes('/v2/checkout/orders/')) {
        const o = paypalOrder('APPROVED');
        o.purchase_units[0].custom_id = 'tryon:nia:l-9:nonce';
        return { ok: true, json: async () => o };
      }
      throw new Error(`unexpected fetch ${url}`);
    });
    const a = app(tryonRouter, '/api/agent/try-on');

    const res = await post(a, '/api/agent/try-on', { curatorSlug: 'nia', listingId: 'l-1', photoData: PHOTO, paypalOrderId: 'ORDER123ABC' });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('PayPal payment not verified: reference_mismatch');
  });
});
