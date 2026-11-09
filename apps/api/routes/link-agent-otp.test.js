import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./agent-looks');
const {
  generateOtp,
  hashOtp,
  verifyOtpFormat,
  timingSafeStringEqual,
  createMemoryLinkOtpStore,
} = require('../lib/link-agent-otp');

process.env.NODE_ENV = 'test';
process.env.AGENT_SESSION_SECRET = 'test-session-secret';

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

describe('link-agent OTP crypto', () => {
  it('generates 6-digit codes and verifies via constant-time compare', () => {
    const otp = generateOtp();
    expect(verifyOtpFormat(otp)).toBe(true);
    const hash = hashOtp(otp);
    expect(timingSafeStringEqual(hashOtp(otp), hash)).toBe(true);
    expect(timingSafeStringEqual(hashOtp('000000'), hash)).toBe(false);
  });

  it('rejects malformed OTP formats', () => {
    expect(verifyOtpFormat('12345')).toBe(false);
    expect(verifyOtpFormat('abcdef')).toBe(false);
    expect(verifyOtpFormat('1234567')).toBe(false);
  });

  it('locks after 3 wrong attempts', async () => {
    const store = createMemoryLinkOtpStore();
    await store.saveOtp('nia', hashOtp('123456'));
    await store.consumeAttempt('nia');
    await store.consumeAttempt('nia');
    const locked = await store.consumeAttempt('nia');
    expect(locked.locked).toBe(true);
    expect(await store.getOtp('nia')).toBeNull();
  });

  it('rate-limits OTP sends to 5 per phone per hour', async () => {
    const store = createMemoryLinkOtpStore();
    for (let i = 0; i < 5; i++) {
      const { allowed } = await store.canSend('+254700000001');
      expect(allowed).toBe(true);
      await store.recordSend('+254700000001');
    }
    const { allowed } = await store.canSend('+254700000001');
    expect(allowed).toBe(false);
  });
});

describe('link-agent route auth gates', () => {
  it('legacy route is closed with 410', async () => {
    const res = await request('POST', '/curator/nia/link-agent', {}, { whatsapp: '+254', agentAddress: '0x1234' });
    expect(res.status).toBe(410);
    expect(res.json.hint).toMatch(/link-agent\/request/);
  });

  it('request requires a wallet session', async () => {
    const res = await request('POST', '/curator/nia/link-agent/request', {}, {});
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('SESSION_REQUIRED');
  });

  it('verify requires a wallet session', async () => {
    const res = await request(
      'POST',
      '/curator/nia/link-agent/verify',
      {},
      { otp: '123456', agentAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', agentToken: 'x' },
    );
    expect(res.status).toBe(401);
    expect(res.json.code).toBe('SESSION_REQUIRED');
  });
});

describe('link-agent source contract', () => {
  const source = readFileSync(fileURLToPath(new URL('./agent-looks.js', import.meta.url)), 'utf8');

  it('no plaintext WhatsApp comparison in the link flow', () => {
    const start = source.indexOf('Link-agent two-sided consent');
    const block = source.slice(start, source.indexOf('Test hook'));
    expect(block).not.toMatch(/storedWhatsapp !== providedWhatsapp/);
    expect(block).not.toContain('x-curator-whatsapp');
  });

  it('uses constant-time OTP compare and two-sided agent consent', () => {
    expect(source).toContain('timingSafeStringEqual(supplied, expected)');
    expect(source).toContain('verifySessionToken(String(agentToken))');
    expect(source).toContain("sendMessage({");
  });

  it('MCP create_look requires sessionToken and sends Bearer', () => {
    const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
    const tools = readFileSync(`${repoRoot}packages/qwen-mcp/src/tools.ts`, 'utf8');
    const server = readFileSync(`${repoRoot}packages/qwen-mcp/src/server.ts`, 'utf8');
    expect(tools).toContain('sessionToken is required');
    expect(tools).toContain('Authorization: `Bearer ${sessionToken}`');
    expect(tools).not.toMatch(/"x-agent-address": agentAddress/);
    expect(server).toContain('sessionToken');
  });
});
