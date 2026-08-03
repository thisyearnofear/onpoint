/**
 * Shared Redis-backed TTL cache for the API server.
 *
 * Replaces the per-process `new Map()` caches that were sprinkled across
 * agent-tryon (render cache), prava-sandbox (sessions), prava-facade
 * (orders), and commerce-intent (intent cache). Those broke across
 * instances and on serverless — every redeploy silently re-ran paid
 * Replicate calls and lost in-flight demo state.
 *
 * Backed by the shared ioredis singleton from lib/redis.js. When Redis is
 * unavailable (no REDIS_URL, or connection error) callers degrade
 * gracefully: caches miss (recompute / re-create) rather than throw. State
 * machine callers keep a process-local mirror where they need a usable
 * development fallback; Redis remains the cross-instance source of truth.
 *
 * Values are JSON-serialized. Keys should be namespaced, e.g.
 * `tryon:render:<hash>`, `prava:order:<id>`.
 */

const { getRedis } = require('./redis');

/**
 * Get a JSON-serializable value from the cache.
 * @param {string} key
 * @returns {Promise<any|null>} the value, or null if absent / Redis down
 */
async function cacheGet(key) {
  const r = getRedis();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (raw == null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Set a value with a TTL (milliseconds). Best-effort.
 * @param {string} key
 * @param {any} value — must be JSON-serializable
 * @param {number} ttlMs — time-to-live in milliseconds
 */
async function cacheSet(key, value, ttlMs) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), 'PX', ttlMs);
  } catch {
    // best-effort — caller continues without cache
  }
}

/**
 * Delete a key. Best-effort.
 * @param {string} key
 */
async function cacheDel(key) {
  const r = getRedis();
  if (!r) return;
  try {
    await r.del(key);
  } catch {
    // best-effort
  }
}

/**
 * Read JSON values for a namespace. Used for small public activity views;
 * callers should still cap the result because SCAN is not a query index.
 * @param {string} prefix
 * @param {number} limit
 * @returns {Promise<any[]>}
 */
async function cacheScanJson(prefix, limit = 50) {
  const r = getRedis();
  if (!r) return [];
  const values = [];
  let cursor = '0';
  try {
    do {
      const [nextCursor, keys] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', limit);
      cursor = nextCursor;
      if (keys.length > 0) {
        const rawValues = await r.mget(keys);
        for (const raw of rawValues) {
          if (raw == null) continue;
          try { values.push(JSON.parse(raw)); } catch { /* skip malformed cache entries */ }
          if (values.length >= limit) return values.slice(0, limit);
        }
      }
    } while (cursor !== '0');
  } catch {
    return [];
  }
  return values.slice(0, limit);
}

/**
 * True when a Redis backend is reachable for caching. Callers that require
 * cross-instance consistency can check this and refuse to serve if false.
 */
function isCacheAvailable() {
  return !!getRedis();
}

module.exports = {
  cacheGet,
  cacheSet,
  cacheDel,
  cacheScanJson,
  isCacheAvailable,
};
