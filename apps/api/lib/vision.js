/**
 * Redundant OpenAI-compatible vision chain (ADR 0022 §3).
 *
 * completeVision() walks an ordered list of providers, each enabled only
 * when its API key is configured. A provider error, timeout, unparseable
 * JSON, or a failed validate() falls through to the next provider. If every
 * provider fails, throws an Error with code 'VISION_UNAVAILABLE'.
 *
 * Provider order defaults to venice → gemini → openrouter → dashscope →
 * openai and is overridable with VISION_PROVIDERS (comma list). Model names
 * are overridable per provider with VISION_*_MODEL.
 *
 * Keys are never logged and never appear in configuredProviders().
 */

const logger = require('./logger');

const PROVIDERS = {
  venice: {
    keyEnv: 'VENICE_API_KEY',
    baseURL: process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1',
    model: () => process.env.VISION_VENICE_MODEL || 'qwen3-vl-235b-a22b',
  },
  gemini: {
    keyEnv: 'GEMINI_API_KEY',
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    model: () => process.env.VISION_GEMINI_MODEL || 'gemini-2.5-flash',
  },
  openrouter: {
    keyEnv: 'OPENROUTER_API_KEY',
    baseURL: 'https://openrouter.ai/api/v1',
    model: () => process.env.VISION_OPENROUTER_MODEL || 'google/gemini-2.5-flash',
  },
  dashscope: {
    keyEnv: 'DASHSCOPE_API_KEY',
    baseURL: process.env.QWEN_CLOUD_BASE_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    model: () => process.env.VISION_DASHSCOPE_MODEL || 'qwen3-vl-plus',
  },
  openai: {
    keyEnv: 'OPENAI_API_KEY',
    baseURL: undefined, // client default
    model: () => process.env.VISION_OPENAI_MODEL || 'gpt-4o-mini',
  },
};

const DEFAULT_ORDER = ['venice', 'gemini', 'openrouter', 'dashscope', 'openai'];

function providerOrder() {
  const raw = process.env.VISION_PROVIDERS;
  if (!raw) return DEFAULT_ORDER;
  const order = raw.split(',').map((s) => s.trim().toLowerCase()).filter((n) => PROVIDERS[n]);
  return order.length ? order : DEFAULT_ORDER;
}

function apiKeyFor(name) {
  const key = process.env[PROVIDERS[name].keyEnv];
  if (!key || key === 'your_openai_api_key_here') return null;
  return key;
}

/** [{ name, model }] for configured providers only — never keys. */
function configuredProviders() {
  return providerOrder()
    .filter((name) => apiKeyFor(name))
    .map((name) => ({ name, model: PROVIDERS[name].model() }));
}

/** Loose JSON extraction: strip ``` fences, take the first {...} block. */
function parseJsonLoose(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.replace(/```(?:json)?/gi, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

// Injectable for tests — the default builds a real OpenAI client.
let _clientFactory = (opts) => {
  const OpenAI = require('openai');
  return new OpenAI(opts);
};
function _setClientFactory(fn) {
  _clientFactory = fn || _clientFactory;
}

/**
 * Run the provider chain for one vision completion.
 *
 * @param {object} args
 * @param {string} args.system - system prompt
 * @param {string} args.prompt - user prompt text
 * @param {string} args.imageDataUrl - data:image/... URL
 * @param {number} [args.maxTokens]
 * @param {number} [args.timeoutMs] - per-provider timeout
 * @param {(json: object) => boolean} [args.validate] - parsed JSON must pass
 * @returns {Promise<{provider: string, model: string, text: string, json: object}>}
 */
async function completeVision({ system, prompt, imageDataUrl, maxTokens, timeoutMs, validate }) {
  const timeout = timeoutMs ?? parseInt(process.env.VISION_TIMEOUT_MS, 10) ?? 20000;
  const limit = Number.isFinite(timeout) && timeout > 0 ? timeout : 20000;
  const tokens = maxTokens ?? parseInt(process.env.VISION_MAX_TOKENS, 10) ?? 400;
  const maxOut = Number.isFinite(tokens) && tokens > 0 ? tokens : 400;
  const errors = [];

  for (const { name, model } of configuredProviders()) {
    const def = PROVIDERS[name];
    try {
      const client = _clientFactory({ apiKey: apiKeyFor(name), baseURL: def.baseURL, timeout: limit, maxRetries: 0 });
      const response = await client.chat.completions.create({
        model,
        temperature: 0.6,
        max_tokens: maxOut,
        // OpenRouter-only: some hosted models (e.g. nvidia nemotron super-vl)
        // are reasoning models that burn the whole token budget on chain-of-
        // thought and return empty content. effort:'low' fixes that.
        ...(name === 'openrouter' ? { reasoning: { effort: process.env.VISION_REASONING_EFFORT || 'low' } } : {}),
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          },
        ],
      });
      const text = response?.choices?.[0]?.message?.content || '';
      const json = parseJsonLoose(text);
      if (!json) throw new Error('unparseable JSON in vision response');
      if (validate && !validate(json)) throw new Error('vision response failed validation');
      return { provider: name, model, text, json };
    } catch (err) {
      errors.push(`${name}: ${err.message}`);
      logger.warn('vision provider failed', { component: 'vision', provider: name, error: err.message });
    }
  }

  const err = new Error(`All vision providers failed (${errors.join('; ') || 'none configured'})`);
  err.code = 'VISION_UNAVAILABLE';
  throw err;
}

module.exports = { configuredProviders, completeVision, parseJsonLoose, _setClientFactory };
