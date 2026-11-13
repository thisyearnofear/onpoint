import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { intentsConfig, intentsQuoteForUsd, verifyIntentsSettlement } = require('./near-intents');

const ENV_KEYS = [
  'NEAR_INTENTS_VERIFIER', 'NEAR_TOKEN_CONTRACT', 'NEAR_TOKEN_DECIMALS',
  'NEAR_TOKEN_SYMBOL', 'NEAR_RPC_URL', 'NEAR_NETWORK', 'NEAR_TOKEN_FORWARDER',
];

const CFG_ENV = {
  NEAR_INTENTS_VERIFIER: 'intents.onpoint.testnet',
  NEAR_TOKEN_CONTRACT: 'usdc.fakes.testnet',
  NEAR_TOKEN_DECIMALS: '6',
  NEAR_TOKEN_SYMBOL: 'USDC.e',
  NEAR_RPC_URL: 'https://rpc.testnet.fastnear.com',
};

function setEnv() {
  for (const [k, v] of Object.entries(CFG_ENV)) process.env[k] = v;
}

/** Minimal EXPERIMENTAL_tx_status shape for a seller-executed intent. */
function txStatus({ signer = 'store.onpoint.testnet', receiver = 'intents.onpoint.testnet', intents = null, failure = null } = {}) {
  const signedPayload = intents
    ? [{ standard: 'nep413', payload: { message: JSON.stringify(intents), nonce: 'AA==', recipient: receiver }, signature: 'ed25519:sig', public_key: 'ed25519:pk' }]
    : [];
  return {
    final_execution_status: 'FINAL',
    status: { SuccessValue: '' },
    receipts_outcome: failure
      ? [{ outcome: { status: { Failure: failure } } }]
      : [{ outcome: { status: { SuccessValue: '' } } }],
    transaction: {
      signer_id: signer,
      receiver_id: receiver,
      actions: [
        {
          FunctionCall: {
            method_name: 'execute_intents',
            args: Buffer.from(JSON.stringify({ signed: signedPayload })).toString('base64'),
          },
        },
      ],
    },
    transaction_outcome: { id: 'H'.repeat(44) },
  };
}

const GOOD_MSG = {
  signer_id: 'agent.onpoint.testnet',
  verifying_contract: 'intents.onpoint.testnet',
  deadline: '2099-01-01T00:00:00.000000Z',
  nonce: 'AA==',
  intents: [
    {
      intent: 'transfer',
      receiver_id: 'store.onpoint.testnet',
      tokens: { 'nep141:usdc.fakes.testnet': '50000' },
    },
  ],
};

function stubRpc(payload) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ result: payload }) })));
}

const VERIFY_ARGS = {
  txHash: 'H'.repeat(44),
  buyerAccountId: 'agent.onpoint.testnet',
  expectedPayeeId: 'store.onpoint.testnet',
  minAmountBase: '50000',
};

describe('near-intents rail', () => {
  beforeEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    vi.unstubAllGlobals();
  });

  describe('intentsConfig / intentsQuoteForUsd', () => {
    it('is disabled without NEAR_INTENTS_VERIFIER or a token contract', () => {
      expect(intentsConfig()).toBeNull();
      expect(intentsQuoteForUsd(10, 'store.onpoint.testnet')).toBeNull();
      process.env.NEAR_INTENTS_VERIFIER = CFG_ENV.NEAR_INTENTS_VERIFIER;
      expect(intentsConfig()).toBeNull(); // still no token contract
    });

    it('quotes the USD amount in settlement-token base units', () => {
      setEnv();
      const q = intentsQuoteForUsd(17.31, 'store.onpoint.testnet');
      expect(q.standard).toBe('nep413');
      expect(q.verifier).toBe('intents.onpoint.testnet');
      expect(q.tokenId).toBe('nep141:usdc.fakes.testnet');
      expect(q.payTo).toBe('store.onpoint.testnet');
      expect(q.amount).toBe('17310000');
      expect(q.display).toBeCloseTo(17.31);
    });
  });

  describe('verifyIntentsSettlement', () => {
    it('accepts a seller-executed intent paying the quoted amount', async () => {
      setEnv();
      stubRpc(txStatus({ intents: GOOD_MSG }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(true);
      expect(r.mode).toBe('intents');
      expect(r.signer).toBe('agent.onpoint.testnet');
      expect(r.executor).toBe('store.onpoint.testnet');
      expect(r.amountToken).toBe('50000');
    });

    it('rejects when the executing signer is not the payee', async () => {
      setEnv();
      stubRpc(txStatus({ signer: 'random.testnet', intents: GOOD_MSG }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('executor_not_payee');
    });

    it('rejects an intent paying a different payee', async () => {
      setEnv();
      const msg = { ...GOOD_MSG, intents: [{ intent: 'transfer', receiver_id: 'curator.onpoint.testnet', tokens: { 'nep141:usdc.fakes.testnet': '50000' } }] };
      stubRpc(txStatus({ intents: msg }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('no_matching_intent');
    });

    it('rejects an intent paying less than the quote', async () => {
      setEnv();
      const msg = { ...GOOD_MSG, intents: [{ intent: 'transfer', receiver_id: 'store.onpoint.testnet', tokens: { 'nep141:usdc.fakes.testnet': '1' } }] };
      stubRpc(txStatus({ intents: msg }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('no_matching_intent');
    });

    it('rejects an intent signed by a different buyer', async () => {
      setEnv();
      stubRpc(txStatus({ intents: { ...GOOD_MSG, signer_id: 'mallory.testnet' } }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('no_matching_intent');
    });

    it('rejects a tx that failed in a receipt', async () => {
      setEnv();
      stubRpc(txStatus({ intents: GOOD_MSG, failure: { ActionError: {} } }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('receipt_failed');
    });

    it('rejects when the rail is not configured', async () => {
      stubRpc(txStatus({ intents: GOOD_MSG }));
      const r = await verifyIntentsSettlement(VERIFY_ARGS);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('intents_not_configured');
    });
  });
});
