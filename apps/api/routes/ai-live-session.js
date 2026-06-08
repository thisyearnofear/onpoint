/**
 * Live Session Provisioning Route
 * 
 * Provisions AI live sessions (Venice or Gemini Live).
 * Handles authentication, session limits, and session tokens.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

// ── Session tracking (prevent abuse) ──
// Prefer Redis when configured, but keep live camera available with an
// in-memory fallback if Redis is absent or temporarily unavailable.
let redis = null;
let redisUnavailable = false;
const memoryStore = new Map();

function memoryGet(key) {
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt <= Date.now()) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

function memorySet(key, value, ttlSecs) {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSecs ? Date.now() + ttlSecs * 1000 : null,
  });
}

function memoryDel(key) {
  memoryStore.delete(key);
}

function memoryIncr(key, ttlSecs) {
  const current = Number(memoryGet(key) || 0) + 1;
  memorySet(key, String(current), ttlSecs);
  return current;
}

function getRedis() {
  if (redisUnavailable || !process.env.REDIS_URL) {
    return null;
  }
  if (!redis) {
    redis = require('ioredis')(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
    });
    redis.on('error', (error) => {
      redisUnavailable = true;
      logger.warn?.('Redis unavailable for live sessions, using memory fallback', {
        component: 'live-session',
        error: error?.message,
      });
    });
  }
  return redis;
}

async function redisOrMemory(operation, fallback) {
  const r = getRedis();
  if (!r) return fallback();
  try {
    if (r.status === 'wait') {
      await r.connect();
    }
    return await operation(r);
  } catch (error) {
    redisUnavailable = true;
    logger.warn?.('Live session Redis operation failed, using memory fallback', {
      component: 'live-session',
      error: error?.message,
    });
    return fallback();
  }
}

const SESSION_LIMITS = {
  venice: { maxFrames: 20, windowSecs: 60, maxDuration: 300 },
  gemini: { maxDuration: 1800 },
};

async function enforceVeniceLimits(clientIp) {
  const frameKey = `venice-frames:${clientIp}`;

  const count = await redisOrMemory(
    async (r) => {
      const next = await r.incr(frameKey);
      await r.expire(frameKey, SESSION_LIMITS.venice.windowSecs);
      return next;
    },
    () => memoryIncr(frameKey, SESSION_LIMITS.venice.windowSecs),
  );

  if (count > SESSION_LIMITS.venice.maxFrames) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: SESSION_LIMITS.venice.maxFrames - count };
}

async function checkActiveSession(clientIp, provider) {
  const sessionKey = `session:${provider}:${clientIp}`;
  const active = await redisOrMemory(
    (r) => r.get(sessionKey),
    () => memoryGet(sessionKey),
  );
  if (active) {
    const started = parseInt(active, 10);
    const elapsed = (Date.now() - started) / 1000;
    const limit = SESSION_LIMITS[provider]?.maxDuration || 300;
    const remaining = Math.max(0, limit - elapsed);

    if (remaining > 0) {
      return { active: true, remaining: remaining, started };
    }
  }
  return { active: false, remaining: 0, started: 0 };
}

async function startSession(clientIp, provider, duration) {
  const sessionKey = `session:${provider}:${clientIp}`;
  await redisOrMemory(
    (r) => r.set(sessionKey, String(Date.now()), 'EX', duration),
    () => memorySet(sessionKey, String(Date.now()), duration),
  );
}

async function endSession(clientIp, provider) {
  const sessionKey = `session:${provider}:${clientIp}`;
  await redisOrMemory(
    (r) => r.del(sessionKey),
    () => memoryDel(sessionKey),
  );
}

// ── Routes ──

router.get('/limits', async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const veniceCheck = await enforceVeniceLimits(clientIp);
  const veniceSession = await checkActiveSession(clientIp, 'venice');
  const geminiSession = await checkActiveSession(clientIp, 'gemini');

  res.json({
    venice: {
      framesPerMinute: SESSION_LIMITS.venice.maxFrames,
      framesRemaining: veniceCheck.remaining,
      maxSessionDuration: SESSION_LIMITS.venice.maxDuration,
      activeSession: veniceSession.active,
      sessionRemaining: Math.round(veniceSession.remaining),
    },
    gemini: {
      maxSessionDuration: SESSION_LIMITS.gemini.maxDuration,
      activeSession: geminiSession.active,
      sessionRemaining: Math.round(geminiSession.remaining),
    },
  });
});

router.post('/', async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';

  try {
    const { provider, goal, systemInstruction, byok, sessionToken } = req.body;

    if (!provider || !goal) {
      return res.status(400).json({ error: 'Missing required fields: provider, goal' });
    }

    // Venice AI - Free tier (uses our API key)
    if (provider === 'venice') {
      const active = await checkActiveSession(clientIp, 'venice');
      if (active.active) {
        await startSession(clientIp, 'venice', SESSION_LIMITS.venice.maxDuration);
        return res.json({
          success: true,
          provider: 'venice',
          resumed: true,
          config: {
            pollingInterval: 3000,
            model: 'qwen3-vl-235b-a22b',
            endpoint: '/api/ai/venice-analyze',
          },
          limits: {
            framesPerMinute: SESSION_LIMITS.venice.maxFrames,
            maxSessionDuration: SESSION_LIMITS.venice.maxDuration,
          },
        });
      }

      const frameCheck = await enforceVeniceLimits(clientIp);
      if (!frameCheck.allowed) {
        return res.status(429).json({
          error: 'Venice frame rate exhausted',
          retryAfter: 60,
        });
      }

      await startSession(clientIp, 'venice', SESSION_LIMITS.venice.maxDuration);

      return res.json({
        success: true,
        provider: 'venice',
        config: {
          pollingInterval: 3000,
          model: 'qwen3-vl-235b-a22b',
          endpoint: '/api/ai/venice-analyze',
        },
        limits: {
          framesPerMinute: SESSION_LIMITS.venice.maxFrames,
          maxSessionDuration: SESSION_LIMITS.venice.maxDuration,
        },
      });
    }

    // Gemini Live - Premium (requires payment or BYOK)
    if (provider === 'gemini') {
      const geminiApiKey = byok || process.env.GOOGLE_GEMINI_API_KEY;

      if (!geminiApiKey && !sessionToken) {
        return res.status(402).json({
          error: 'Gemini Live requires payment or your own API key.',
          byokRequired: true,
          paymentRequired: true,
        });
      }

      if (sessionToken) {
        try {
          const crypto = require('crypto');
          const tokenSecret = process.env.TOKEN_SECRET || process.env.JWT_SECRET || 'dev-secret';
          const parts = sessionToken.split('.');
          if (parts.length !== 3) {
            return res.status(403).json({ error: 'Invalid session token format' });
          }
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
          const signature = crypto
            .createHmac('sha256', tokenSecret)
            .update(`${parts[0]}.${parts[1]}`)
            .digest('base64url');

          if (signature !== parts[2]) {
            return res.status(403).json({ error: 'Invalid session token signature' });
          }
          if (Date.now() / 1000 > payload.exp) {
            return res.status(403).json({ error: 'Session token expired' });
          }
        } catch {
          return res.status(403).json({ error: 'Invalid session token' });
        }
      }

      await startSession(clientIp, 'gemini', SESSION_LIMITS.gemini.maxDuration);

      return res.json({
        success: true,
        provider: 'gemini',
        config: {
          apiKey: geminiApiKey,
          baseURL: 'wss://generativelanguage.googleapis.com/ws',
          model: 'models/gemini-2.0-flash-live-001',
          systemInstruction,
        },
        limits: {
          maxSessionDuration: SESSION_LIMITS.gemini.maxDuration,
          unlimited: true,
        },
      });
    }

    return res.status(400).json({ error: 'Invalid provider. Use "venice" or "gemini".' });
  } catch (error) {
    logger.sessionError('provision', 'Live session provisioning failed', error, {
      provider: req.body?.provider,
      clientIp,
    });
    res.status(500).json({ error: 'Failed to provision session' });
  }
});

// ── Session heartbeat (client calls periodically) ──

router.post('/heartbeat', async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const { provider } = req.body;

  if (!provider) {
    return res.status(400).json({ error: 'Missing provider' });
  }

  const active = await checkActiveSession(clientIp, provider);
  if (!active.active) {
    return res.status(410).json({ error: 'Session expired', sessionExpired: true });
  }

  res.json({ active: true, remaining: Math.round(active.remaining) });
});

// ── Session teardown (client calls on end) ──

router.post('/end', async (req, res) => {
  const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  const { provider } = req.body;

  if (provider) {
    await endSession(clientIp, provider);
  }

  res.json({ success: true });
});

module.exports = router;
