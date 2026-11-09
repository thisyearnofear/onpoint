/**
 * Wallet-session tokens for agent identity.
 *
 * A client proves wallet control via challenge/verify (routes/agent-auth.js),
 * then receives a short-lived HMAC bearer token. Creator-scoped writes require
 * this token — a bare x-agent-address header is no longer an identity proof.
 *
 * Token format: base64url(header).base64url(payload).base64url(HMAC-SHA256)
 * Secret: AGENT_SESSION_SECRET || TOKEN_SECRET || JWT_SECRET. Fail-closed in
 * any non-dev environment when no secret is configured; dev/test fall back to
 * a fixed local secret so the flow works without env setup.
 */

const crypto = require('crypto');
const { timingSafeStringEqual } = require('../middleware/service-key-auth');

const SESSION_TTL_SECONDS = 60 * 60; // 1 hour
const CHALLENGE_TTL_SECONDS = 5 * 60; // 5 minutes
const ISSUER = 'onpoint-agent-auth';
const DEV_SECRET = 'onpoint-agent-session-local-dev-only';

function isProdLike() {
  return process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';
}

function getSessionSecret() {
  const secret =
    process.env.AGENT_SESSION_SECRET ||
    process.env.TOKEN_SECRET ||
    process.env.JWT_SECRET;
  if (secret) return secret;
  return isProdLike() ? null : DEV_SECRET;
}

/**
 * Issue a session token for a verified wallet address.
 * @param {string} address - 0x-prefixed wallet address (normalized to lowercase)
 * @param {{ ttlSeconds?: number, now?: number }} [opts]
 * @returns {{ token: string, address: string, expiresAt: string }}
 */
function issueSessionToken(address, { ttlSeconds = SESSION_TTL_SECONDS, now = Date.now() } = {}) {
  const secret = getSessionSecret();
  if (!secret) {
    throw new Error('AGENT_SESSION_SECRET (or TOKEN_SECRET/JWT_SECRET) not configured');
  }
  const normalized = String(address).toLowerCase();
  const iat = Math.floor(now / 1000);
  const exp = iat + ttlSeconds;
  const payload = {
    sub: normalized,
    iss: ISSUER,
    iat,
    exp,
    jti: crypto.randomBytes(8).toString('hex'),
  };
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'agent-session' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return {
    token: `${header}.${body}.${signature}`,
    address: normalized,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

/**
 * Verify a session token. Returns the payload on success, null on any failure
 * (bad format, bad signature, expired, wrong issuer, no configured secret).
 * @param {string} token
 * @param {{ now?: number }} [opts]
 * @returns {{ sub: string, iss: string, iat: number, exp: number, jti: string } | null}
 */
function verifySessionToken(token, { now = Date.now() } = {}) {
  try {
    const secret = getSessionSecret();
    if (!secret || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${parts[0]}.${parts[1]}`)
      .digest('base64url');
    if (!timingSafeStringEqual(expected, parts[2])) return null;

    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
    if (payload.iss !== ISSUER) return null;
    if (typeof payload.sub !== 'string' || !/^0x[a-f0-9]{40}$/.test(payload.sub)) return null;
    if (typeof payload.exp !== 'number' || now / 1000 >= payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

module.exports = {
  issueSessionToken,
  verifySessionToken,
  getSessionSecret,
  SESSION_TTL_SECONDS,
  CHALLENGE_TTL_SECONDS,
};