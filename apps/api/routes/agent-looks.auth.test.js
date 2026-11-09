import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./agent-looks');
const { issueSessionToken } = require('../lib/agent-session');

const ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const OTHER_ADDRESS = '0x9999999999999999999999999999999999999999';

const savedEnv = {};
beforeEach(() => {
  for (const key of ['NODE_ENV', 'AGENT_SESSION_SECRET', 'TOKEN_SECRET', 'JWT_SECRET', 'NEON_DATABASE_URL']) {
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
  app.use('/api/looks', router);
  return app;
}

async function request(method, path, headers = {}, body = {}) {
  const server = buildApp().listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/looks${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: method === 'GET' ? undefined : JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

const WRITE_ROUTES = [
  ['POST', '/', { title: 'T', listingIds: ['x'] }],
  ['POST', '/bulk', { action: 'archive', slugs: ['x'] }],
  ['PATCH', '/some-look', { title: 'T' }],
  ['DELETE', '/some-look', {}],
  ['POST', '/some-look/image', { image: 'data:image/png;base64,AA' }],
];

describe('look writes require a verified wallet session', () => {
  for (const [method, path, body] of WRITE_ROUTES) {
    it(`${method} ${path} rejects unauthenticated requests`, async () => {
      const res = await request(method, path, {}, body);
      expect(res.status).toBe(401);
      expect(res.json.code).toBe('SESSION_REQUIRED');
    });

    it(`${method} ${path} rejects a bare x-agent-address header`, async () => {
      const res = await request(method, path, { 'x-agent-address': ADDRESS }, body);
      expect(res.status).toBe(401);
      expect(res.json.code).toBe('SESSION_REQUIRED');
    });

    it(`${method} ${path} rejects curator WhatsApp headers without a session`, async () => {
      const res = await request(
        method,
        path,
        { 'x-curator-slug': 'nia', 'x-curator-whatsapp': '+254712345678' },
        body,
      );
      expect(res.status).toBe(401);
      expect(res.json.code).toBe('SESSION_REQUIRED');
    });
  }

  it('rejects a session token whose wallet conflicts with x-agent-address', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await request(
      'POST',
      '/',
      { authorization: `Bearer ${token}`, 'x-agent-address': OTHER_ADDRESS },
      { title: 'T', listingIds: ['x'] },
    );
    expect(res.status).toBe(403);
    expect(res.json.code).toBe('SESSION_ADDRESS_MISMATCH');
  });

  it('a valid session passes the auth gate on the agent path', async () => {
    // Auth succeeds; the handler then fails at the (unconfigured) DB layer,
    // which proves the request was not rejected by lookAuth.
    const { token } = issueSessionToken(ADDRESS);
    const res = await request('POST', '/', { authorization: `Bearer ${token}` }, {});
    expect(res.status).toBe(500);
    expect(res.json.error).toBe('NEON_DATABASE_URL not configured');
  });

  it('a valid session with x-curator-slug enters curator wallet binding', async () => {
    const { token } = issueSessionToken(ADDRESS);
    const res = await request(
      'POST',
      '/',
      { authorization: `Bearer ${token}`, 'x-curator-slug': 'nia' },
      {},
    );
    expect(res.status).toBe(500);
    expect(res.json.error).toBe('Auth failed'); // DB unconfigured inside binding
  });
});

describe('look auth source contract', () => {
  const source = readFileSync(fileURLToPath(new URL('./agent-looks.js', import.meta.url)), 'utf8');

  it('lookAuth is built on requireAgentSession', () => {
    expect(source).toContain('requireAgentSession(req, res, async () => {');
    expect(source).toContain("const { requireAgentSession, extractSessionToken } = require('../middleware/agent-session')");
  });

  it('no plaintext WhatsApp comparison remains in lookAuth or draft scoping', () => {
    // The link-agent route still has its own WhatsApp check — that is closed
    // by the OTP + two-sided consent work, not by session auth.
    const lookAuthBlock = source.slice(
      source.indexOf('async function lookAuth'),
      source.indexOf('// ── POST /api/looks — create a look'),
    );
    expect(lookAuthBlock).not.toContain('whatsapp');
    expect(lookAuthBlock).not.toContain('x-curator-whatsapp');
    const listBlock = source.slice(
      source.indexOf("router.get('/', async"),
      source.indexOf('// ── POST /api/looks/bulk'),
    );
    expect(listBlock).not.toContain('x-curator-whatsapp');
  });

  it('draft scoping uses a verified session, not a spoofable header', () => {
    expect(source).toContain('verifySessionToken(extractSessionToken(req))');
  });

  it('ownership checks normalize address case', () => {
    expect(source).toContain("(existing.agentAddress || '').toLowerCase() !== req.creatorAddress");
    expect(source).not.toMatch(/existing\.agentAddress !== req\.creatorAddress/);
  });
});