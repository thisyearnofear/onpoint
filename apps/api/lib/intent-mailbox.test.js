import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const mailbox = require('./intent-mailbox');
const { validateSignedIntentPayload } = require('./near-intents');

const ENV_KEYS = [
  'NEAR_INTENTS_VERIFIER', 'NEAR_TOKEN_CONTRACT', 'NEAR_TOKEN_DECIMALS',
  'NEAR_TOKEN_SYMBOL', 'NEAR_RPC_URL', 'NEAR_NETWORK', 'NEAR_TOKEN_FORWARDER',
];

const CFG_ENV = {
  NEAR_INTENTS_VERIFIER: 'intents.onpoint.testnet',
  NEAR_TOKEN_CONTRACT: 'usdc.fakes.testnet',
  NEAR_TOKEN_DECIMALS: '6',
  NEAR_TOKEN_SYMBOL: 'USDC.e',
};

const BUYER = 'agent.onpoint.testnet';
const PAYEE = 'store.onpoint.testnet';

function signedIntent({ buyer = BUYER, payee = PAYEE, amount = '16790000', deadline, verifier = CFG_ENV.NEAR_INTENTS_VERIFIER } = {}) {
  const message = JSON.stringify({
    signer_id: buyer,
    verifying_contract: verifier,
    deadline: deadline ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    nonce: 'AA==',
    intents: [{ intent: 'transfer', receiver_id: payee, tokens: { 'nep141:usdc.fakes.testnet': amount } }],
  });
  return {
    standard: 'nep413',
    payload: { message, nonce: 'AA==', recipient: verifier },
    signature: 'ed25519:sig',
    public_key: 'ed25519:pk',
  };
}

beforeEach(() => {
  for (const [k, v] of Object.entries(CFG_ENV)) process.env[k] = v;
});
afterEach(() => {
  for (const k of ENV_KEYS) delete process.env[k];
});

describe('validateSignedIntentPayload', () => {
  it('accepts a well-formed intent paying the payee', () => {
    const r = validateSignedIntentPayload({ signed: signedIntent(), buyerAccountId: BUYER, expectedPayeeId: PAYEE, minAmountBase: '16790000' });
    expect(r.ok).toBe(true);
    expect(r.amount).toBe('16790000');
  });

  it('rejects a wrong signer', () => {
    const r = validateSignedIntentPayload({ signed: signedIntent(), buyerAccountId: 'mallory.testnet', expectedPayeeId: PAYEE, minAmountBase: '1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('signer_mismatch');
  });

  it('rejects a transfer to someone else', () => {
    const r = validateSignedIntentPayload({ signed: signedIntent({ payee: 'mallory.testnet' }), buyerAccountId: BUYER, expectedPayeeId: PAYEE, minAmountBase: '1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('no_transfer_to_payee');
  });

  it('rejects an amount below the quote', () => {
    const r = validateSignedIntentPayload({ signed: signedIntent({ amount: '100' }), buyerAccountId: BUYER, expectedPayeeId: PAYEE, minAmountBase: '16790000' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('amount_below_quote');
  });

  it('rejects an expired deadline', () => {
    const r = validateSignedIntentPayload({ signed: signedIntent({ deadline: '2020-01-01T00:00:00Z' }), buyerAccountId: BUYER, expectedPayeeId: PAYEE, minAmountBase: '1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('deadline_expired');
  });
});

describe('intent mailbox', () => {
  it('stores a valid intent as pending and lists it for the payee', () => {
    const r = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100', redeem: { endpoint: 'http://x/order', body: { a: 1 } } });
    expect(r.ok).toBe(true);
    const list = mailbox.list({ payee: PAYEE });
    expect(list.some((p) => p.pendingId === r.pendingId)).toBe(true);
    expect(list[0].signed.signature).toBe('ed25519:sig');
  });

  it('does not list pending intents for a different payee', () => {
    const r = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100' });
    expect(mailbox.list({ payee: 'curator.onpoint.testnet' }).some((p) => p.pendingId === r.pendingId)).toBe(false);
  });

  it('rejects an invalid intent at the door', () => {
    const r = mailbox.submit({ signed: { standard: 'nep413' }, buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '1' });
    expect(r.ok).toBe(false);
  });

  it('complete() records the settlement for the buyer poll', () => {
    const r = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100' });
    mailbox.complete(r.pendingId, { txHash: 'H'.repeat(44), result: { orderId: 'o1' } });
    const p = mailbox.get(r.pendingId);
    expect(p.status).toBe('settled');
    expect(p.txHash).toBe('H'.repeat(44));
    expect(mailbox.list({ payee: PAYEE }).some((x) => x.pendingId === r.pendingId)).toBe(false);
  });
});
