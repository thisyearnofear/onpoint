import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  paypalEnv,
  paypalBaseUrl,
  paypalRailEnabled,
  isPaypalOrderId,
  getAccessToken,
  createPaypalOrder,
  verifyAndCapturePaypalOrder,
  paypalQuoteForUsd,
  paypalSellerPayoutEmail,
  sendPaypalPayout,
  __test,
} = require('./paypal-payments');

const ENV_KEYS = ['PAYPAL_ENV', 'PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_SELLER_PAYOUT_EMAIL'];

function setEnv() {
  process.env.PAYPAL_CLIENT_ID = 'client-id';
  process.env.PAYPAL_CLIENT_SECRET = 'client-secret';
}

const TOKEN_RESPONSE = {
  ok: true,
  json: async () => ({ access_token: 'tok-1', expires_in: 3600 }),
};

function orderResponse(status, overrides = {}) {
  return {
    id: 'ORDER123ABC',
    status,
    payer: { payer_id: 'PAYER1', email_address: 'payer@example.com' },
    purchase_units: [
      {
        custom_id: 'tryon:nia:l-1:nonce',
        amount: { currency_code: 'USD', value: '0.05' },
        payments: { captures: [] },
      },
    ],
    ...overrides,
  };
}

const COMPLETED_CAPTURE = {
  status: 'COMPLETED',
  id: 'CAPTURE1',
  amount: { currency_code: 'USD', value: '0.05' },
};

describe('paypal-payments helpers', () => {
  beforeEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    __test.resetTokenCache();
  });
  afterEach(() => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    __test.resetTokenCache();
    vi.restoreAllMocks();
  });

  it('resolves env, base url, and rail gating', () => {
    expect(paypalEnv()).toBe('sandbox');
    expect(paypalBaseUrl()).toContain('sandbox');
    process.env.PAYPAL_ENV = 'live';
    expect(paypalEnv()).toBe('live');
    expect(paypalBaseUrl()).toBe('https://api-m.paypal.com');

    expect(paypalRailEnabled()).toBe(false);
    setEnv();
    expect(paypalRailEnabled()).toBe(true);
  });

  it('validates order ids', () => {
    expect(isPaypalOrderId('8AB12345CD67890EF')).toBe(true);
    expect(isPaypalOrderId('abc')).toBe(false);
    expect(isPaypalOrderId('0x' + 'a'.repeat(40))).toBe(false);
    expect(isPaypalOrderId(null)).toBe(false);
  });

  it('caches the OAuth token until near expiry', async () => {
    setEnv();
    const fetchImpl = vi.fn().mockResolvedValue(TOKEN_RESPONSE);
    const t1 = await getAccessToken({ fetchImpl });
    const t2 = await getAccessToken({ fetchImpl });
    expect(t1).toBe('tok-1');
    expect(t2).toBe('tok-1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe('https://api-m.sandbox.paypal.com/v1/oauth2/token');
  });

  it('creates an order with reference-bound purchase unit and idempotency header', async () => {
    setEnv();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'ORDER123ABC',
          links: [
            { rel: 'self', href: 'https://self' },
            { rel: 'payer-action', href: 'https://paypal.com/approve/ORDER123ABC' },
            { rel: 'approve', href: 'https://paypal.com/fallback' },
          ],
        }),
      });

    const result = await createPaypalOrder({
      amountUsd: 0.05,
      referenceId: 'tryon:nia:l-1:nonce',
      description: 'OnPoint try-on',
      requestId: 'req-1',
      fetchImpl,
    });

    expect(result).toEqual({
      orderId: 'ORDER123ABC',
      approveUrl: 'https://paypal.com/approve/ORDER123ABC',
    });
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toContain('/v2/checkout/orders');
    expect(init.headers['PayPal-Request-Id']).toBe('req-1');
    const body = JSON.parse(init.body);
    expect(body.intent).toBe('CAPTURE');
    expect(body.purchase_units[0].custom_id).toBe('tryon:nia:l-1:nonce');
    expect(body.purchase_units[0].amount).toEqual({ currency_code: 'USD', value: '0.05' });
  });

  it('verifies an APPROVED order and captures it', async () => {
    setEnv();
    const completed = orderResponse('COMPLETED', {
      purchase_units: [
        { custom_id: 'tryon:nia:l-1:nonce', amount: { currency_code: 'USD', value: '0.05' }, payments: { captures: [COMPLETED_CAPTURE] } },
      ],
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => orderResponse('APPROVED') })
      .mockResolvedValueOnce({ ok: true, json: async () => completed });

    const result = await verifyAndCapturePaypalOrder({
      orderId: 'ORDER123ABC',
      expectedReferencePrefix: 'tryon:nia:l-1:',
      minAmountUsd: 0.05,
      fetchImpl,
    });

    expect(result.ok).toBe(true);
    expect(result.captureId).toBe('CAPTURE1');
    expect(result.payerId).toBe('PAYER1');
    expect(result.amountUsd).toBe(0.05);
    expect(fetchImpl.mock.calls[2][1].headers['PayPal-Request-Id']).toBe('capture-ORDER123ABC');
  });

  it('accepts an already COMPLETED order without re-capturing', async () => {
    setEnv();
    const completed = orderResponse('COMPLETED', {
      purchase_units: [
        { custom_id: 'tryon:nia:l-1:nonce', amount: { currency_code: 'USD', value: '0.05' }, payments: { captures: [COMPLETED_CAPTURE] } },
      ],
    });
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => completed });

    const result = await verifyAndCapturePaypalOrder({
      orderId: 'ORDER123ABC',
      expectedReferencePrefix: 'tryon:nia:l-1:',
      minAmountUsd: 0.05,
      fetchImpl,
    });
    expect(result.ok).toBe(true);
    // token + GET only — no capture call
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fails closed on each guard', async () => {
    setEnv();

    // order_not_found
    let fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: false, status: 404 });
    expect((await verifyAndCapturePaypalOrder({ orderId: 'X', fetchImpl })).reason).toBe('order_not_found');

    // reference_mismatch
    __test.resetTokenCache();
    fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => orderResponse('APPROVED') });
    expect((await verifyAndCapturePaypalOrder({
      orderId: 'X', expectedReferencePrefix: 'order:nia:l-9:M:', fetchImpl,
    })).reason).toBe('reference_mismatch');

    // currency_mismatch
    __test.resetTokenCache();
    const wrongCurrency = orderResponse('APPROVED');
    wrongCurrency.purchase_units[0].amount.currency_code = 'EUR';
    fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => wrongCurrency });
    expect((await verifyAndCapturePaypalOrder({ orderId: 'X', fetchImpl })).reason).toBe('currency_mismatch');

    // insufficient_amount
    __test.resetTokenCache();
    fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => orderResponse('APPROVED') });
    expect((await verifyAndCapturePaypalOrder({
      orderId: 'X', minAmountUsd: 99, fetchImpl,
    })).reason).toBe('insufficient_amount');

    // not_approved (status CREATED)
    __test.resetTokenCache();
    fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => orderResponse('CREATED') });
    expect((await verifyAndCapturePaypalOrder({ orderId: 'X', fetchImpl })).reason).toBe('not_approved');

    // capture_failed
    __test.resetTokenCache();
    fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: true, json: async () => orderResponse('APPROVED') })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    expect((await verifyAndCapturePaypalOrder({ orderId: 'X', fetchImpl })).reason).toBe('capture_failed_500');
  });

  it('paypalQuoteForUsd returns null when disabled and on create failure', async () => {
    expect(await paypalQuoteForUsd({ amountUsd: 1, referenceId: 'r' })).toBeNull();

    setEnv();
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(TOKEN_RESPONSE)
      .mockResolvedValueOnce({ ok: false, status: 503 });
    expect(await paypalQuoteForUsd({ amountUsd: 1, referenceId: 'r', fetchImpl })).toBeNull();
  });
});

