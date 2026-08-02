import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import supertest from 'supertest';

process.env.PRAVA_SECRET_KEY = ['sk', 'test', 'prava', 'audit'].join('_');

const require = createRequire(import.meta.url);
const {
  createRestSession,
  pollRestSession,
  humanizeMerchant,
  PravaError,
} = require('./prava-client');
const pravaFacade = require('../routes/prava-facade');
const pravaSandbox = require('../routes/prava-sandbox');

function jsonResponse(body, { status = 200, responseId } = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      ...(responseId ? { 'x-response-id': responseId } : {}),
    },
  });
}

describe('Prava REST integration', () => {
  beforeEach(() => {
    process.env.PUBLIC_BASE_URL = 'https://beonpoint.netlify.app/agent';
    process.env.SERVICE_API_KEY = 'prava-audit-service-key';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.PUBLIC_BASE_URL;
    delete process.env.SERVICE_API_KEY;
  });

  it('creates the documented hosted-checkout session body', async () => {
    let request;
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      request = { url, ...init, body: JSON.parse(init.body) };
      return jsonResponse({
        session_id: 'ses_test',
        iframe_url: 'https://sandbox.collect.prava.space?session=ses_test',
        order_id: 'ord_test',
      });
    }));

    await createRestSession({
      totalAmount: '108.00',
      currency: 'usd',
      merchantName: 'aloyoga.com',
      merchantUrl: 'https://aloyoga.com',
      merchantCountry: 'us',
      products: [{
        product_id: 'sku-1',
        description: 'Alosoft Legging',
        unit_price: '108.00',
        quantity: 1,
      }],
    });

    expect(request.url).toBe('https://sandbox.api.prava.space/v1/sessions');
    expect(request.method).toBe('POST');
    expect(request.body).toMatchObject({
      user_id: 'onpoint_agent',
      user_email: 'agent@onpoint.famile.xyz',
      total_amount: '108.00',
      currency: 'USD',
      description: 'Aloyoga order via OnPoint',
      integration_type: 'full_checkout',
      callback_url: 'https://beonpoint.netlify.app/agent',
      purchase_context: [{
        merchant_details: {
          name: 'Aloyoga',
          url: 'https://aloyoga.com',
          country_code_iso2: 'US',
          category_code: '5691',
          category: "Men's and Women's Clothing Stores",
        },
        product_details: [{
          product_id: 'sku-1',
          description: 'Alosoft Legging',
          unit_price: '108.00',
          quantity: 1,
        }],
      }],
    });
    expect(humanizeMerchant('alo-yoga.com')).toBe('Alo Yoga');
  });

  it('preserves the provider error code, status, details, and response ID', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      error: {
        code: 'DEVICE_BINDING_FAILED',
        message: 'Binding failed',
        details: { stage: 'webauthn' },
      },
    }, { status: 409, responseId: 'resp_123' })));

    await expect(pollRestSession({ sessionId: 'ses_test' })).rejects.toMatchObject({
      name: 'PravaError',
      code: 'DEVICE_BINDING_FAILED',
      message: 'Binding failed',
      status: 409,
      context: {
        status: 409,
        details: { stage: 'webauthn' },
        responseId: 'resp_123',
        method: 'GET',
        path: '/v1/sessions/ses_test/payment-result',
      },
    });
  });

  it('does not promote a partial credential response to credential_ready', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'awaiting_result',
      transactions: [{ line_items: [{ token: 'token-without-the-other-required-fields' }] }],
    })));

    await expect(pollRestSession({ sessionId: 'ses_test' })).rejects.toEqual(
      expect.objectContaining({
        name: 'PravaError',
        code: 'incomplete_credential_response',
      }),
    );
  });

  it('captures the response ID when a successful poll reports a failed session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
      status: 'failed',
      order_id: 'ord_test',
      transactions: [{
        status: 'failed',
        error: { code: 'FETCH_AGENTIC_CREDS_ERROR', message: 'Fetching cryptogram failed' },
      }],
    }, { responseId: 'resp_failed_poll' })));

    await expect(pollRestSession({ sessionId: 'ses_test' })).resolves.toMatchObject({
      status: 'failed',
      providerRecordId: 'ord_test',
      error: {
        code: 'FETCH_AGENTIC_CREDS_ERROR',
        message: 'Fetching cryptogram failed',
        responseId: 'resp_failed_poll',
      },
    });
  });

  it('persists a definitive provider poll error on the order', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        session_id: 'ses_route_test',
        iframe_url: 'https://sandbox.collect.prava.space?session=ses_route_test',
        order_id: 'ord_route_test',
      }))
      .mockResolvedValueOnce(jsonResponse({
        error: {
          code: 'DEVICE_BINDING_FAILED',
          message: 'Binding failed',
        },
      }, { status: 409, responseId: 'resp_route_test' }));
    vi.stubGlobal('fetch', fetchMock);

    const app = express();
    app.use(express.json());
    app.use('/prava', pravaFacade);

    const created = await supertest(app)
      .post('/prava/order')
      .send({
        query: 'black leggings',
        productId: 'prod_fixture_alo',
        variantId: 'var_fixture__alo',
        merchant: 'aloyoga.com',
      })
      .expect(201);

    await supertest(app)
      .post(`/prava/order/${created.body.orderId}/poll`)
      .expect(409);

    const order = await supertest(app)
      .get(`/prava/order/${created.body.orderId}`)
      .expect(200);

    expect(order.body).toMatchObject({
      state: 'failed',
      failure: {
        code: 'DEVICE_BINDING_FAILED',
        message: 'Binding failed',
        status: 409,
        responseId: 'resp_route_test',
      },
    });
  });

  it('keeps hosted-session and credential material out of sandbox responses', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        session_id: 'ses_sandbox_route',
        session_token: 'provider-session-token',
        iframe_url: 'https://sandbox.collect.prava.space?session=ses_sandbox_route',
        order_id: 'ord_sandbox_route',
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'awaiting_result',
        transactions: [{ line_items: [{
          token: 'single-use-token',
          dynamic_cvv: '123',
          expiry_month: '12',
          expiry_year: '2028',
          txn_ref_id: 'txn_ref_test',
        }] }],
      }));
    vi.stubGlobal('fetch', fetchMock);

    const app = express();
    app.use(express.json());
    app.use('/prava/sandbox', pravaSandbox);
    const headers = { 'x-service-key': process.env.SERVICE_API_KEY };

    const created = await supertest(app)
      .post('/prava/sandbox/order')
      .set(headers)
      .send({
        totalAmount: '108.00',
        merchantName: 'aloyoga.com',
        merchantUrl: 'https://aloyoga.com',
        products: [{ description: 'Alosoft Legging', unit_price: '108.00', quantity: 1 }],
      })
      .expect(201);

    expect(created.body).not.toHaveProperty('sessionToken');

    const result = await supertest(app)
      .get(`/prava/sandbox/order/${created.body.sessionId}/result`)
      .set(headers)
      .expect(200);

    expect(result.body).toEqual({ session_id: 'ses_sandbox_route', status: 'credential_ready' });
    expect(JSON.stringify(result.body)).not.toMatch(/single-use-token|dynamic_cvv|txn_ref_test/);
  });

  it('caches a terminal sandbox failure instead of polling Prava again', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        session_id: 'ses_failed_route',
        iframe_url: 'https://sandbox.collect.prava.space?session=ses_failed_route',
        order_id: 'ord_failed_route',
      }))
      .mockResolvedValueOnce(jsonResponse({
        status: 'failed',
        order_id: 'ord_failed_route',
        transactions: [{
          status: 'failed',
          error: { code: 'FETCH_AGENTIC_CREDS_ERROR', message: 'Fetching cryptogram failed' },
        }],
      }, { responseId: 'resp_failed_route' }));
    vi.stubGlobal('fetch', fetchMock);

    const app = express();
    app.use(express.json());
    app.use('/prava/sandbox', pravaSandbox);
    const headers = { 'x-service-key': process.env.SERVICE_API_KEY };

    const created = await supertest(app)
      .post('/prava/sandbox/order')
      .set(headers)
      .send({
        totalAmount: '108.00',
        merchantName: 'aloyoga.com',
        merchantUrl: 'https://aloyoga.com',
        products: [{ description: 'Alosoft Legging', unit_price: '108.00', quantity: 1 }],
      })
      .expect(201);

    const path = `/prava/sandbox/order/${created.body.sessionId}/result`;
    const first = await supertest(app).get(path).set(headers).expect(200);
    const second = await supertest(app).get(path).set(headers).expect(200);

    expect(first.body).toEqual(second.body);
    expect(second.body).toMatchObject({
      status: 'failed',
      providerRecordId: 'ord_failed_route',
      error: {
        code: 'FETCH_AGENTIC_CREDS_ERROR',
        responseId: 'resp_failed_route',
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
