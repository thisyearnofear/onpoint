import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const { requireAgentSession } = require('./agent-session');
const { issueSessionToken } = require('../lib/agent-session');

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';

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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.post('/write', requireAgentSession, (req, res) => {
    res.json({ address: req.agentSession.sub });
  });
  return app;
}

async function post(headers, body = {}) {
  const server = buildApp().listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

describe('requireAgentSession', () => {
  it('rejects requests with no session', async () => {
    const res = await post({});
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('SESSION_REQUIRED');
  });

  it('rejects a bare x-agent-address header (the old spoofable path)', async () => {
    const res = await post({ 'x-agent-address': ADDRESS });
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('SESSION_REQUIRED');
  });

  it('rejects curator WhatsApp headers without a session', async () => {
    const res = await post({ 'x-curator-slug': 'nia', 'x-curator-whatsapp': '+254712345678' });
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('SESSION_REQUIRED');
  });

  it('rejects invalid and expired tokens', async () => {
    const invalid = await post({ authorization: 'Bearer not.a.token' });
    expect(invalid.status).toBe(401);
    expect(invalid.json.code).toBe('SESSION_INVALID');

    const { token } = issueSessionToken(ADDRESS, { ttlSeconds: 60, now: Date.now() - 120_000 });
    const expired = await post({ authorization: `Bearer ${token}` });
    expect(expired.status).toBe(401);
    expect(expired.json.code).toBe('SESSION_INVALID');
  });

  it('accepts a valid Bearer token and exposes the verified address', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await post({ authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(res.json.address).toBe(ADDRESS.toLowerCase());
  });

  it('accepts the x-agent-session header as an alternative', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await post({ 'x-agent-session': token });
    expect(res.status).toBe(200);
    expect(res.json.address).toBe(ADDRESS.toLowerCase());
  });

  it('rejects x-agent-address that conflicts with the session wallet', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await post({
      authorization: `Bearer ${token}`,
      'x-agent-address': '0x9999999999999999999999999999999999999999',
    });
    expect(res.status).toBe(403);
    expect(res.json.code).toBe('SESSION_ADDRESS_MISMATCH');
  });

  it('allows a matching x-agent-address regardless of case', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await post({
      authorization: `Bearer ${token}`,
      'x-agent-address': ADDRESS.toUpperCase().replace('0X', '0x'),
    });
    expect(res.status).toBe(200);
  });
});