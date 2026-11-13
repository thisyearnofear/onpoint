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
const mailbox = require('../lib/negotiation-mailbox');
const presence = require('../lib/seller-presence');
const codec = require('../lib/quote-token-codec');
const negotiateRouter = require('./agent-negotiate');
const mailboxRouter = require('./pending-negotiations');

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
    secret: `ed25519:${codec.base58Encode(Buffer.concat([seed, pub]))}`,
    publicKey: `ed25519:${codec.base58Encode(pub)}`,
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
app.use('/api', mailboxRouter);
app.use('/api/curator', negotiateRouter);

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

async function get(path) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

// A seller-side signature over a quote payload binding the given session —
// the same artifact seller-agent.mjs produces with its own key.
function signToken(session, agreedCusd, secret = KEY.secret, accountId = 'store.onpoint.testnet') {
  const payload = {
    v: 1, scope: session.scope, curatorSlug: session.curatorSlug, listingId: session.listingId,
    size: session.size ?? null, quantity: session.quantity ?? null,
    agreedCusd, sessionId: session.sessionId, payee: session.payee,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };
  const signed = codec.signQuotePayload(payload, secret);
  return { payload, signature: signed.signature, signer: { accountId, publicKey: signed.publicKey }, signed: true };
}

const PAYEE = 'store.onpoint.testnet';

beforeEach(() => {
  neg._sessions.clear();
  mailbox._pending.clear();
  presence._seen.clear();
  delete process.env.NEAR_QUOTE_SIGNING_KEY;
  delete process.env.NEAR_QUOTE_SIGNER_ACCOUNT;
  process.env.NEAR_QUOTE_SIGNING_KEYS = JSON.stringify({ [PAYEE]: KEY.secret });
});

async function openSession(offerUsd = 17) {
  currentDb = fakeDb([[ROW], []]);
  const r = await post('/api/curator/onpoint-store/negotiate', {
    listingId: 'l-1', size: 'M', quantity: 1, offerUsd,
    nearAccountId: 'agent.onpoint.testnet',
  });
  return r;
}

describe('POST /api/seller-presence', () => {
  it('beats and routes the next negotiation to the sovereign seller', async () => {
    const hb = await post('/api/seller-presence', { payee: PAYEE });
    expect(hb.status).toBe(200);
    expect(hb.body.fresh).toBe(true);
    const open = await openSession();
    expect(open.status).toBe(202);
    expect(open.body.status).toBe('pending_seller');
    expect(open.body.sellerMode).toBe('sovereign');
    expect(open.body.pendingId).toMatch(/^pnx_/);
  });

  it('rejects a malformed payee', async () => {
    const r = await post('/api/seller-presence', { payee: 'not an account' });
    expect(r.status).toBe(400);
  });
});

