const OpenAI = require('openai');
const logger = require('./logger');
const { cacheGet, cacheSet } = require('./cache');

const CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_PREFIX = 'commerce-intent:';
// Per-process overflow cache for when Redis is unavailable. This is a
// best-effort cost saving only (identical to the old behavior); correctness
// does not depend on it. Redis is the shared, durable store.
const localCache = new Map();

function directIntent(query) {
  return {
    originalQuery: query,
    searchQuery: query,
    provider: 'direct',
    model: null,
    constraints: null,
  };
}

function sanitizeIntent(payload, originalQuery, model) {
  const searchQuery = String(payload?.search_query || '')
    .trim()
    .slice(0, 240);
  if (!searchQuery) return directIntent(originalQuery);
  return {
    originalQuery,
    searchQuery,
    provider: 'openai',
    model,
    constraints:
      payload?.constraints && typeof payload.constraints === 'object'
        ? payload.constraints
        : null,
  };
}

/**
 * Turn natural-language fashion intent into a compact merchant search while
 * preserving every explicit brand, color, category, gender, and price cap.
 * The metadata is returned to the product so OpenAI is only credited when the
 * OpenAI API actually produced the search intent. No key means a truthful,
 * lossless direct-query fallback.
 */
async function compileCommerceIntent(rawQuery, options = {}) {
  const query = String(rawQuery || '')
    .trim()
    .slice(0, 500);
  if (!query) return directIntent('');

  const cacheKey = CACHE_PREFIX + query;
  // Try Redis first (shared across instances), then fall back to the
  // per-process overflow cache.
  let cached = await cacheGet(cacheKey);
  if (!cached) cached = localCache.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.intent;

  const apiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here'
    ? process.env.OPENAI_API_KEY
    : null;
  const model =
    options.model || process.env.OPENAI_COMMERCE_MODEL || 'gpt-4o-mini';
  const client = options.client || (apiKey ? new OpenAI({ apiKey }) : null);
  if (!client) return directIntent(query);

  try {
    const response = await client.chat.completions.create({
      model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You compile fashion shopping intent for live merchant search. Return JSON with search_query and constraints. Preserve every explicit brand, product category, audience, color, size, material, currency, and maximum price. Never loosen a price ceiling or invent a preference. search_query must be concise natural language, not prose.',
        },
        { role: 'user', content: query },
      ],
    });
    const content = response.choices?.[0]?.message?.content || '{}';
    const intent = sanitizeIntent(JSON.parse(content), query, model);
    if (intent.provider === 'openai') {
      const entry = { at: Date.now(), intent };
      await cacheSet(cacheKey, entry, CACHE_TTL_MS);
      localCache.set(cacheKey, entry);
    }
    return intent;
  } catch (error) {
    logger.warn(
      'OpenAI commerce intent compilation failed; preserving original query',
      { component: 'commerce-intent' },
      error,
    );
    return directIntent(query);
  }
}

module.exports = { compileCommerceIntent, directIntent, sanitizeIntent };
