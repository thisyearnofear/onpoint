import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);
const { createServiceApiKeyAuth, timingSafeStringEqual } = require('./service-key-auth');
const { createApiKeyAuth } = require('./api-key-auth');

function appWith(middleware) {
  const app = express();
  app.use(middleware);
  app.get('/ok', (req, res) => res.json({ ok: true }));
  return app;
}

const ENV_KEYS = ['NODE_ENV', 'SERVICE_API_KEY', 'VENICE_API_KEY'];
let saved;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

describe('timingSafeStringEqual', () => {
  it('matches equal strings and rejects unequal ones of any length', () => {
    expect(timingSafeStringEqual('secret', 'secret')).toBe(true);
    expect(timingSafeStringEqual('secret', 'secreT')).toBe(false);
    expect(timingSafeStringEqual('secret', 'secret-longer')).toBe(false);
    expect(timingSafeStringEqual('', '')).toBe(true);
  });
});

describe('service-key auth', () => {
  it('accepts a valid x-service-key', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_API_KEY = 'svc-secret';
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok').set('x-service-key', 'svc-secret');
    expect(res.status).toBe(200);
  });

  it('accepts a valid Bearer token', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_API_KEY = 'svc-secret';
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok').set('authorization', 'Bearer svc-secret');
    expect(res.status).toBe(200);
  });

  it('rejects an invalid key with 403', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_API_KEY = 'svc-secret';
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok').set('x-service-key', 'wrong');
    expect(res.status).toBe(403);
  });

  it('rejects a missing key with 401', async () => {
    process.env.NODE_ENV = 'production';
    process.env.SERVICE_API_KEY = 'svc-secret';
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok');
    expect(res.status).toBe(401);
  });

  it('fails closed (500) when no key is configured in a prod-like env', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.SERVICE_API_KEY;
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok');
    expect(res.status).toBe(500);
  });

  it('fails closed when NODE_ENV is unset (the footgun)', async () => {
    delete process.env.NODE_ENV;
    delete process.env.SERVICE_API_KEY;
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok');
    expect(res.status).toBe(500);
  });

  it('allows local development to pass without a key', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.SERVICE_API_KEY;
    const res = await supertest(appWith(createServiceApiKeyAuth())).get('/ok');
    expect(res.status).toBe(200);
  });
});

describe('api-key auth (constant-time compare)', () => {
  it('accepts a valid x-api-key', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VENICE_API_KEY = 'venice-secret';
    const res = await supertest(appWith(createApiKeyAuth())).get('/ok').set('x-api-key', 'venice-secret');
    expect(res.status).toBe(200);
  });

  it('rejects an invalid key with 403', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VENICE_API_KEY = 'venice-secret';
    const res = await supertest(appWith(createApiKeyAuth())).get('/ok').set('x-api-key', 'nope');
    expect(res.status).toBe(403);
  });

  it('fails closed (500) when no key is configured in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.VENICE_API_KEY;
    const res = await supertest(appWith(createApiKeyAuth())).get('/ok');
    expect(res.status).toBe(500);
  });
});
