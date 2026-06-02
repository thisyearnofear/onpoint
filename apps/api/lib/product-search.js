/**
 * Product Search — shared bridge + Venice fallback
 *
 * Used by both the catalog route and the curated-shop route
 * to search for real products via the Python bridge (Purch / TinyFish / Browser Use)
 * with a Venice AI fallback for synthetic suggestions.
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

async function searchViaVenice(query, limit) {
  const veniceKey = process.env.VENICE_API_KEY;
  if (!veniceKey) return null;

  try {
    const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
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
            content: `You are a fashion product catalog. Given the query "${query}", return a JSON array of ${limit} fashion item suggestions. Each item must have: name, brand, category, price (number), description. Return ONLY valid JSON, no markdown.`,
          },
        ],
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '[]';
    const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const items = JSON.parse(cleaned);
    return { items: Array.isArray(items) ? items.slice(0, limit) : [] };
  } catch (err) {
    logger.warn('Venice catalog search failed', {
      component: 'product-search',
      error: err.message,
    });
    return null;
  }
}

module.exports = {
  searchViaBridge,
  searchViaVenice,
  BRIDGE_URL,
  BRIDGE_API_KEY,
};
