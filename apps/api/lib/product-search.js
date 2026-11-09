/**
 * Product Search — shared bridge + LLM fallback
 *
 * Used by both the catalog route and the curated-shop route
 * to search for real products via the Python bridge (Purch / TinyFish / Browser Use)
 * with an LLM fallback for synthetic suggestions. The LLM fallback tries
 * Otari (primary gateway) first, then Venice.
 */

const logger = require('./logger');

const BRIDGE_URL = process.env.BRIDGE_URL || 'http://localhost:48752';
const BRIDGE_API_KEY = process.env.BRIDGE_API_KEY || process.env.SERVICE_API_KEY || '';

async function searchViaBridge(query, limit) {
  if (!BRIDGE_URL) return null;

  try {
    const response = await fetch(`${BRIDGE_URL}/v1/agent/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BRIDGE_API_KEY ? { Authorization: `Bearer ${BRIDGE_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        userId: 'api-catalog',
        query,
        max_results: limit,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      logger.warn('Bridge search returned non-OK', {
        component: 'product-search',
        status: response.status,
      });
      return null;
    }

    return await response.json();
  } catch (err) {
    logger.warn('Bridge search failed, falling back', {
      component: 'product-search',
      error: err.message,
    });
    return null;
  }
}

const OTARI_BASE_URL = process.env.OTARI_BASE_URL || 'https://api.otari.ai/api/v1';
const OTARI_CHAT_MODEL = process.env.OTARI_CHAT_MODEL || process.env.OTARI_MODEL || null;

async function searchViaVenice(query, limit) {
  const otariKey = process.env.OTARI_API_KEY;
  const veniceKey = process.env.VENICE_API_KEY;
  if (!otariKey && !veniceKey) return null;

  const prompt = `You are a fashion product catalog. Given the query "${query}", return a JSON array of ${limit} fashion item suggestions. Each item must have: name, brand, category, price (number), description. Return ONLY valid JSON, no markdown.`;

  // Otari (primary gateway) first, Venice as fallback.
  const upstreams = [];
  if (otariKey && OTARI_CHAT_MODEL && process.env.OTARI_KILL_SWITCH !== '1') {
    upstreams.push({ name: 'otari', baseURL: OTARI_BASE_URL, apiKey: otariKey, model: OTARI_CHAT_MODEL });
  }
  if (veniceKey) {
    upstreams.push({ name: 'venice', baseURL: 'https://api.venice.ai/api/v1', apiKey: veniceKey, model: 'qwen3-vl-235b-a22b' });
  }

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
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) continue;

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '[]';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const items = JSON.parse(cleaned);
      return { items: Array.isArray(items) ? items.slice(0, limit) : [] };
    } catch (err) {
      logger.warn(`${up.name} catalog search failed`, {
        component: 'product-search',
        error: err.message,
      });
    }
  }
  return null;
}

module.exports = {
  searchViaBridge,
  searchViaVenice,
  BRIDGE_URL,
  BRIDGE_API_KEY,
};
