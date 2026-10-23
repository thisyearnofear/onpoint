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
const logger = require('../lib/logger');
const vision = require('../lib/vision');
const { getRedis } = require('../lib/redis');
const { checkFrameRate, PROMPTS_BY_GOAL } = require('../lib/frame-rate');

const ZERO_G_BASE_URL =
  process.env.ZERO_G_BASE_URL || 'https://router-api.0g.ai/v1';
const ZERO_G_DEFAULT_MODEL = process.env.ZERO_G_MODEL || 'qwen3-vl-30b';
const ZERO_G_CHAT_MODEL = process.env.ZERO_G_CHAT_MODEL || ZERO_G_DEFAULT_MODEL;
const ZERO_G_TIMEOUT_MS = process.env.ZERO_G_TIMEOUT_MS
  ? parseInt(process.env.ZERO_G_TIMEOUT_MS, 10)
  : 20000;

const zerogConfigured = Boolean(process.env.ZERO_G_API_KEY);

// Redis-backed frame rate enforcement (separate bucket from Venice / Replicate
// so a busy 0G session doesn't penalize other providers).
//
// Redis is OPTIONAL — when REDIS_URL is unset or the connection fails,
// we fall through to an in-memory counter so the route stays available.
// This matches the pattern used elsewhere in the API (see agent-live-session).

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

    if (!zerogConfigured && vision.configuredProviders().length === 0) {
      return res
        .status(503)
        .json({ error: '0G Compute is not configured (ZERO_G_API_KEY missing)' });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const frameCheck = await checkFrameRate(clientIp, 'zerog-frames', 30);
    if (!frameCheck.allowed) {
      return res.status(429).json({
        error: 'Frame rate limit exceeded',
        retryAfter: 60,
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
    const systemMsg =
      systemInstruction ||
      'You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.';

    // Primary path: 0G Router. Uses raw fetch (not the OpenAI SDK) so the
    // response envelope includes the `x_0g_trace` field carrying the TEE
    // proof — the SDK strips unknown fields and would lose tee_verified.
    // On any 0G failure (or missing key), fall back to the shared vision
    // chain; the response then reports the real provider and
    // tee_verified: false.
    if (zerogConfigured) {
      try {
        const requestBody = {
          model: model || ZERO_G_DEFAULT_MODEL,
          messages: [
            { role: 'system', content: systemMsg },
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

        return res.json({
          analysis,
          frameCount,
          model: data.model || requestBody.model,
          provider: '0g',
          tee_verified: trace.tee_verified === true,
          tee_provider: trace.provider || null,
          tee_request_id: trace.request_id || null,
          billing: trace.billing || null,
        });
      } catch (err) {
        logger.warn('0G analysis failed, falling back to vision chain', {
          component: 'zero-g-analyze',
          error: err.message,
        });
      }
    }

    const result = await vision.completeVision({
      system: systemMsg,
      prompt,
      imageDataUrl: `data:image/jpeg;base64,${base64Image}`,
      maxTokens: 200,
      temperature: 0.7,
      expectJson: false,
    });

    res.json({
      analysis: result.text,
      frameCount,
      model: result.model,
      provider: result.provider,
      tee_verified: false,
      tee_provider: null,
      tee_request_id: null,
      billing: null,
      fallback: 'vision-chain',
    });
  } catch (error) {
    logger.error('0G Compute analysis failed', {
      component: 'zero-g-analyze',
      error: error.message,
      goal: req.body?.goal,
      clientIp: req.ip,
    });
    const unavailable = error.code === 'VISION_UNAVAILABLE';
    res.status(unavailable ? 503 : 502).json({
      error: unavailable ? 'All vision providers failed' : '0G Compute analysis failed',
    });
  }
});

module.exports = router;
