/**
 * Shared Redis helper — lazy singleton with fail-safe fallback.
 *
 * Returns null if REDIS_URL is not set or Redis is unreachable.
 * Frame rate limiting and live sessions use this as a best-effort
 * gate; when null, callers fall back to in-memory or allow-all.
 *
 * Usage:
 *   const { getRedis } = require('../lib/redis');
 *   const r = getRedis();
 *   if (!r) { /* no redis — use fallback *\/ }
 */

let _redis = null;
let _initFailed = false;

function getRedis() {
  if (_redis || _initFailed) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    _initFailed = true;
    return null;
  }

  try {
    const Redis = require('ioredis');
    _redis = new Redis(url, {
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: true,
      connectTimeout: 1000,
    });
    _redis.on('error', () => {
      // Silent: Redis is best-effort for rate limiting and caching.
    });
  } catch {
    _initFailed = true;
    return null;
  }

  return _redis;
}

module.exports = { getRedis };
