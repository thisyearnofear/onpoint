/**
 * Rate Limit Middleware for Express API Server
 *
 * Redis-backed rate limiting using the existing ioredis connection.
 * Mirrors the Next.js rate-limit.ts utility but uses ioredis directly
 * instead of Upstash REST API.
 */

// Keyed by IP (x-forwarded-for or connection remoteAddress)
function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.ip || req.connection?.remoteAddress || "unknown";
}

// ── Pre-configured tiers (aligned with Next.js RateLimits) ──

const TIERS = {
  veniceFree: { maxRequests: 60, windowMs: 60_000, prefix: "venice-free" },
  veniceBurst: { maxRequests: 10, windowMs: 1_000, prefix: "venice-burst" },
  liveSession: { maxRequests: 10, windowMs: 3_600_000, prefix: "live-session" },
  general: { maxRequests: 100, windowMs: 60_000, prefix: "api" },
};

// ── Factory: create rate limit middleware ──

/**
 * @param {import('ioredis').Redis} redis - existing ioredis connection
 * @param {keyof typeof TIERS} tier - pre-configured tier name, or custom config
 * @param {{ maxRequests?: number; windowMs?: number; prefix?: string }} [overrides]
 */
function createRateLimiter(redis, tier, overrides = {}) {
  const base = TIERS[tier] || TIERS.general;
  const config = {
    maxRequests: overrides.maxRequests ?? base.maxRequests,
    windowMs: overrides.windowMs ?? base.windowMs,
    prefix: overrides.prefix ?? base.prefix,
  };

  /**
   * Express middleware.
   * Uses ioredis pipeline (MULTI/EXEC) for atomic INCR + EXPIRE.
   */
  return async function rateLimitMiddleware(req, res, next) {
    const ip = getClientIp(req);
    const key = `${config.prefix}:${ip}`;
    const now = Date.now();
    const windowSecs = Math.ceil(config.windowMs / 1000);

    try {
      const results = await redis
        .multi()
        .incr(key)
        .expire(key, windowSecs)
        .exec();

      // ioredis returns [[null, "OK"], [null, "OK"], [null, "3"]]
      // exec() returns [ [err, result], [err, result] ]
      const countResult = results ? results[0] : null;
      if (!countResult || countResult[0]) {
        // Redis error — fail open in dev, closed in prod
        if (process.env.NODE_ENV === "production") {
          return res.status(503).json({ error: "Rate limit service unavailable" });
        }
        return next();
      }

      const count = Number(countResult[1]) || 0;
      const allowed = count <= config.maxRequests;
      const remaining = Math.max(0, config.maxRequests - count);
      const resetAt = now + config.windowMs;

      res.setHeader("X-RateLimit-Limit", String(config.maxRequests));
      res.setHeader("X-RateLimit-Remaining", String(remaining));
      res.setHeader("X-RateLimit-Reset", Math.ceil(resetAt / 1000));

      if (!allowed) {
        return res.status(429).json({
          error: "Too Many Requests",
          retryAfter: Math.ceil(config.windowMs / 1000),
        });
      }

      next();
    } catch (err) {
      console.error("[RateLimit] Redis error:", err.message);
      if (process.env.NODE_ENV === "production") {
        return res.status(503).json({ error: "Rate limit service unavailable" });
      }
      next();
    }
  };
}

// ── Export factory + tier constants ──

module.exports = { createRateLimiter, TIERS };
