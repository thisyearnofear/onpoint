/**
 * Qwen Cloud (DashScope) — analysis route.
 *
 * Qwen Cloud Hackathon, Track 4: Autopilot Agent. Mirrors
 * apps/api/routes/ai-zerog-analyze.js but calls Qwen Cloud directly
 * (https://dashscope-intl.aliyuncs.com/compatible-mode/v1) instead of
 * the 0G Compute Router. This is the first-party Qwen Cloud integration
 * the hackathon requires.
 *
 * Default model is qwen3-vl-flash — the cheapest vision-capable model
 * on the Qwen Cloud catalog ($0.05/$0.40 per 1M tokens). The route
 * enforces spend guards (kill switch, daily budget, max_tokens caps,
 * enable_thinking: false) inline so it is self-contained in the
 * CommonJS API server. The canonical TS client lives in
 * packages/qwen-cloud/src/client.ts and is used by the autopilot
 * script and MCP server.
 *
 * Mounted in server.js. Called by the qwen-cloud live-session factory
 * in packages/ai-client/src/providers/live-session-factories.ts.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { getRedis } = require('../lib/redis');
const { checkFrameRate, PROMPTS_BY_GOAL } = require('../lib/frame-rate');

// ── Spend controls (env-driven) ────────────────────────────────
const QWEN_CLOUD_BASE_URL =
  process.env.QWEN_CLOUD_BASE_URL ||
  'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';
const QWEN_CLOUD_DEFAULT_MODEL =
  process.env.QWEN_CLOUD_VISION_MODEL || 'qwen3-vl-flash';
const QWEN_CLOUD_CHAT_MODEL =
  process.env.QWEN_CLOUD_CHAT_MODEL || 'qwen3.6-flash';
const QWEN_CLOUD_TIMEOUT_MS = process.env.QWEN_CLOUD_TIMEOUT_MS
  ? parseInt(process.env.QWEN_CLOUD_TIMEOUT_MS, 10)
  : 20000;
const DAILY_BUDGET_USD = process.env.QWEN_CLOUD_DAILY_BUDGET_USD
  ? Number(process.env.QWEN_CLOUD_DAILY_BUDGET_USD)
  : 1.0;
const KILL_SWITCH = process.env.QWEN_CLOUD_KILL_SWITCH === '1';

// In-memory daily spend tracker (per-process). Resets at UTC midnight.
let dailySpendUsd = 0;
let dailyResetAt = Date.now();
function maybeResetDaily() {
  if (Date.now() - dailyResetAt > 86400000) {
    dailySpendUsd = 0;
    dailyResetAt = Date.now();
  }
}

const PRICING = {
  'qwen3-vl-flash': { in: 0.05, out: 0.4 },
  'qwen3-vl-plus': { in: 0.2, out: 1.6 },
  'qwen3.6-flash': { in: 0.25, out: 1.5 },
  'qwen3.7-plus': { in: 0.4, out: 1.6 },
  'qwen3.7-max': { in: 2.5, out: 7.5 },
};

function estimateCost(model, promptTokens, completionTokens) {
  const p = PRICING[model] || PRICING['qwen3-vl-flash'];
  return (
    Math.round(((promptTokens / 1e6) * p.in + (completionTokens / 1e6) * p.out) * 1e6) / 1e6
  );
}

// ── Goal-based prompts ────────────────────────────────────────
const sessionFrameCount = new Map();

// ── POST / ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  try {
    const { image, goal, systemInstruction, model, enable_thinking } = req.body;

    if (!image || !goal) {
      return res
        .status(400)
        .json({ error: 'Missing required fields: image, goal' });
    }

    if (!process.env.DASHSCOPE_API_KEY) {
      return res.status(503).json({
        error: 'Qwen Cloud is not configured (DASHSCOPE_API_KEY missing)',
      });
    }

    if (KILL_SWITCH) {
      return res.status(503).json({
        error: 'Qwen Cloud kill switch is active (QWEN_CLOUD_KILL_SWITCH=1)',
      });
    }

    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const frameCheck = await checkFrameRate(clientIp, 'qwen-cloud-frames', 30);
    if (!frameCheck.allowed) {
      return res.status(429).json({
        error: 'Frame rate limit exceeded',
        retryAfter: 60,
      });
    }

    // Spend guard — pre-call estimate
    maybeResetDaily();
    const requestedModel = model || QWEN_CLOUD_DEFAULT_MODEL;
    const maxTokens = 200;
    const preCost = estimateCost(requestedModel, 500, maxTokens);
    if (DAILY_BUDGET_USD > 0 && dailySpendUsd + preCost >= DAILY_BUDGET_USD) {
      return res.status(429).json({
        error: 'Qwen Cloud daily budget exceeded',
        spentUsd: dailySpendUsd.toFixed(6),
        budgetUsd: DAILY_BUDGET_USD,
        code: 'BUDGET_EXCEEDED',
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

    const requestBody = {
      model: requestedModel,
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
      max_tokens: maxTokens,
      temperature: 0.7,
      // Disable thinking by default — it generates hundreds of hidden
      // reasoning tokens that cost money. Callers must opt in.
      enable_thinking: enable_thinking === true ? true : false,
    };

    const response = await fetch(`${QWEN_CLOUD_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(QWEN_CLOUD_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      logger.error('Qwen Cloud rejected request', {
        component: 'qwen-cloud-analyze',
        status: response.status,
        body: errBody.slice(0, 200),
        keyLength: (process.env.DASHSCOPE_API_KEY ?? '').length,
        keyPrefix: (process.env.DASHSCOPE_API_KEY ?? '').slice(0, 8),
      });
      throw new Error(`Qwen Cloud error ${response.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await response.json();
    const analysis = data.choices?.[0]?.message?.content || '';
    const actualCost = estimateCost(
      data.model || requestedModel,
      data.usage?.prompt_tokens || 0,
      data.usage?.completion_tokens || 0,
    );
    dailySpendUsd += actualCost;

    res.json({
      analysis,
      frameCount,
      model: data.model || requestedModel,
      provider: 'qwen-cloud',
      // Qwen Cloud does not currently surface TEE attestation.
      // The trace field is reserved for future use.
      usage: data.usage,
      estimatedCostUsd: actualCost,
      dailySpendUsd: dailySpendUsd.toFixed(6),
      dailyBudgetUsd: DAILY_BUDGET_USD,
    });
  } catch (error) {
    logger.error('Qwen Cloud analysis failed', {
      component: 'qwen-cloud-analyze',
      error: error.message,
      goal: req.body?.goal,
      clientIp: req.ip,
    });
    res.status(502).json({ error: 'Qwen Cloud analysis failed' });
  }
});

module.exports = router;
