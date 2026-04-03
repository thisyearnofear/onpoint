/**
 * Rate limiting utility with Redis (Upstash) support for production
 * Falls back to in-memory for development
 *
 * For production, set these environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 *
 * Get a free Redis instance at: https://upstash.com
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

// ============================================
// In-Memory Implementation (Development)
// ============================================

const memoryStore = new Map<string, RateLimitEntry>();

// Cleanup expired entries periodically (only in long-running processes, not serverless)
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes
let cleanupTimer: ReturnType<typeof setInterval> | undefined;

function ensureCleanupTimer() {
  if (!cleanupTimer && typeof setInterval !== "undefined") {
    cleanupTimer = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of memoryStore.entries()) {
        if (entry.resetAt < now) {
          memoryStore.delete(key);
        }
      }
    }, CLEANUP_INTERVAL);
    // Allow the process to exit even if the timer is active
    if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
      cleanupTimer.unref();
    }
  }
}

function memoryRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const { maxRequests, windowMs, prefix = "rl" } = config;
  const fullKey = `${prefix}:${key}`;
  const now = Date.now();

  ensureCleanupTimer();

  let entry = memoryStore.get(fullKey);

  // Reset if window has passed
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + windowMs,
    };
    memoryStore.set(fullKey, entry);
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

// ============================================
// Redis (Upstash) Implementation (Production)
// ============================================

interface UpstashResponse {
  result: number;
}

async function upstashRateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, prefix = "rl" } = config;
  const fullKey = `${prefix}:${key}`;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!redisUrl || !redisToken) {
    throw new Error("Upstash Redis not configured");
  }

  const windowSecs = Math.ceil(windowMs / 1000);
  const now = Math.floor(Date.now() / 1000);
  const resetAt = now + windowSecs;

  // Use UPSTASH's rate limiting script for atomic operations
  const response = await fetch(`${redisUrl}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${redisToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", fullKey],
      ["EXPIRE", fullKey, windowSecs],
      ["GET", fullKey],
    ]),
  });

  if (!response.ok) {
    throw new Error(`Upstash error: ${response.status}`);
  }

  const results: UpstashResponse[] = await response.json();
  const count = results[2]?.result ?? 0;

  const allowed = count <= maxRequests;
  const remaining = Math.max(0, maxRequests - count);

  return {
    allowed,
    remaining,
    resetAt: resetAt * 1000,
    limit: maxRequests,
  };
}

// ============================================
// Public API - Auto-selects implementation
// ============================================

/**
 * Check and update rate limit for a given key
 * Uses Redis in production, in-memory in development
 *
 * In production, if Redis is configured but unreachable, the function
 * returns { allowed: false } rather than silently falling back to the
 * broken in-memory store (which resets on every serverless cold start).
 */
export async function rateLimit(
  key: string,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === "production";
  const hasRedis = !!(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  );

  if (isProduction && hasRedis) {
    try {
      return await upstashRateLimit(key, config);
    } catch (error) {
      console.error(
        "[RateLimit] Redis unavailable in production — denying request:",
        error,
      );
      // Do NOT fall back to in-memory in production — it is broken in serverless
      // and silently disables all rate limiting. Deny the request instead.
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + config.windowMs,
        limit: config.maxRequests,
      };
    }
  }

  return memoryRateLimit(key, config);
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
