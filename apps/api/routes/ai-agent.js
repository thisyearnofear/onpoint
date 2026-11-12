/**
 * AI Agent Route — /api/ai/agent
 *
 * Provides agent-mediated AI analysis for fashion styling.
 * Accepts a photo and optional style preferences, returns
 * personalized outfit analysis and recommendations.
 *
 * This is the route that was orphaned on the Hetzner server
 * (existed on disk but wasn't mounted in server.js).
 * See ADR 0001 — Phase 1.
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const sandbase = require('../lib/sandbase');

const VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const ZERO_G_BASE_URL = process.env.ZERO_G_BASE_URL || 'https://router-api.0g.ai/v1';
const ZERO_G_DEFAULT_MODEL = process.env.ZERO_G_MODEL || 'qwen3-vl-30b';
const ZERO_G_CHAT_MODEL = process.env.ZERO_G_CHAT_MODEL || ZERO_G_DEFAULT_MODEL;

const OTARI_BASE_URL = process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1';
const OTARI_VISION_MODEL = process.env.OTARI_VISION_MODEL || process.env.OTARI_MODEL || null;
const OTARI_CHAT_MODEL = process.env.OTARI_CHAT_MODEL || process.env.OTARI_MODEL || null;

const ANALYZE_PROMPT = (prefContext) => `You are OnPoint, an AI fashion stylist. Analyze this person's appearance and outfit for styling purposes. Provide:

1. **Overall Style Assessment** — Describe their current look
2. **Body & Fit Notes** — Key observations for clothing recommendations
3. **Color Palette Analysis** — What works, what could be enhanced
4. **3 Specific Recommendations** — Actionable fashion suggestions
5. **Styling Score** — Rate 1-10 with brief justification${prefContext}

Keep it concise and actionable.`;

function prefContextFor(preferences = {}) {
  return Object.keys(preferences).length > 0
    ? `\nUser Preferences:
- Aesthetics: ${preferences.styleAesthetics?.join(', ') || 'Not specified'}
- Budget: ${preferences.budgetTier || 'Not specified'}
- Body Type: ${preferences.bodyType || 'Not specified'}
Tailor recommendations accordingly.`
    : '';
}

/**
 * Analyze a person's outfit via Otari (Mozilla AI) — primary gateway,
 * OpenAI-compatible. Requires OTARI_API_KEY + a vision model.
 *
 * `apiKeyOverride` is the caller's own Otari key (x-otari-key) — when
 * present, the call is metered and budget-capped in *their* Otari
 * workspace instead of ours. Otari stamps the settled server-side
 * cost on the response (`usage.cost_usd`); we surface it as aiCost.
 */
async function analyzeWithOtari(imageData, preferences = {}, apiKeyOverride = null) {
  const otariKey = apiKeyOverride || process.env.OTARI_API_KEY;
  if (!otariKey || !OTARI_VISION_MODEL || (!apiKeyOverride && process.env.OTARI_KILL_SWITCH === '1')) {
    throw new Error('OTARI_API_KEY / OTARI_VISION_MODEL not configured');
  }

  const response = await fetch(`${OTARI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${otariKey}`,
    },
    body: JSON.stringify({
      model: OTARI_VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYZE_PROMPT(prefContextFor(preferences)) },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Otari error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || OTARI_VISION_MODEL,
    costUsd: data.usage?.cost_usd != null ? Number(data.usage.cost_usd) : null,
    meteredBy: apiKeyOverride ? 'agent-workspace' : 'onpoint-workspace',
  };
}

/**
 * Analyze a person's outfit via Sandbase — the gateway that carries our
 * own inference spend, ahead of Otari in the chain.
 *
 * Sandbase answers with plain OpenAI `usage` and no cost field, so
 * `costUsd` is computed from the per-token prices on the model card.
 * When those prices cannot be read, costUsd stays null and the response
 * simply carries no aiCost.
 */
