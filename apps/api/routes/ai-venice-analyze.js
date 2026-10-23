/**
 * Vision frame analysis route for Live AR sessions.
 *
 * Delegates to the shared provider chain in lib/vision.js — historically
 * Venice-only (qwen3-vl-235b-a22b), now falls through configured providers
 * so a single dead key can't take the session down. The `provider` and
 * `model` fields in the response reflect whichever provider actually served.
 *
 * Enforces per-session frame rate limits.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const vision = require('../lib/vision');
const { checkFrameRate, PROMPTS_BY_GOAL } = require('../lib/frame-rate');

// Track frame count per session for prompt rotation
const sessionFrameCount = new Map();

router.post('/', async (req, res) => {
  try {
    const { image, goal, systemInstruction } = req.body;

    if (!image || !goal) {
      return res.status(400).json({ error: 'Missing required fields: image, goal' });
    }

    if (vision.configuredProviders().length === 0) {
      return res.status(503).json({ error: 'No vision providers are configured' });
    }

    // Enforce per-IP frame rate limit
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const frameCheck = await checkFrameRate(clientIp, 'venice-frames', 20);
    if (!frameCheck.allowed) {
      return res.status(429).json({
        error: 'Frame rate limit exceeded',
        retryAfter: 60,
      });
    }

    // Get prompt for goal with rotation
    const clientId = req.ip || 'default';
    const prompts = PROMPTS_BY_GOAL[goal] || PROMPTS_BY_GOAL.daily;
    const frameCount = (sessionFrameCount.get(clientId) || 0) + 1;
    sessionFrameCount.set(clientId, frameCount);
    const prompt = prompts[(frameCount - 1) % prompts.length] || prompts[0] || "Analyze this outfit.";

    // Strip data URL prefix if present
    const base64Image = image.replace(/^data:image\/\w+;base64,/, '');

    const result = await vision.completeVision({
      system: systemInstruction ||
        'You are a fashion stylist AI analyzing video frames. Provide concise, actionable styling feedback. Keep responses under 100 words.',
      prompt,
      imageDataUrl: `data:image/jpeg;base64,${base64Image}`,
      maxTokens: 150,
      temperature: 0.7,
      expectJson: false,
    });

    res.json({
      analysis: result.text,
      frameCount,
      model: result.model,
      provider: result.provider,
    });
  } catch (error) {
    logger.error('Vision frame analysis failed', {
      component: 'venice-analyze',
      error: error.message,
      goal: req.body?.goal,
      clientIp: req.ip,
    });
    const unavailable = error.code === 'VISION_UNAVAILABLE';
    res.status(unavailable ? 503 : 502).json({
      error: unavailable ? 'All vision providers failed' : 'Vision analysis failed',
    });
  }
});

module.exports = router;