describe('sovereign negotiation flow', () => {
  it('seller queue → counter → buyer offer → seller-signed accept', async () => {
    presence.beat(PAYEE);
    const open = await openSession();
    expect(open.status).toBe(202);
    const sid = open.body.sessionId;

    // The seller's own process polls its queue.
    const queue = await get(`/api/pending-negotiations?payee=${PAYEE}`);
    expect(queue.body.pending).toHaveLength(1);
    const item = queue.body.pending[0];
    expect(item.sessionId).toBe(sid);
    expect(item.round).toBe(1);
    expect(item.offer).toEqual({ kind: 'offer', cents: 1700 });
    expect(item.context.listCents).toBe(1923);

    // Seller counters with its own policy (unsigned relay text — non-binding).
    const r1 = await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 1, decision: 'counter', price: 18.5, reasoning: 'best I can do',
    });
    expect(r1.status).toBe(200);
    expect(r1.body.status).toBe('countered');
    expect(r1.body.counterOffer.offerUsd).toBe(18.5);

    // Buyer answers the counter — round 2 goes back to the mailbox.
    const r2 = await post(`/api/curator/onpoint-store/negotiate/${sid}`, { offerUsd: 18.3 });
    expect(r2.status).toBe(202);
    expect(r2.body.status).toBe('pending_seller');
    const item2 = mailbox.get(r2.body.pendingId);
    expect(item2.round).toBe(2);

    // Seller accepts — the commitment is the quoteToken signed by its own key.
    const session = neg.getSession(sid);
    const token = signToken(session, 18.3);
    const r3 = await post(`/api/pending-negotiations/${item2.pendingId}/respond`, {
      round: 2, decision: 'accept', quoteToken: token,
    });
    expect(r3.status).toBe(200);
    expect(r3.body.status).toBe('accepted');
    expect(r3.body.agreedUsd).toBe(18.3);
    expect(r3.body.quoteToken.signature).toBe(token.signature);

    // The buyer's poll sees the finished session.
    const snap = await get(`/api/negotiations/${sid}`);
    expect(snap.body.status).toBe('accepted');
    expect(snap.body.quoteToken.signer.accountId).toBe(PAYEE);
  });

  it('rejects a response for a stale round', async () => {
    presence.beat(PAYEE);
    const open = await openSession();
    const item = mailbox.get(open.body.pendingId);
    const r = await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 99, decision: 'counter', price: 18,
    });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('STALE_ROUND');
    expect(r.body.round).toBe(1);
    expect(mailbox.get(item.pendingId).status).toBe('pending'); // still owed an answer
  });

  it('ignores a second answer once the item is answered/superseded', async () => {
    presence.beat(PAYEE);
    const open = await openSession();
    const item = mailbox.get(open.body.pendingId);
    await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 1, decision: 'refuse', reasoning: 'no',
    });
    const again = await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 1, decision: 'counter', price: 18,
    });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('NOT_PENDING');
  });

  it('accept requires a quoteToken and binds it to the session', async () => {
    presence.beat(PAYEE);
    const open = await openSession();
    const item = mailbox.get(open.body.pendingId);

    const missing = await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 1, decision: 'accept',
    });
    expect(missing.status).toBe(400);

    // A token minted for another listing must not bind this session.
    const session = neg.getSession(open.body.sessionId);
    const foreign = signToken({ ...session, listingId: 'l-other' }, 17);
    const mismatch = await post(`/api/pending-negotiations/${item.pendingId}/respond`, {
      round: 1, decision: 'accept', quoteToken: foreign,
    });
    expect(mismatch.status).toBe(409);
    expect(mismatch.body.code).toBe('QUOTE_TOKEN_MISMATCH');
    expect(mailbox.get(item.pendingId).status).toBe('pending');
  });
});

describe('hosted fallback when the seller dies', () => {
  it('expired offer + stale presence → hosted policy resolves the round', async () => {
    presence.beat(PAYEE);
    const open = await openSession();
    expect(open.status).toBe(202);
    const sid = open.body.sessionId;

    // Kill the seller: stale presence + expired mailbox item.
    presence._seen.get(PAYEE).lastSeenAt = 0;
    mailbox._pending.get(open.body.pendingId).expiresAt = 0;

    const snap = await get(`/api/negotiations/${sid}`);
    // The hosted policy answered the 17.00 offer — sellerMode visibly flipped.
    expect(snap.body.status).toBe('countered');
    expect(snap.body.sellerMode).toBe('hosted');
    expect(snap.body.counterOffer.offerUsd).toBe(17.31);
  });

  it('a sovereign-only payee (no hosted key) stays pending — the platform cannot sign', async () => {
    const extCurator = { ...CURATOR, slug: 'ext-shop', commerce: { ...CURATOR.commerce, nearAccountId: 'merchant-ext.testnet' } };
    const extRow = { listing: LISTING, curator: extCurator, kit: ROW.kit };
    presence.beat('merchant-ext.testnet');
    currentDb = fakeDb([[extRow], []]);
    const open = await post('/api/curator/ext-shop/negotiate', {
      listingId: 'l-1', size: 'M', quantity: 1, offerUsd: 17,
      nearAccountId: 'agent.onpoint.testnet',
    });
    expect(open.status).toBe(202);

    presence._seen.get('merchant-ext.testnet').lastSeenAt = 0;
    mailbox._pending.get(open.body.pendingId).expiresAt = 0;

    const snap = await get(`/api/negotiations/${open.body.sessionId}`);
    // No hosted key for this payee — the offer can only wait for a process
    // that can actually sign. sellerMode stays sovereign, never impersonated.
    expect(snap.body.status).toBe('pending_seller');
    expect(snap.body.sellerMode).toBe('sovereign');
  });
});

describe('GET /api/negotiations/:sessionId', () => {
  it('404s an unknown session', async () => {
    const r = await get('/api/negotiations/neg_nope');
    expect(r.status).toBe(404);
  });
});