async function analyzeWithSandbase(imageData, preferences = {}) {
  const model = sandbase.visionModel();
  const key = sandbase.apiKey();
  if (!key || !model || !sandbase.configured()) {
    throw new Error('SANDBASE_API_KEY / SANDBASE_VISION_MODEL not configured');
  }

  const response = await fetch(`${sandbase.baseURL()}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: ANALYZE_PROMPT(prefContextFor(preferences)) },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
    signal: AbortSignal.timeout(sandbase.timeoutMs()),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Sandbase error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return {
    content: data.choices?.[0]?.message?.content || '',
    model: data.model || model,
    costUsd: await sandbase.costUsd(model, data.usage),
    meteredBy: 'onpoint-workspace',
  };
}

/**
 * Analyze a person's outfit via Venice Vision API
 */
async function analyzeWithVenice(imageData, preferences = {}) {
  const veniceKey = process.env.VENICE_API_KEY;
  if (!veniceKey) {
    throw new Error('VENICE_API_KEY not configured');
  }

  const prefContext = Object.keys(preferences).length > 0
    ? `\nUser Preferences:
- Aesthetics: ${preferences.styleAesthetics?.join(', ') || 'Not specified'}
- Budget: ${preferences.budgetTier || 'Not specified'}
- Body Type: ${preferences.bodyType || 'Not specified'}
Tailor recommendations accordingly.`
    : '';

  const response = await fetch(`${VENICE_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${veniceKey}`,
    },
    body: JSON.stringify({
      model: 'qwen3-vl-235b-a22b',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are OnPoint, an AI fashion stylist. Analyze this person's appearance and outfit for styling purposes. Provide:

1. **Overall Style Assessment** — Describe their current look
2. **Body & Fit Notes** — Key observations for clothing recommendations
3. **Color Palette Analysis** — What works, what could be enhanced
4. **3 Specific Recommendations** — Actionable fashion suggestions
5. **Styling Score** — Rate 1-10 with brief justification${prefContext}

Keep it concise and actionable.`,
            },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`Venice API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

/**
 * Analyze a person's outfit via 0G Compute Router (OpenAI-compatible).
 *
 * Wave 1, 0G Bridge Buildathon. Default model qwen3-vl-30b is the
 * cheapest vision-capable entry on the live 0G Router catalog, with
 * TEE-attested routing (TeeTLS / dstack / TDX). Returns the analysis
 * text and a tee_verified flag so the agent layer can decide whether
 * to record a verifiable receipt.
 */
async function analyzeWithZeroG(imageData, preferences = {}) {
  const zerogKey = process.env.ZERO_G_API_KEY;
  if (!zerogKey) {
    throw new Error('ZERO_G_API_KEY not configured');
  }

  const prefContext = Object.keys(preferences).length > 0
    ? `\nUser Preferences:
- Aesthetics: ${preferences.styleAesthetics?.join(', ') || 'Not specified'}
- Budget: ${preferences.budgetTier || 'Not specified'}
- Body Type: ${preferences.bodyType || 'Not specified'}
Tailor recommendations accordingly.`
    : '';

  const response = await fetch(`${ZERO_G_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${zerogKey}`,
    },
    body: JSON.stringify({
      model: ZERO_G_DEFAULT_MODEL,
      verify_tee: true,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are OnPoint, an AI fashion stylist. Analyze this person's appearance and outfit for styling purposes. Provide:

1. **Overall Style Assessment** — Describe their current look
2. **Body & Fit Notes** — Key observations for clothing recommendations
3. **Color Palette Analysis** — What works, what could be enhanced
4. **3 Specific Recommendations** — Actionable fashion suggestions
5. **Styling Score** — Rate 1-10 with brief justification${prefContext}

Keep it concise and actionable.`,
            },
            { type: 'image_url', image_url: { url: imageData } },
          ],
        },
      ],
      max_tokens: 1024,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`0G Router error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  // TEE proof lives in x_0g_trace (not top-level tee_verified) — see
  // https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview
  const trace = data.x_0g_trace || {};
  return {
    content: data.choices?.[0]?.message?.content || '',
    tee_verified: trace.tee_verified === true,
    tee_provider: trace.provider || null,
    tee_request_id: trace.request_id || null,
    model: data.model || ZERO_G_DEFAULT_MODEL,
  };
}

/**
 * Analyze a person's outfit via Replicate (GPT-4o-mini).
 * Kept as a Tier 2.5 fallback behind 0G in the chain.
 */
async function analyzeWithReplicate(imageData, preferences = {}) {
  const replicateKey = process.env.REPLICATE_API_TOKEN;
  if (!replicateKey) {
    throw new Error('REPLICATE_API_TOKEN not configured');
  }
  // Delegate to the existing /api/ai/replicate-analyze route to keep
  // model selection and prompt logic in one place.
  const response = await fetch('http://localhost:48751/api/ai/replicate-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData, preferences }),
  });
  if (!response.ok) {
    throw new Error(`Replicate error ${response.status}`);
  }
  const data = await response.json();
  return data.analysis || data.response || '';
}

/**
 * Analyze a person's outfit via Azure Computer Vision.
 * Final free-tier fallback.
 */
async function analyzeWithAzure(imageData, preferences = {}) {
  const endpoint = process.env.AZURE_CV_ENDPOINT;
  const apiKey = process.env.AZURE_CV_API_KEY;
  if (!endpoint || !apiKey) {
    throw new Error('AZURE_CV_* not configured');
  }
  const response = await fetch('http://localhost:48751/api/ai/azure-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: imageData, preferences }),
  });
  if (!response.ok) {
    throw new Error(`Azure CV error ${response.status}`);
  }
  const data = await response.json();
  return data.analysis || data.response || '';
}

/**
 * Run the analyze-outfit chain in order:
 *   Sandbase → Otari → Venice → 0G Compute → Replicate → Azure
 *
 * Sandbase carries the platform-funded inference spend; Otari sits behind
 * it and is still first when the caller sent an x-otari-key, because that
 * spend belongs in the agent's own workspace. 0G stays ahead of Replicate
 * and Azure because (a) it is TEE-attested which makes it a stronger
 * receipt surface than Replicate / Azure, (b) the default model
 * (qwen3-vl-30b) is the cheapest vision-capable model on the live 0G
 * Router catalog, and (c) it adds a verifiable alternative for users who
 * care about audit trails.
 */
async function analyzeWithFallbackChain(imageData, preferences = {}, apiKeyOverride = null) {
  const gateways = apiKeyOverride
    ? [{ name: 'otari', run: () => analyzeWithOtari(imageData, preferences, apiKeyOverride) }]
    : [
        { name: 'sandbase', run: () => analyzeWithSandbase(imageData, preferences) },
        { name: 'otari', run: () => analyzeWithOtari(imageData, preferences, null) },
      ];
  const providers = [
    ...gateways,
    { name: 'venice', run: () => analyzeWithVenice(imageData, preferences) },
    { name: '0g', run: () => analyzeWithZeroG(imageData, preferences) },
    { name: 'replicate', run: () => analyzeWithReplicate(imageData, preferences) },
    { name: 'azure', run: () => analyzeWithAzure(imageData, preferences) },
  ];

  const errors = [];
  for (const provider of providers) {
    try {
      const result = await provider.run();
      if (typeof result === 'string') {
        return { content: result, provider: provider.name, tee_verified: false };
      }
      // 0G returns { content, tee_verified, model }; Otari returns
      // { content, model, costUsd, meteredBy }
      return { ...result, provider: provider.name };
    } catch (error) {
      logger.warn?.(`analyze chain: ${provider.name} failed`, {
        component: 'ai-agent',
        error: error.message,
      });
      errors.push({ provider: provider.name, error: error.message });
    }
  }
  throw new Error(
    `All analyze providers failed: ${errors.map((e) => e.provider).join(', ')}`,
  );
}

/**
 * Generate proactive style suggestions based on user context
 */
async function generateSuggestions(userContext = {}, apiKeyOverride = null) {
  const otariKey = apiKeyOverride || process.env.OTARI_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;
  const hasOtari = Boolean(otariKey && OTARI_CHAT_MODEL && (apiKeyOverride || process.env.OTARI_KILL_SWITCH !== '1'));
  const hasSandbase = Boolean(sandbase.configured() && sandbase.chatModel());
  if (!hasOtari && !hasSandbase && !veniceKey) return { suggestions: [], aiCost: null };

  const contextStr = Object.keys(userContext).length > 0
    ? `User context: ${JSON.stringify(userContext)}`
    : 'No specific user context';

  const prompt = `You are OnPoint's AI stylist agent. Based on this context, suggest 2-3 fashion actions the agent could take proactively.

