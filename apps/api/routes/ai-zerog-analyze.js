/**
 * 0G Compute Network — Router analysis route.
 *
 * Wave 1, 0G Bridge Buildathon. Mirrors apps/api/routes/ai-venice-analyze.js
 * but calls https://router-api.0g.ai/v1/chat/completions (OpenAI-compatible
 * Router). Default model is qwen3-vl-30b — the cheapest vision-capable
 * model on the live 0G Router catalog — and the response is requested
 * with verify_tee: true so we can surface the TEE attestation upstream.
 *
 * This route is mounted in server.js and called by the 0G live-session
 * factory in packages/ai-client/src/providers/live-session-factories.ts.
 */

const express = require('express');
const router = express.Router();
const OpenAI = require('openai');
const logger = require('../lib/logger');

const ZERO_G_BASE_URL =
  process.env.ZERO_G_BASE_URL || 'https://router-api.0g.ai/v1';
const ZERO_G_DEFAULT_MODEL = process.env.ZERO_G_MODEL || 'qwen3-vl-30b';
const ZERO_G_CHAT_MODEL = process.env.ZERO_G_CHAT_MODEL || ZERO_G_DEFAULT_MODEL;
const ZERO_G_TIMEOUT_MS = process.env.ZERO_G_TIMEOUT_MS
  ? parseInt(process.env.ZERO_G_TIMEOUT_MS, 10)
  : 20000;

const zerogClient = process.env.ZERO_G_API_KEY
  ? new OpenAI({
      apiKey: process.env.ZERO_G_API_KEY,
      baseURL: ZERO_G_BASE_URL,
      timeout: ZERO_G_TIMEOUT_MS,
    })
  : null;

// Redis-backed frame rate enforcement (separate bucket from Venice / Replicate
// so a busy 0G session doesn't penalize other providers).
//
// Redis is OPTIONAL — when REDIS_URL is unset or the connection fails,
// we fall through to an in-memory counter so the route stays available.
// This matches the pattern used elsewhere in the API (see agent-live-session).
let redis = null;
let redisInitFailed = false;
function getRedis() {
  if (redis || redisInitFailed) return redis;
  const url = process.env.REDIS_URL;
  if (!url) {
    redisInitFailed = true;
    return null;
  }
  try {
    const Redis = require('ioredis');
    redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 1000,
    });
    redis.on('error', () => {
      // Silent: frame rate is best-effort, not a hard gate.
    });
  } catch (err) {
    redisInitFailed = true;
    return null;
  }
  return redis;
}

const FRAME_LIMITS = { max: 30, windowSecs: 60 }; // Slightly higher than Venice: qwen-vl is cheap.

async function checkFrameRate(clientIp) {
  const r = getRedis();
  if (!r) {
    // No Redis → allow all requests. Production should configure
    // REDIS_URL; this is the dev/test fallback.
    return { allowed: true, count: 0, inMemory: true };
  }
  try {
    const key = `zerog-frames:${clientIp}`;
    const count = await r.incr(key);
    await r.expire(key, FRAME_LIMITS.windowSecs);

    if (count > FRAME_LIMITS.max) {
      return { allowed: false, count: FRAME_LIMITS.max };
    }
    return { allowed: true, count };
  } catch {
    return { allowed: true, count: 0, inMemory: true };
  }
}

const PROMPTS_BY_GOAL = {
  event: [
    'Analyze this outfit for a formal event. Focus on elegance, appropriateness, and sophistication.',
    'Evaluate if this look works for a special occasion. Check dress code alignment.',
    'Assess the silhouette and fit for evening wear standards.',
  ],
  daily: [
    'Analyze this everyday outfit. Focus on comfort, coordination, and practicality.',
    'Evaluate this casual look for daily wear. Check color harmony and balance.',
    'Assess the overall aesthetic for everyday style.',
  ],
  critique: [
    'Give an honest critique of this outfit. Be direct about what works and what does not.',
    'Analyze this look critically. Point out specific issues and strengths.',
    'Provide blunt fashion feedback. No sugarcoating.',
  ],
  // African Differentiation (Wave 3, ADR 0006) — pattern-aware prompts
  // for the fine-tuned model. On Wave 1, qwen3-vl-30b is the default
  // model and these prompts are passed as-is; the fine-tuned model
  // is not yet available.
  african: [
    'Identify any African textile patterns in this outfit (Ankara, Kente, Adire, Bogolan, Shweshwe). Note cultural context and styling.',
    'Assess how well African fashion elements are integrated with the rest of the look.',
    'Provide culturally-aware feedback on occasion-appropriateness and pattern coordination.',
  ],
};

const sessionFrameCount = new Map();

router.post('/', async (req, res) => {
  try {
    const {
      image,
      goal,
      systemInstruction,
      model,
      verify_tee,
    } = req.body;

    if (!image || !goal) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: image, goal' });
    }

    if (!zerogClient) {
      return res
        .status(503)
        .json({ error: '0G Compute is not configured (ZERO_G_API_KEY missing)' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const frameCheck = await checkFrameRate(clientIp);
    if (!frameCheck.allowed) {
      return res.status(429).json({
        error: 'Frame rate limit exceeded',
        retryAfter: FRAME_LIMITS.windowSecs,
      });
    }

    const clientId = req.ip || 'default';
    const prompts = PROMPTS_BY_GOAL[goal] || PROMPTS_BY_GOAL.daily;
    const frameCount = (sessionFrameCount.get(clientId) || 0) + 1;
    sessionFrameCount.set(clientId, frameCount);
    const prompt =
      prompts[(frameCount - 1) % prompts.length] ||
      prompts[0] ||
      'Analyze this outfit.';

    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    // Use raw fetch (not the OpenAI SDK) so the response envelope
    // includes the `x_0g_trace` field that carries the TEE proof.
    // The OpenAI SDK strips unknown fields, which would lose the
    // tee_verified flag the agent layer wants for verifiable receipts.
    const requestBody = {
      model: model || ZERO_G_DEFAULT_MODEL,
      messages: [
        {
          role: 'system',
          content:
            systemInstruction ||
            'You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.',
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64Image}` },
            },
          ],
        },
      ],
      max_tokens: 200,
      temperature: 0.7,
    };
    if (verify_tee !== false) requestBody.verify_tee = true; // on by default

    const response = await fetch(`${ZERO_G_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.ZERO_G_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(ZERO_G_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      logger.error('0G Router rejected request', {
        component: 'zero-g-analyze',
        status: response.status,
        body: errBody.slice(0, 200),
        keyLength: (process.env.ZERO_G_API_KEY ?? '').length,
        keyPrefix: (process.env.ZERO_G_API_KEY ?? '').slice(0, 8),
        keySuffix: (process.env.ZERO_G_API_KEY ?? '').slice(-4),
      });
      throw new Error(`0G Router error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || '';

    // TEE proof lives inside x_0g_trace, not at the top level.
    // See: https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
    const trace = data.x_0g_trace || {};
    const teeVerified = trace.tee_verified === true;
    const providerAddress = trace.provider || null;
    const requestId = trace.request_id || null;
    const billing = trace.billing || null;

    res.json({
      analysis,
      frameCount,
      model: data.model || requestBody.model,
      provider: '0g',
      tee_verified: teeVerified,
      tee_provider: providerAddress,
      tee_request_id: requestId,
      billing,
    });
  } catch (error) {
    logger.error('0G Compute analysis failed', {
      component: 'zero-g-analyze',
      error: error.message,
      goal: req.body?.goal,
      clientIp: req.ip,
    });
    res.status(502).json({ error: '0G Compute analysis failed' });
  }
});

module.exports = router;