describe('sendPaypalPayout', () => {
  beforeEach(() => {
    setEnv();
    process.env.PAYPAL_SELLER_PAYOUT_EMAIL = 'seller@example.com';
  });

  it('posts a payout batch and returns the batch id', async () => {
    const calls = [];
    const fetchImpl = vi.fn(async (url, init) => {
      calls.push(url);
      if (url.includes('/v1/oauth2/token')) return TOKEN_RESPONSE;
      return {
        ok: true,
        json: async () => ({ batch_header: { payout_batch_id: 'BATCH123', batch_status: 'PENDING' } }),
      };
    });
    const res = await sendPaypalPayout({
      receiverEmail: 'seller@example.com',
      amountUsd: 0.0285,
      senderBatchId: 'payout-tryon-ORDER1',
      fetchImpl,
    });
    expect(res).toEqual({ ok: true, payoutBatchId: 'BATCH123', batchStatus: 'PENDING', amountUsd: 0.0285 });
    expect(calls[1]).toContain('/v1/payments/payouts');
  });

  it('is disabled without config and refuses sub-cent amounts', async () => {
    delete process.env.PAYPAL_CLIENT_ID;
    expect(await sendPaypalPayout({ receiverEmail: 's@x.com', amountUsd: 1, senderBatchId: 'b' }))
      .toEqual({ ok: false, reason: 'not_configured' });
    setEnv();
    expect(await sendPaypalPayout({ receiverEmail: 's@x.com', amountUsd: 0.005, senderBatchId: 'b' }))
      .toEqual({ ok: false, reason: 'below_minimum' });
  });

  it('returns a reason instead of throwing on PayPal errors', async () => {
    const fetchImpl = vi.fn(async (url) => {
      if (url.includes('/v1/oauth2/token')) return TOKEN_RESPONSE;
      return { ok: false, status: 422, json: async () => ({ name: 'VALIDATION_ERROR' }) };
    });
    const res = await sendPaypalPayout({ receiverEmail: 's@x.com', amountUsd: 1, senderBatchId: 'b', fetchImpl });
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('payout_failed_422_VALIDATION_ERROR');
  });

  it('reads the seller email from env only', () => {
    expect(paypalSellerPayoutEmail()).toBe('seller@example.com');
    delete process.env.PAYPAL_SELLER_PAYOUT_EMAIL;
    expect(paypalSellerPayoutEmail()).toBe(null);
  });
});
