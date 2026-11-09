import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import { privateKeyToAccount } from 'viem/accounts';

const require = createRequire(import.meta.url);
const { createAgentAuthRouter } = require('./agent-auth');
const { createMemoryChallengeStore } = require('../lib/agent-auth-challenges');
const { verifySessionToken } = require('../lib/agent-session');

// Well-known local test key (Hardhat #0) — never used outside tests.
const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
);
const otherAccount = privateKeyToAccount(
  '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
);

const savedEnv = {};
beforeEach(() => {
  for (const key of ['NODE_ENV', 'AGENT_SESSION_SECRET', 'TOKEN_SECRET', 'JWT_SECRET']) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  process.env.NODE_ENV = 'test';
  process.env.AGENT_SESSION_SECRET = 'test-session-secret';
});
afterEach(() => {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

function buildApp({ store = createMemoryChallengeStore(), now } = {}) {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', createAgentAuthRouter({ store, ...(now ? { now } : {}) }));
  return app;
}

async function request(app, path, body) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/auth${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

describe('POST /api/auth/challenge', () => {
  it('rejects malformed addresses', async () => {
    const app = buildApp();
    for (const address of [undefined, '', '0x123', 'not-an-address', 42]) {
      const res = await request(app, '/challenge', { address });
      expect(res.status).toBe(400);
    }
  });

  it('returns a SIWE-style message bound to the address, with a nonce and expiry', async () => {
    const app = buildApp();
    const res = await request(app, '/challenge', { address: account.address });
    expect(res.status).toBe(200);
    expect(res.json.address).toBe(account.address.toLowerCase());
    expect(res.json.message).toContain(account.address); // checksummed in message
    expect(res.json.message).toContain(`Nonce: ${res.json.nonce}`);
    expect(res.json.message).toContain('does not authorize any payment');
    expect(res.json.nonce).toMatch(/^[a-f0-9]{32}$/);
    const ttlMs = new Date(res.json.expiresAt).getTime() - Date.now();
    expect(ttlMs).toBeGreaterThan(4 * 60 * 1000);
    expect(ttlMs).toBeLessThanOrEqual(5 * 60 * 1000);
  });

  it('returns 503 when the challenge store is unavailable', async () => {
    const store = {
      save: async () => { throw new Error('redis down'); },
      take: async () => null,
    };
    const res = await request(buildApp({ store }), '/challenge', { address: account.address });
    expect(res.status).toBe(503);
  });
});

describe('POST /api/auth/verify', () => {
  it('exchanges a valid signature for a session token (full round-trip)', async () => {
    const app = buildApp();
    const challenge = await request(app, '/challenge', { address: account.address });
    const signature = await account.signMessage({ message: challenge.json.message });
    const res = await request(app, '/verify', { address: account.address, signature });

    expect(res.status).toBe(200);
    expect(res.json.tokenType).toBe('Bearer');
    expect(res.json.address).toBe(account.address.toLowerCase());
    const payload = verifySessionToken(res.json.token);
    expect(payload?.sub).toBe(account.address.toLowerCase());
  });

  it('consumes the challenge one-time — replaying the same signature fails', async () => {
    const app = buildApp();
    const challenge = await request(app, '/challenge', { address: account.address });
    const signature = await account.signMessage({ message: challenge.json.message });
    const body = { address: account.address, signature };

    const first = await request(app, '/verify', body);
    expect(first.status).toBe(200);
    const second = await request(app, '/verify', body);
    expect(second.status).toBe(401);
    expect(second.json.code).toBe('CHALLENGE_NOT_FOUND');
  });

  it('rejects a signature from a different wallet', async () => {
    const app = buildApp();
    const challenge = await request(app, '/challenge', { address: account.address });
    const signature = await otherAccount.signMessage({ message: challenge.json.message });
    const res = await request(app, '/verify', { address: account.address, signature });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe('SIGNATURE_MISMATCH');
  });

  it('rejects a signature over a different message', async () => {
    const app = buildApp();
    await request(app, '/challenge', { address: account.address });
    const signature = await account.signMessage({ message: 'give me all the looks' });
    const res = await request(app, '/verify', { address: account.address, signature });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe('SIGNATURE_MISMATCH');
  });

  it('rejects verify without a prior challenge', async () => {
    const app = buildApp();
    const signature = await account.signMessage({ message: 'anything' });
    const res = await request(app, '/verify', { address: account.address, signature });
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('CHALLENGE_NOT_FOUND');
  });

  it('rejects an expired challenge', async () => {
    let clock = Date.now();
    const app = buildApp({ now: () => clock });
    const challenge = await request(app, '/challenge', { address: account.address });
    const signature = await account.signMessage({ message: challenge.json.message });

    clock += 6 * 60 * 1000; // past the 5-minute challenge TTL
    const res = await request(app, '/verify', { address: account.address, signature });
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('CHALLENGE_EXPIRED');
  });

  it('rejects malformed inputs', async () => {
    const app = buildApp();
    const badAddress = await request(app, '/verify', { address: '0x123', signature: '0x' + 'ab'.repeat(65) });
    expect(badAddress.status).toBe(400);
    const badSig = await request(app, '/verify', { address: account.address, signature: '0xdeadbeef' });
    expect(badSig.status).toBe(400);
  });

  it('returns 503 when the challenge store is unavailable', async () => {
    const store = {
      save: async () => {},
      take: async () => { throw new Error('redis down'); },
    };
    const signature = await account.signMessage({ message: 'anything' });
    const res = await request(buildApp({ store }), '/verify', { address: account.address, signature });
    expect(res.status).toBe(503);
  });

  it('fails closed when no session secret is configured in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.AGENT_SESSION_SECRET;
    const app = buildApp();
    const challenge = await request(app, '/challenge', { address: account.address });
    const signature = await account.signMessage({ message: challenge.json.message });
    const res = await request(app, '/verify', { address: account.address, signature });
    expect(res.status).toBe(500);
    expect(res.json.error).toMatch(/not configured/);
  });
});