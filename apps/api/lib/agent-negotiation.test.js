import { describe, expect, it, beforeEach } from 'vitest';

const crypto = require('crypto');
const neg = require('./agent-negotiation');

// Generate a NEAR-format ed25519 secret ("ed25519:<base58(seed‖pub)>") for tests.
function nearKey() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const pub = Buffer.from(publicKey.export({ format: 'jwk' }).x, 'base64url');
  const seed = Buffer.from(privateKey.export({ format: 'jwk' }).d, 'base64url');
  const secret = `ed25519:${neg.base58Encode(Buffer.concat([seed, pub]))}`;
  return { secret, publicKey: `ed25519:${neg.base58Encode(pub)}` };
}

const KEY = nearKey();

function makeSession(over = {}) {
  return neg.createSession({
    scope: 'order',
    curatorSlug: 'onpoint-store',
    listingId: 'l-1',
    size: 'M',
    quantity: 1,
    listCusd: 19.23,
    curator: { commerce: { walletAddress: '0xabc', priceFloorPct: 0.9, nearAccountId: 'store.onpoint.testnet' } },
    payee: 'store.onpoint.testnet',
    bundle: false,
    ...over,
  });
}

beforeEach(() => {
  neg._sessions.clear();
  delete process.env.NEAR_QUOTE_SIGNING_KEY;
  delete process.env.NEAR_QUOTE_SIGNER_ACCOUNT;
  delete process.env.NEAR_QUOTE_SIGNING_KEYS;
  process.env.NEAR_QUOTE_SIGNING_KEYS = JSON.stringify({ 'store.onpoint.testnet': KEY.secret });
});

describe('evaluateSellerPolicy', () => {
  it('accepts when the buyer meets the ask (at list on round 1)', () => {
    const s = makeSession();
    const d = neg.evaluateSellerPolicy(s, 1923);
    expect(d.decision).toBe('accept');
    expect(d.priceCents).toBe(1923);
  });

  it('rejects an insulting first offer (below 60% of floor)', () => {
    const s = makeSession(); // floor = ceil(1923*0.9) = 1731
    const d = neg.evaluateSellerPolicy(s, 1000); // < 1731*0.6
    expect(d.decision).toBe('reject');
    expect(d.why).toBe('insulting_offer');
  });

  it('counters in the haggle band, halving the ask→floor gap', () => {
    const s = makeSession(); // floor 1731
    const d = neg.evaluateSellerPolicy(s, 1731); // at floor but below ask
    expect(d.decision).toBe('counter');
    expect(d.priceCents).toBe(Math.max(1731, 1923 - Math.ceil((1923 - 1731) / 2))); // 1827
  });

  it('never counters below the floor', () => {
    const s = makeSession();
    s.askCents = 1760;
    const d = neg.evaluateSellerPolicy(s, 1100); // above insult line, below floor
    expect(d.decision).toBe('counter');
    expect(d.priceCents).toBe(1731);
  });

  it('walks away after two stagnant buyer offers (fatigue)', () => {
    const s = makeSession();
    s.history.push({ actor: 'buyer', cents: 1500, round: 1 });
    const d1 = neg.evaluateSellerPolicy(s, 1500); // stagnant #1 → warn
    expect(d1.decision).toBe('counter');
    const d2 = neg.evaluateSellerPolicy(s, 1499); // stagnant #2 → walk
    expect(d2.decision).toBe('reject');
    expect(d2.why).toBe('stagnant_offers');
  });

  it('rejects when rounds are exhausted', () => {
    const s = makeSession();
    s.round = s.config.maxRounds + 1;
    const d = neg.evaluateSellerPolicy(s, 1760);
    expect(d.decision).toBe('reject');
    expect(d.why).toBe('rounds_exhausted');
  });

  it('softens the floor when the buyer hired the stylist (bundle)', () => {
    const single = makeSession({ bundle: false });
    const bundled = makeSession({ bundle: true });
    expect(bundled.floorCents).toBeLessThan(single.floorCents);
  });
});

describe('quote token', () => {
  it('mints a per-seller signed token that verifies', () => {
    const { payload, signature, signer, signed } = neg.mintQuoteToken({
      scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1',
      size: 'M', quantity: 1, agreedCusd: 17.31, sessionId: 'neg_x',
      payee: 'store.onpoint.testnet',
    });
    expect(signed).toBe(true);
    expect(signer.accountId).toBe('store.onpoint.testnet'); // the seller signs
    expect(signer.publicKey).toBe(KEY.publicKey);
    const check = neg.verifyQuoteToken({ payload, signature, signer });
    expect(check.ok).toBe(true);
    expect(check.payload.agreedCusd).toBe(17.31);
  });

  it('rejects a tampered payload', () => {
    const t = neg.mintQuoteToken({
      scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1',
      agreedCusd: 17.31, sessionId: 'neg_x', payee: 'store.onpoint.testnet',
    });
    const forged = { ...t, payload: { ...t.payload, agreedCusd: 1 } };
    expect(neg.verifyQuoteToken(forged).ok).toBe(false);
  });

  it('rejects an untrusted signer account', () => {
    const t = neg.mintQuoteToken({
      scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1',
      agreedCusd: 17.31, sessionId: 'neg_x', payee: 'store.onpoint.testnet',
    });
    const bad = { ...t, signer: { ...t.signer, accountId: 'mallory.near' } };
    expect(neg.verifyQuoteToken(bad).ok).toBe(false);
  });

  it('rejects an expired token', () => {
    const t = neg.mintQuoteToken({
      scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1',
      agreedCusd: 17.31, sessionId: 'neg_x', payee: 'store.onpoint.testnet',
      ttlMs: -1,
    });
    expect(neg.verifyQuoteToken(t).ok).toBe(false);
  });

  it('falls back to the single-key env for unmapped payees', () => {
    delete process.env.NEAR_QUOTE_SIGNING_KEYS;
    process.env.NEAR_QUOTE_SIGNING_KEY = KEY.secret;
    process.env.NEAR_QUOTE_SIGNER_ACCOUNT = 'onpoint.testnet';
    const t = neg.mintQuoteToken({
      scope: 'order', curatorSlug: 'onpoint-store', listingId: 'l-1',
      agreedCusd: 17.31, sessionId: 'neg_x', payee: 'someone.near',
    });
    expect(t.signer.accountId).toBe('onpoint.testnet');
    expect(neg.verifyQuoteToken(t).ok).toBe(true);
  });
});
