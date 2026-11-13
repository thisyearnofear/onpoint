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

const { validateSignedDiffPayload } = require('./near-intents');

function signedDiff({ buyer = BUYER, give = '2500000000000000000000000', get = '16790000', giveTokenId = 'nep141:wrap.testnet', deadline } = {}) {
  const message = JSON.stringify({
    signer_id: buyer,
    verifying_contract: CFG_ENV.NEAR_INTENTS_VERIFIER,
    deadline: deadline ?? new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    nonce: 'AA==',
    intents: [{ intent: 'token_diff', diff: { [giveTokenId]: `-${give}`, 'nep141:usdc.fakes.testnet': get } }],
  });
  return {
    standard: 'nep413',
    payload: { message, nonce: 'AA==', recipient: CFG_ENV.NEAR_INTENTS_VERIFIER },
    signature: 'ed25519:sig',
    public_key: 'ed25519:pk',
    giveTokenId,
  };
}

describe('validateSignedDiffPayload', () => {
  it('accepts a well-formed diff funding the transfer', () => {
    const r = validateSignedDiffPayload({ signed: signedDiff(), expectedSigner: BUYER, giveTokenId: 'nep141:wrap.testnet', minGetBase: '16790000' });
    expect(r.ok).toBe(true);
    expect(r.giveAmount).toBe('2500000000000000000000000');
    expect(r.getAmount).toBe('16790000');
  });

  it('rejects a diff signed by someone other than the buyer', () => {
    const r = validateSignedDiffPayload({ signed: signedDiff({ buyer: 'mallory.testnet' }), expectedSigner: BUYER, giveTokenId: 'nep141:wrap.testnet', minGetBase: '1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('diff_signer_mismatch');
  });

  it('rejects a diff that gets less than the transfer needs', () => {
    const r = validateSignedDiffPayload({ signed: signedDiff({ get: '100' }), expectedSigner: BUYER, giveTokenId: 'nep141:wrap.testnet', minGetBase: '16790000' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('diff_get_below_quote');
  });

  it('rejects a diff whose give leg is not negative', () => {
    const bad = signedDiff();
    const msg = JSON.parse(bad.payload.message);
    msg.intents[0].diff['nep141:wrap.testnet'] = '5';
    bad.payload.message = JSON.stringify(msg);
    const r = validateSignedDiffPayload({ signed: bad, expectedSigner: BUYER, giveTokenId: 'nep141:wrap.testnet', minGetBase: '1' });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('diff_give_not_negative');
  });
});

describe('swap-funded mailbox', () => {
  it('stores the buyer diff with the pending intent for the seller to solve', () => {
    const r = mailbox.submit({
      signed: signedIntent(), signedSwap: signedDiff(), buyerAccountId: BUYER,
      payee: PAYEE, minAmountBase: '16790000', redeem: { path: '/x', body: {} },
    });
    expect(r.ok).toBe(true);
    const p = mailbox.list({ payee: PAYEE }).find((x) => x.pendingId === r.pendingId);
    expect(p.swap).toBeTruthy();
    expect(p.swap.giveTokenId).toBe('nep141:wrap.testnet');
    expect(p.swap.signed.signature).toBe('ed25519:sig');
  });

  it('rejects a swap signed by a different account than the transfer', () => {
    const r = mailbox.submit({
      signed: signedIntent(), signedSwap: signedDiff({ buyer: 'mallory.testnet' }),
      buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100',
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('swap_diff_signer_mismatch');
  });

  it('still works with no swap — the direct-USDC path is unchanged', () => {
    const r = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100' });
    expect(r.ok).toBe(true);
    const p = mailbox.get(r.pendingId);
    expect(p.swap).toBeNull();
  });
});

describe('open solver queue — race semantics', () => {
  const SOLVER = 'solver-7.onpoint.testnet';

  function submitSwap() {
    return mailbox.submit({
      signed: signedIntent(), signedSwap: signedDiff(), buyerAccountId: BUYER,
      payee: PAYEE, minAmountBase: '16790000', redeem: { path: '/x', body: {} },
    });
  }

  it('lists swap items to solvers regardless of payee, payee items excluded', () => {
    const swapItem = submitSwap();
    const plain = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100' });
    const solverList = mailbox.list({ solver: true });
    const ids = solverList.map((p) => p.pendingId);
    expect(ids).toContain(swapItem.pendingId);
    expect(ids).not.toContain(plain.pendingId);
    // The payee's own queue still sees both.
    expect(mailbox.list({ payee: PAYEE }).map((p) => p.pendingId)).toContain(plain.pendingId);
  });

  it('first completion wins — a late solver loses without overwriting', () => {
    const r = submitSwap();
    const win = mailbox.complete(r.pendingId, { txHash: 'W'.repeat(44), status: 'settled', executor: SOLVER });
    expect(win.won).toBe(true);
    expect(win.executor).toBe(SOLVER);
    const lose = mailbox.complete(r.pendingId, { txHash: 'L'.repeat(44), status: 'settled', executor: 'solver-b.testnet' });
    expect(lose.won).toBe(false);
    const p = mailbox.get(r.pendingId);
    expect(p.status).toBe('settled');
    expect(p.txHash).toBe('W'.repeat(44));
    expect(p.executor).toBe(SOLVER);
  });

  it('a losing solver\'s failed report does not poison a fillable swap item', () => {
    const r = submitSwap();
    const lose = mailbox.complete(r.pendingId, { status: 'failed', executor: SOLVER, result: { failure: 'nonce consumed' } });
    expect(lose.won).toBe(false);
    expect(lose.attemptRecorded).toBe(true);
    const p = mailbox.get(r.pendingId);
    expect(p.status).toBe('pending'); // still fillable by another solver
    expect(p.attempts[0].executor).toBe(SOLVER);
    // The winner can still land.
    const win = mailbox.complete(r.pendingId, { txHash: 'W'.repeat(44), status: 'settled', executor: 'solver-b.testnet' });
    expect(win.won).toBe(true);
  });

  it('payee-only items keep first-wins — a failed report closes them', () => {
    const r = mailbox.submit({ signed: signedIntent(), buyerAccountId: BUYER, payee: PAYEE, minAmountBase: '100' });
    const out = mailbox.complete(r.pendingId, { status: 'failed', executor: PAYEE });
    expect(out.won).toBe(true);
    expect(mailbox.get(r.pendingId).status).toBe('failed');
  });

  it('unknown pendingIds complete to null', () => {
    expect(mailbox.complete('pin_nope', { txHash: 'x' })).toBeNull();
  });
});
