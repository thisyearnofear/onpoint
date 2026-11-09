/**
 * Link-agent OTP — two-sided consent for curator ↔ agent linking.
 *
 * Closes the "phone number as password" hole: the old route overwrote
 * `curators.linkedAgentAddress` for anyone who guessed the WhatsApp number.
 *
 * New flow (no new DB columns — deploys lack auto-migration):
 *   1. Curator (owner wallet session) POST .../link-agent/request
 *      → server sends a 6-digit OTP to the *stored* WhatsApp number via Linq.
 *   2. Curator POST .../link-agent/verify { otp, agentAddress, agentToken }
 *      → server verifies OTP (hashed, 10-min TTL, max 3 attempts,
 *        constant-time compare) + verifies `agentToken` is a valid wallet
 *        session whose sub == agentAddress (agent-side consent).
 *      → only then writes linkedAgentAddress.
 *
 * Rate limiting: 5 OTP sends / phone / hour (Redis or in-memory).
 * Audit: every request/verify/change is logger.info with who/when/from/to.
 * A `curator_link_events` table is the intended durable audit once migrations
 * are available — until then the structured log is the audit trail.
 */

const crypto = require('crypto');
const { timingSafeStringEqual } = require('../middleware/service-key-auth');

const OTP_TTL_SECONDS = 10 * 60;
const OTP_MAX_ATTEMPTS = 3;
const OTP_SEND_LIMIT = 5;
const OTP_SEND_WINDOW_SECONDS = 3600;

function isProdLike() {
  return process.env.NODE_ENV !== 'development' && process.env.NODE_ENV !== 'test';
}

function getOtpSecret() {
  const secret =
    process.env.LINK_OTP_SECRET ||
    process.env.AGENT_SESSION_SECRET ||
    process.env.TOKEN_SECRET ||
    process.env.JWT_SECRET;
  if (secret) return secret;
  return isProdLike() ? null : 'link-otp-local-dev-only';
}

function normalizePhone(phone) {
  return String(phone || '').replace(/\s/g, '');
}

function generateOtp() {
  return String(crypto.randomInt(100000, 1000000));
}

function hashOtp(otp) {
  const secret = getOtpSecret();
  if (!secret) throw new Error('LINK_OTP_SECRET (or AGENT_SESSION_SECRET) not configured');
  return crypto.createHmac('sha256', secret).update(String(otp)).digest('hex');
}

function otpKey(slug) {
  return `link-otp:${String(slug).toLowerCase()}`;
}

function sendCountKey(phoneHash, bucket) {
  return `link-otp-send:${phoneHash}:${bucket}`;
}

function phoneHash(phone) {
  return crypto.createHash('sha256').update(normalizePhone(phone)).digest('hex').slice(0, 32);
}

// ── Memory store (dev/test/single-process) ──
function createMemoryLinkOtpStore() {
  const otps = new Map(); // slug -> { hash, expiresAt, attempts }
  const sends = new Map(); // sendKey -> { count, expiresAt }

  return {
    async canSend(phone) {
      const bucket = Math.floor(Date.now() / (OTP_SEND_WINDOW_SECONDS * 1000));
      const key = sendCountKey(phoneHash(phone), bucket);
      const entry = sends.get(key);
      if (entry && entry.expiresAt <= Date.now()) sends.delete(key);
      const count = sends.get(key)?.count || 0;
      return { allowed: count < OTP_SEND_LIMIT, remaining: Math.max(0, OTP_SEND_LIMIT - count) };
    },
    async recordSend(phone) {
      const bucket = Math.floor(Date.now() / (OTP_SEND_WINDOW_SECONDS * 1000));
      const key = sendCountKey(phoneHash(phone), bucket);
      const entry = sends.get(key);
      if (!entry || entry.expiresAt <= Date.now()) {
        sends.set(key, { count: 1, expiresAt: Date.now() + OTP_SEND_WINDOW_SECONDS * 1000 });
      } else {
        entry.count += 1;
      }
    },
    async saveOtp(slug, hash, ttlSeconds = OTP_TTL_SECONDS) {
      otps.set(otpKey(slug), { hash, expiresAt: Date.now() + ttlSeconds * 1000, attempts: 0 });
    },
    async getOtp(slug) {
      const entry = otps.get(otpKey(slug));
      if (!entry) return null;
      if (entry.expiresAt <= Date.now()) {
        otps.delete(otpKey(slug));
        return null;
      }
      return entry;
    },
    async consumeAttempt(slug) {
      const key = otpKey(slug);
      const entry = otps.get(key);
      if (!entry) return null;
      entry.attempts += 1;
      if (entry.attempts >= OTP_MAX_ATTEMPTS) {
        otps.delete(key);
        return { ...entry, locked: true };
      }
      otps.set(key, entry);
      return { ...entry, locked: false };
    },
    async clearOtp(slug) {
      otps.delete(otpKey(slug));
    },
    // test-only
    _reset() {
      otps.clear();
      sends.clear();
    },
  };
}

// ── Redis store (production multi-instance) ──
function createRedisLinkOtpStore(redis) {
  return {
    async canSend(phone) {
      const bucket = Math.floor(Date.now() / (OTP_SEND_WINDOW_SECONDS * 1000));
      const key = sendCountKey(phoneHash(phone), bucket);
      const count = Number(await redis.get(key)) || 0;
      return { allowed: count < OTP_SEND_LIMIT, remaining: Math.max(0, OTP_SEND_LIMIT - count) };
    },
    async recordSend(phone) {
      const bucket = Math.floor(Date.now() / (OTP_SEND_WINDOW_SECONDS * 1000));
      const key = sendCountKey(phoneHash(phone), bucket);
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, OTP_SEND_WINDOW_SECONDS);
    },
    async saveOtp(slug, hash, ttlSeconds = OTP_TTL_SECONDS) {
      await redis.set(otpKey(slug), JSON.stringify({ hash, attempts: 0 }), 'EX', ttlSeconds);
    },
    async getOtp(slug) {
      const raw = await redis.get(otpKey(slug));
      if (!raw) return null;
      try {
        const parsed = JSON.parse(raw);
        const ttl = await redis.ttl(otpKey(slug));
        return { ...parsed, expiresAt: Date.now() + Math.max(0, ttl) * 1000 };
      } catch {
        return null;
      }
    },
    async consumeAttempt(slug) {
      const key = otpKey(slug);
      const raw = await redis.get(key);
      if (!raw) return null;
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        return null;
      }
      parsed.attempts = (parsed.attempts || 0) + 1;
      if (parsed.attempts >= OTP_MAX_ATTEMPTS) {
        await redis.del(key);
        return { ...parsed, expiresAt: Date.now(), locked: true };
      }
      const ttl = await redis.ttl(key);
      await redis.set(key, JSON.stringify(parsed), 'EX', Math.max(1, ttl > 0 ? ttl : OTP_TTL_SECONDS));
      return { ...parsed, expiresAt: Date.now() + OTP_TTL_SECONDS * 1000, locked: false };
    },
    async clearOtp(slug) {
      await redis.del(otpKey(slug));
    },
  };
}

function verifyOtpFormat(otp) {
  return typeof otp === 'string' && /^\d{6}$/.test(otp);
}

module.exports = {
  OTP_TTL_SECONDS,
  OTP_MAX_ATTEMPTS,
  OTP_SEND_LIMIT,
  normalizePhone,
  generateOtp,
  hashOtp,
  verifyOtpFormat,
  timingSafeStringEqual,
  createMemoryLinkOtpStore,
  createRedisLinkOtpStore,
};
