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
// 1000 KES / 130 = 7.69 cUSD posted price
const LIST_PRICE_CUSD = 7.69;

function listingRow(commerce = {}) {
  return {
    listing: {
      id: 'l-1', curatorSlug: 'nia', status: 'live', inventoryType: 'physical',
      sizes: [{ size: 'M', stock: 2, price: 1000 }],
      photoKeys: ['k1'], title: 'Test Tee', tags: [],
      lastVerifiedAt: new Date().toISOString(),
    },
    curator: { slug: 'nia', name: 'Nia', type: 'human', commerce: { walletAddress: WALLET, ...commerce } },
    kit: { id: 'kit-1', club: 'Test FC', kitType: 'home', season: '2025', officialImageKey: 'k1' },
  };
}

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/curator', storefrontRouter);
  return a;
}

async function post(path, body) {
  const { default: supertest } = await import('supertest');
  return supertest(app()).post(path).send(body);
}

const ENV = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_ENV', 'NEAR_USD_PRICE', 'NEAR_PAYOUT_ACCOUNT', 'NEAR_TOKEN_CONTRACT', 'NEAR_TOKEN_FORWARDER', 'NEAR_TOKEN_DECIMALS', 'NEAR_TOKEN_SYMBOL', 'R2_PUBLIC_URL'];

describe('order negotiation — offerUsd', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV };
    ENV.forEach((k) => delete process.env[k]);
    process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
    process.env.NEAR_USD_PRICE = '4';
    process.env.NEAR_PAYOUT_ACCOUNT = 'store.onpoint.testnet';
    process.env.NEAR_TOKEN_CONTRACT = 'usdc.fakes.testnet';
    process.env.NEAR_TOKEN_FORWARDER = 'escrow.onpoint.testnet';
    currentDb = null;
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('rejects a non-numeric or non-positive offerUsd', async () => {
    for (const offerUsd of ['abc', -5, 0]) {
      const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/offerUsd/);
    }
  });

  it('counters a below-floor offer with a 409 machine-readable quote', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    // floor = ceil(7.69 * 0.9 * 100)/100 = 6.93
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd: 6 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_BELOW_FLOOR');
    expect(res.body.counterOffer).toMatchObject({
      offerUsd: 6.93,
      listCusd: LIST_PRICE_CUSD,
      currency: 'USD',
      listingId: 'l-1',
      size: 'M',
      quantity: 1,
    });
  });

  it('accepts an offer at the floor → 402 at the offered price', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd: 6.93 });
    expect(res.status).toBe(402);
    expect(res.body.quote.totalCusd).toBe(6.93);
    expect(res.body.quote.negotiation).toMatchObject({
      offerUsd: 6.93,
      listCusd: LIST_PRICE_CUSD,
      agreedCusd: 6.93,
      negotiable: true,
    });
    // the NEAR token leg quotes the negotiated amount (6.93 → 6930000 base units)
    expect(res.body.quote.near.token.amount).toBe('6930000');
  });

  it('accepts a mid-range offer below list price', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd: 7.2 });
    expect(res.status).toBe(402);
    expect(res.body.quote.totalCusd).toBe(7.2);
  });

  it('never quotes above the posted price, even when the offer exceeds it', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd: 50 });
    expect(res.status).toBe(402);
    expect(res.body.quote.totalCusd).toBe(LIST_PRICE_CUSD);
    expect(res.body.quote.negotiation.agreedCusd).toBe(LIST_PRICE_CUSD);
  });

  it('treats an absent priceFloorPct as no negotiation — floor is the posted price', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow()]] });
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M', offerUsd: 7 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_BELOW_FLOOR');
    expect(res.body.counterOffer.offerUsd).toBe(LIST_PRICE_CUSD);
  });

  it('leaves the no-offer flow byte-identical (402 at posted price)', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    const res = await post('/api/curator/nia/order', { listingId: 'l-1', size: 'M' });
    expect(res.status).toBe(402);
    expect(res.body.quote.totalCusd).toBe(LIST_PRICE_CUSD);
    expect(res.body.quote.negotiation.negotiable).toBe(true);
    expect(res.body.quote.negotiation.agreedCusd).toBeUndefined();
    expect(res.body.quote.near.token.amount).toBe('7690000');
  });

  it('still counters when a below-floor offer arrives with a payment proof', async () => {
    currentDb = fakeDb({ selectResults: [[listingRow({ priceFloorPct: 0.9 })]] });
    const res = await post('/api/curator/nia/order', {
      listingId: 'l-1', size: 'M', offerUsd: 5,
      nearTxHash: '7RSBBJ1mBptxAfrKnwU3rXh8TtGWFmY2ncKYgK1489ZH',
    });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('OFFER_BELOW_FLOOR');
  });
});
