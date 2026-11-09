import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  issueSessionToken,
  verifySessionToken,
  SESSION_TTL_SECONDS,
} = require('./agent-session');

const ADDRESS = '0xAbC0000000000000000000000000000000000001';

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

describe('issueSessionToken / verifySessionToken', () => {
  it('round-trips a token and normalizes the address to lowercase', () => {
    const { token, address, expiresAt } = issueSessionToken(ADDRESS);
    expect(address).toBe(ADDRESS.toLowerCase());
    const payload = verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload.sub).toBe(ADDRESS.toLowerCase());
    expect(payload.iss).toBe('onpoint-agent-auth');
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('defaults to a one-hour lifetime', () => {
    const now = Date.now();
    const { token } = issueSessionToken(ADDRESS, { now });
    const payload = verifySessionToken(token, { now });
    expect(payload.exp - payload.iat).toBe(SESSION_TTL_SECONDS);
  });

  it('rejects a tampered payload', () => {
    const { token } = issueSessionToken(ADDRESS);
    const [header, payload, signature] = token.split('.');
    const forged = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    forged.sub = '0x9999999999999999999999999999999999999999';
    const tampered = `${header}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${signature}`;
    expect(verifySessionToken(tampered)).toBeNull();
  });

  it('rejects a token signed with a different secret', () => {
    const { token } = issueSessionToken(ADDRESS);
    process.env.AGENT_SESSION_SECRET = 'a-different-secret';
    expect(verifySessionToken(token)).toBeNull();
  });

  it('rejects an expired token', () => {
    const now = Date.now();
    const { token } = issueSessionToken(ADDRESS, { now, ttlSeconds: 60 });
    expect(verifySessionToken(token, { now: now + 61_000 })).toBeNull();
    expect(verifySessionToken(token, { now })).not.toBeNull();
  });

  it('rejects malformed tokens', () => {
    expect(verifySessionToken('not-a-token')).toBeNull();
    expect(verifySessionToken('a.b')).toBeNull();
    expect(verifySessionToken('')).toBeNull();
    expect(verifySessionToken(null)).toBeNull();
    expect(verifySessionToken(undefined)).toBeNull();
  });

  it('rejects a correctly-signed token with the wrong issuer', () => {
    const crypto = require('crypto');
    const payload = {
      sub: ADDRESS.toLowerCase(),
      iss: 'some-other-issuer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
      .createHmac('sha256', process.env.AGENT_SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');
    expect(verifySessionToken(`${header}.${body}.${signature}`)).toBeNull();
  });

  it('falls back to TOKEN_SECRET then JWT_SECRET', () => {
    delete process.env.AGENT_SESSION_SECRET;
    process.env.TOKEN_SECRET = 'fallback-token-secret';
    const { token } = issueSessionToken(ADDRESS);
    expect(verifySessionToken(token)).not.toBeNull();

    delete process.env.TOKEN_SECRET;
    process.env.JWT_SECRET = 'fallback-jwt-secret';
    const second = issueSessionToken(ADDRESS);
    expect(verifySessionToken(second.token)).not.toBeNull();
    // Token signed under the previous secret no longer verifies.
    expect(verifySessionToken(token)).toBeNull();
  });

  it('fails closed in prod-like environments with no secret configured', () => {
    delete process.env.AGENT_SESSION_SECRET;
    process.env.NODE_ENV = 'production';
    expect(() => issueSessionToken(ADDRESS)).toThrow(/not configured/);
    expect(verifySessionToken('anything')).toBeNull();

    delete process.env.NODE_ENV; // unset NODE_ENV is prod-like too
    expect(() => issueSessionToken(ADDRESS)).toThrow(/not configured/);
  });

  it('allows a fixed local secret in development without env setup', () => {
    delete process.env.AGENT_SESSION_SECRET;
    process.env.NODE_ENV = 'development';
    const { token } = issueSessionToken(ADDRESS);
    expect(verifySessionToken(token)).not.toBeNull();
  });
});