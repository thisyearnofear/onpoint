import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import crypto from 'node:crypto';

const require = createRequire(import.meta.url);

const dbModule = require('../lib/db');
let currentDb = null;
dbModule.getDb = () => {
  if (!currentDb) throw new Error('db not set');
  return currentDb;
};

const neg = require('../lib/agent-negotiation');
const negotiateRouter = require('./agent-negotiate');
const storefrontRouter = require('./curator-storefront');

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

function fakeDb(selectResults) {
  let idx = 0;
  return {
    select: () => q(selectResults[Math.min(idx++, selectResults.length - 1)] ?? []),
    insert: () => q([{ id: 'x' }]),
    update: () => q([{ id: 'x' }]),
    execute: async () => ({ rows: [{ id: 'x' }] }),
  };
}

function nearKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  return {
    secret: `ed25519:${neg.base58Encode(Buffer.concat([seed, pub]))}`,
    publicKey: `ed25519:${neg.base58Encode(pub)}`,
  };
}
const KEY = nearKey();

const LISTING = {
  id: 'l-1',
  title: 'NEAR FC Home Kit',
  status: 'live',
  inventoryType: 'physical',
  sizes: [{ size: 'M', price: 2500, stock: 3 }],
  photoKeys: ['k1'],
  tags: [],
  attributes: {},
  lastVerifiedAt: new Date().toISOString(),
};
const CURATOR = {
  slug: 'onpoint-store',
  name: 'OnPoint Store',
  type: 'human',
  commerce: {
    walletAddress: '0xabc0000000000000000000000000000000000001',
    priceFloorPct: 0.9,
    nearAccountId: 'store.onpoint.testnet',
  },
};
const ROW = { listing: LISTING, curator: CURATOR, kit: { id: 'kit-1', club: 'NEAR FC', kitType: 'home', officialImageKey: 'k1' } };

const app = express();
app.use(express.json());
app.use('/api/curator', negotiateRouter);
app.use('/api/curator', storefrontRouter);

async function post(path, body) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

beforeEach(() => {
  neg._sessions.clear();
  delete process.env.NEAR_QUOTE_SIGNING_KEY;
  delete process.env.NEAR_QUOTE_SIGNER_ACCOUNT;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  process.env.NEAR_QUOTE_SIGNING_KEYS = JSON.stringify({ 'store.onpoint.testnet': KEY.secret });
  process.env.NEAR_USD_PRICE = '4';
  process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
});

describe('POST /api/curator/:slug/negotiate', () => {
  it('opens a session and counters a below-floor offer', async () => {
    currentDb = fakeDb([[ROW], []]); // listing, then no bundle payment
    const r = await post('/api/curator/onpoint-store/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 17,
      nearAccountId: 'agent.onpoint.testnet',
    });
    expect(r.status).toBe(200);
    expect(r.body.status).toBe('countered');
    expect(r.body.counterOffer.offerUsd).toBe(17.31); // the floor
    expect(r.body.sessionId).toMatch(/^neg_/);
    expect(r.body.reasoning).toBeTruthy();
  });

  it('multi-round: counter → counter → accept mints a signed quoteToken', async () => {
    currentDb = fakeDb([[ROW], []]);
    const open = await post('/api/curator/onpoint-store/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 17,
      nearAccountId: 'agent.onpoint.testnet',
    });
    const sid = open.body.sessionId;
    // ask is 17.31 (floor); offer 17.2 is in-band → counter converges
    const r2 = await post(`/api/curator/onpoint-store/negotiate/${sid}`, { offerUsd: 17.2 });
    // buyer accepts the standing ask
    const r3 = await post(`/api/curator/onpoint-store/negotiate/${sid}`, { action: 'accept' });
    expect(r3.body.status).toBe('accepted');
    expect(r3.body.agreedUsd).toBe(r3.body.sellerAskUsd);
    const t = r3.body.quoteToken;
    expect(t.signed).toBe(true);
    expect(t.signer.accountId).toBe('store.onpoint.testnet'); // seller's own key
    expect(neg.verifyQuoteToken(t).ok).toBe(true);
  });

  it('detects the bundle (paid try-on) and softens the floor', async () => {
    currentDb = fakeDb([[ROW], [{ id: 'pay-1' }]]); // a recent try_on payment → bundle
    const r = await post('/api/curator/onpoint-store/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 16.5,
      nearAccountId: 'agent.onpoint.testnet',
    });
    expect(r.body.bundle).toBe(true);
    // bundle floor = 1731*(1-0.03)≈1679 → counter at floor, not reject
    expect(r.body.status).toBe('countered');
    expect(r.body.counterOffer.offerUsd).toBeLessThan(17.31);
  });

  it('refuses an insulting offer and keeps the refusal visible', async () => {
    currentDb = fakeDb([[ROW], []]);
    const r = await post('/api/curator/onpoint-store/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 5,
      nearAccountId: 'agent.onpoint.testnet',
    });
    expect(r.body.status).toBe('rejected');
    expect(r.body.seller.decision).toBe('insulting_offer');
    expect(r.body.reasoning).toBeTruthy();
  });
});

describe('quoteToken redemption on /order', () => {
  it('redeems a signed token at the agreed price (402 with NEAR rail)', async () => {
    currentDb = fakeDb([[ROW], []]);
    const open = await post('/api/curator/onpoint-store/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 30,
      nearAccountId: 'agent.onpoint.testnet',
    });
    expect(open.body.status).toBe('accepted'); // offer ≥ list → accept at list
    const token = open.body.quoteToken;

    currentDb = fakeDb([[ROW], []]); // order route's listing fetch + referral selects
    const order = await post('/api/curator/onpoint-store/order', {
      listingId: 'l-1', size: 'M', quantity: 1, quoteToken: token,
    });
    expect(order.status).toBe(402);
    expect(order.body.quote.totalCusd).toBe(19.23); // agreed = list (offer capped)
    expect(order.body.quote.near.accountId).toBe('store.onpoint.testnet');
  });

  it('rejects a token minted for a different scope', async () => {
    // A valid signature on a try-on token must not buy an order.
    const token = neg.mintQuoteToken({
      scope: 'tryon', curatorSlug: 'onpoint-store', listingId: 'l-1',
      agreedCusd: 0.03, sessionId: 'neg_other', payee: 'store.onpoint.testnet',
    });
    currentDb = fakeDb([[ROW], []]);
    const order = await post('/api/curator/onpoint-store/order', {
      listingId: 'l-1', size: 'M', quantity: 1, quoteToken: token,
    });
    expect(order.status).toBe(409);
    expect(order.body.code).toBe('QUOTE_TOKEN_MISMATCH');
  });
});