${contextStr}

Return a JSON array of suggestions, each with: title (string), description (string), category (one of: outfit, accessory, color, trend, event), confidence (0-100).

Return ONLY valid JSON, no markdown.`;

  const upstreams = [];
  const otariUpstream = { name: 'otari', baseURL: OTARI_BASE_URL, apiKey: otariKey, model: OTARI_CHAT_MODEL };
  if (hasOtari && apiKeyOverride) {
    // An agent-supplied key meters to its own workspace — it outranks our spend.
    upstreams.push(otariUpstream);
  } else {
    if (hasSandbase) {
      upstreams.push({ name: 'sandbase', baseURL: sandbase.baseURL(), apiKey: sandbase.apiKey(), model: sandbase.chatModel() });
    }
    if (hasOtari) upstreams.push(otariUpstream);
  }
  if (veniceKey) upstreams.push({ name: 'venice', baseURL: VENICE_BASE_URL, apiKey: veniceKey, model: 'qwen3-vl-235b-a22b' });

  for (const up of upstreams) {
    try {
      const response = await fetch(`${up.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${up.apiKey}`,
        },
        body: JSON.stringify({
          model: up.model,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 512,
        }),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const suggestions = JSON.parse(cleaned);
      const settledCost = data.usage?.cost_usd != null ? Number(data.usage.cost_usd) : null;
      const costUsd = settledCost ?? (up.name === 'sandbase' ? await sandbase.costUsd(up.model, data.usage) : null);
      return {
        suggestions: Array.isArray(suggestions) ? suggestions.slice(0, 3) : [],
        aiCost: costUsd != null ? { provider: up.name, model: data.model || up.model, costUsd } : null,
      };
    } catch {
      // try next upstream
    }
  }
  return { suggestions: [], aiCost: null };
}

// POST /api/ai/agent — Analyze outfit with optional preferences
router.post('/', async (req, res) => {
  try {
    const { imageData, stylePreferences, mode = 'analyze' } = req.body;

    if (!imageData && mode !== 'suggest') {
      return res.status(400).json({ error: 'imageData is required for analysis mode' });
    }

    // Agents may bring their own Otari key (x-otari-key) — their AI
    // calls are then metered and budget-capped in their own Otari
    // workspace, visible via GET /api/agent/ai-usage.
    const agentOtariKey = req.headers['x-otari-key'];
    if (agentOtariKey && !String(agentOtariKey).startsWith('otk_')) {
      return res.status(400).json({
        error: 'x-otari-key must be an Otari workspace key (otk_…).',
        code: 'OTARI_KEY_MALFORMED',
      });
    }

    switch (mode) {
      case 'analyze': {
        const result = await analyzeWithFallbackChain(imageData, stylePreferences, agentOtariKey);
        return res.json({
          success: true,
          analysis: result.content,
          provider: result.provider,
          tee_verified: result.tee_verified === true,
          type: 'ai-agent-analysis',
          mode: 'analyze',
          ...(result.costUsd != null
            ? { aiCost: { provider: result.provider, model: result.model, costUsd: result.costUsd, meteredBy: result.meteredBy } }
            : {}),
        });
      }

      case 'suggest': {
        const { suggestions, aiCost } = await generateSuggestions(stylePreferences, agentOtariKey);
        return res.json({
          success: true,
          suggestions,
          type: 'ai-agent-suggestions',
          mode: 'suggest',
          ...(aiCost ? { aiCost } : {}),
        });
      }

      default:
        return res.status(400).json({ error: `Unknown mode: ${mode}. Use 'analyze' or 'suggest'.` });
    }
  } catch (error) {
    logger.error('AI agent analysis failed', { component: 'ai-agent' }, error);
    return res.status(error.status || 500).json({
      error: error.message || 'AI agent analysis failed',
    });
  }
});

module.exports = router;
