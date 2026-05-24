/**
 * Live Session Provisioning Route
 * 
 * Provisions AI live sessions (Venice or Gemini Live).
 * Handles authentication, session limits, and session tokens.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');

// ── Redis-backed session tracking (prevent abuse) ──
// Each router instance shares the app-level Redis via req.app
let redis = null;

function getRedis() {
  if (!redis) {
    redis = require('ioredis')(
      process.env.REDIS_URL || 'redis://localhost:6379',
    );
  }
  return redis;
}

const SESSION_LIMITS = {
  venice: { maxFrames: 20, windowSecs: 60, maxDuration: 300 },
  gemini: { maxDuration: 1800 },
};

async function enforceVeniceLimits(clientIp) {
  const r = getRedis();
  const frameKey = `venice-frames:${clientIp}`;

  const count = await r.incr(frameKey);
  await r.expire(frameKey, SESSION_LIMITS.venice.windowSecs);

  if (count > SESSION_LIMITS.venice.maxFrames) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: SESSION_LIMITS.venice.maxFrames - count };
}

async function checkActiveSession(clientIp, provider) {
  const r = getRedis();
  const sessionKey = `session:${provider}:${clientIp}`;
  const active = await r.get(sessionKey);
  if (active) {
    const started = parseInt(active, 10);
    const elapsed = (Date.now() - started) / 1000;
    const limit = SESSION_LIMITS[provider]?.maxDuration || 300;
    const remaining = Math.max(0, limit - elapsed);

    if (remaining > 0) {
      return { active: true, remaining: remaining, started: started * 1000 };
    }
  }
  return { active: false, remaining: 0, started: 0 };
}

async function startSession(clientIp, provider, duration) {
  const r = getRedis();
  const sessionKey = `session:${provider}:${clientIp}`;
  await r.set(sessionKey, String(Date.now()), 'EX', duration);
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
        return res.status(429).json({
          error: 'Venice session already active',
          retryAfter: Math.round(active.remaining),
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
    const r = getRedis();
    await r.del(`session:${provider}:${clientIp}`);
  }

  res.json({ success: true });
});

module.exports = router;
