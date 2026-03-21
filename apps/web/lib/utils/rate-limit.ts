/**
 * Simple in-memory rate limiter
 * For production, consider using Redis (Upstash, etc.) for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

interface RateLimitConfig {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in milliseconds */
  windowMs: number;
  /** Optional key prefix for namespacing */
  prefix?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
}

// In-memory store (for single-instance deployments)
// For multi-instance, use Redis or similar
const store = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (entry.resetAt < now) {
      store.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

/**
 * Check and update rate limit for a given key
 */
export function rateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const { maxRequests, windowMs, prefix = "rl" } = config;
  const fullKey = `${prefix}:${key}`;
  const now = Date.now();

  let entry = store.get(fullKey);

  // Reset if window has passed
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    store.set(fullKey, entry);
  }

  // Increment count
  entry.count++;

  const allowed = entry.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - entry.count);

  return {
    allowed,
    remaining,
    resetAt: entry.resetAt,
    limit: maxRequests,
  };
}

/**
 * Rate limit configurations for different endpoints
 */
export const RateLimits = {
  /** Venice AI free tier: 60 requests per minute */
  veniceFree: {
    maxRequests: 60,
    windowMs: 60 * 1000,
    prefix: "venice-free",
  },

  /** Venice AI burst limit: 10 requests per second */
  veniceBurst: {
    maxRequests: 10,
    windowMs: 1000,
    prefix: "venice-burst",
  },

  /** Gemini Live session: 10 sessions per hour per wallet */
  geminiSession: {
    maxRequests: 10,
    windowMs: 60 * 60 * 1000,
    prefix: "gemini-session",
  },

  /** Payment verification: 5 attempts per 5 minutes */
  paymentVerify: {
    maxRequests: 5,
    windowMs: 5 * 60 * 1000,
    prefix: "payment-verify",
  },

  /** General API: 100 requests per minute */
  general: {
    maxRequests: 100,
    windowMs: 60 * 1000,
    prefix: "api",
  },
} as const;

/**
 * Create rate limit headers for response
 */
export function rateLimitHeaders(
  result: RateLimitResult,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": Math.ceil(result.resetAt / 1000).toString(),
  };
}

/**
 * Get client identifier from request
 */
export function getClientId(request: Request): string {
  // Try to get IP from common headers
  const forwarded = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnecting = request.headers.get("cf-connecting-ip");

  if (cfConnecting) return cfConnecting;
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? "unknown";
  if (realIp) return realIp;

  return "unknown";
}
