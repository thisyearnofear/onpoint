/**
 * Agent Authentication Middleware
 *
 * Production-ready authentication with SIWE (EIP-4361) support.
 * Implements secure nonce-based message verification with replay protection.
 *
 * Authentication Methods:
 * 1. SIWE (Sign-In With Ethereum) - Production standard with nonce validation
 * 2. API Key - For service-to-service communication
 * 3. Development mode - Query param fallback (dev only)
 */

import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";
import { rateLimit, RateLimits, getClientId } from "../lib/utils/rate-limit";
import { redisGet, redisSetEx, redisDel } from "../lib/utils/redis-helpers";

// ============================================
// Types
// ============================================

export interface AgentAuthContext {
  /** User identifier (wallet address or API key) */
  userId: string;
  /** Agent identifier */
  agentId: string;
  /** Permission flags */
  permissions: AgentPermission[];
  /** Rate limit tier */
  tier: "free" | "premium";
}

export type AgentPermission =
  | "create_suggestion"
  | "accept_suggestion"
  | "reject_suggestion"
  | "execute_purchase"
  | "view_receipts"
  | "search_catalog"
  | "external_search";

// ============================================
// Default Permissions by Tier
// ============================================

const FREE_TIER_PERMISSIONS: AgentPermission[] = [
  "create_suggestion",
  "accept_suggestion",
  "reject_suggestion",
  "search_catalog",
];

const PREMIUM_TIER_PERMISSIONS: AgentPermission[] = [
  ...FREE_TIER_PERMISSIONS,
  "execute_purchase",
  "external_search",
  "view_receipts",
];

// ============================================
// SIWE Nonce Management
// ============================================

const NONCE_TTL = 600; // 10 minutes
const NONCE_PREFIX = "siwe:nonce:";

/**
 * Generate a cryptographically secure nonce for SIWE
 */
export async function generateNonce(): Promise<string> {
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await redisSetEx(`${NONCE_PREFIX}${nonce}`, { created: Date.now() }, NONCE_TTL);
  return nonce;
}

/**
 * Verify and consume a nonce (one-time use)
 */
async function verifyAndConsumeNonce(nonce: string): Promise<boolean> {
  const key = `${NONCE_PREFIX}${nonce}`;
  const exists = await redisGet<{ created: number }>(key);
  if (!exists) return false;
  
  // Delete immediately to prevent replay
  await redisDel(key);
  return true;
}

/**
 * Verify a SIWE message with proper EIP-4361 validation
 */
async function verifySiweMessage(
  message: string,
  signature: string,
): Promise<{ success: boolean; address?: string; error?: string }> {
  try {
    const siweMessage = new SiweMessage(message);
    
    // Verify the signature
    const fields = await siweMessage.verify({ signature });
    
    if (!fields.success) {
      return { success: false, error: "Invalid signature" };
    }

    // Verify nonce hasn't been used
    const nonceValid = await verifyAndConsumeNonce(siweMessage.nonce);
    if (!nonceValid) {
      return { success: false, error: "Invalid or expired nonce" };
    }

    // Verify expiration
    if (siweMessage.expirationTime && new Date(siweMessage.expirationTime) < new Date()) {
      return { success: false, error: "Message expired" };
    }

    // Verify not-before
    if (siweMessage.notBefore && new Date(siweMessage.notBefore) > new Date()) {
      return { success: false, error: "Message not yet valid" };
    }

    return { success: true, address: siweMessage.address };
  } catch (err) {
    console.error("[AgentAuth] SIWE verification failed:", err);
    return { success: false, error: "Verification failed" };
  }
}

// ============================================
// User Subscription Management (Redis-backed)
// ============================================

interface UserSubscription {
  userId: string;
  tier: "free" | "premium";
  expiresAt?: number;
  permissions: AgentPermission[];
}

const SUBSCRIPTION_PREFIX = "user:subscription:";

async function getUserSubscription(userId: string): Promise<UserSubscription | null> {
  return redisGet<UserSubscription>(`${SUBSCRIPTION_PREFIX}${userId}`);
}

export async function setUserSubscription(
  userId: string,
  tier: "free" | "basic" | "pro" | "concierge",
  expiresAt?: number,
): Promise<void> {
  const subscription: UserSubscription = {
    userId,
    tier: tier === "free" ? "free" : "premium", // Map to auth tier
    expiresAt,
    permissions: tier === "free" ? FREE_TIER_PERMISSIONS : PREMIUM_TIER_PERMISSIONS,
  };
  
  // Store with TTL if expiration is set
  if (expiresAt) {
    const ttl = Math.ceil((expiresAt - Date.now()) / 1000);
    await redisSetEx(`${SUBSCRIPTION_PREFIX}${userId}`, subscription, ttl);
  } else {
    await redisSetEx(`${SUBSCRIPTION_PREFIX}${userId}`, subscription, 86400 * 365); // 1 year default
  }
}

// ============================================
// Auth Extraction
// ============================================

export async function extractAuth(
  request: NextRequest,
): Promise<AgentAuthContext | null> {
  const url = new URL(request.url);

  // 1. Check for SIWE authentication (Production)
  const siweMessage = request.headers.get("X-SIWE-Message");
  const siweSignature = request.headers.get("X-SIWE-Signature");

  if (siweMessage && siweSignature) {
    const result = await verifySiweMessage(siweMessage, siweSignature);
    
    if (result.success && result.address) {
      // Check subscription status from Redis
      const subscription = await getUserSubscription(result.address);
      
      const tier = subscription?.tier || "free";
      const permissions = subscription?.permissions || FREE_TIER_PERMISSIONS;

      return {
        userId: result.address,
        agentId: url.searchParams.get("agentId") || "onpoint-stylist",
        permissions,
        tier,
      };
    }
  }

  // 2. Check for API key (Service-to-service)
  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.replace("Bearer ", "");

  // In development only, allow ?userId= query param for local testing
  const isDev = process.env.NODE_ENV !== "production";
  const userId = apiKey || (isDev ? url.searchParams.get("userId") : null);

  if (!userId) {
    return null;
  }

  // Check subscription for API key users
  const subscription = await getUserSubscription(userId);
  const tier = subscription?.tier || "free";
  const permissions = subscription?.permissions || FREE_TIER_PERMISSIONS;

  return {
    userId,
    agentId: url.searchParams.get("agentId") || "onpoint-stylist",
    permissions,
    tier,
  };
}

// ============================================
// Higher-Order Handler
// ============================================

/**
 * Wrap agent route handlers with authentication.
 * Injects auth context into the handler.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return requireAgentAuth(async (req, ctx) => {
 *     // Your route logic here
 *     console.log(`User ${ctx.userId} is making a request`);
 *   })(request);
 * }
 */
export function requireAgentAuth<T extends NextResponse>(
  handler: (request: NextRequest, context: AgentAuthContext) => Promise<T>,
): (request: NextRequest) => Promise<T> {
  return async (request: NextRequest): Promise<T> => {
    const auth = await extractAuth(request);

    if (!auth) {
      return NextResponse.json(
        {
          error:
            "Authentication required. Provide a Bearer token in the Authorization header.",
        },
        { status: 401 },
      ) as T;
    }

    return handler(request, auth);
  };
}

/**
 * Require specific permission for an action.
 * Combines auth + permission check.
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   return requirePermission("execute_purchase")(async (req, ctx) => {
 *     // Only users with execute_purchase permission reach here
 *   })(request);
 * }
 */
export function requirePermission(permission: AgentPermission) {
  return function (
    handler: (
      request: NextRequest,
      context: AgentAuthContext,
    ) => Promise<NextResponse>,
  ) {
    return (request: NextRequest) =>
      requireAgentAuth(async (req, context) => {
        if (!context.permissions.includes(permission)) {
          return NextResponse.json(
            {
              error: `Permission denied: ${permission}`,
              hint: "Upgrade to premium tier for access",
            },
            { status: 403 },
          );
        }
        return handler(req, context);
      })(request);
  };
}

// ============================================
// Rate Limiting Integration
// ============================================

/**
 * Apply rate limiting based on user tier.
 * Premium users get higher limits.
 */
export async function applyTieredRateLimit(
  request: NextRequest,
  context: AgentAuthContext,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const clientId = getClientId(request) || context.userId;

  const config =
    context.tier === "premium"
      ? { ...RateLimits.general, maxRequests: 500 } // Premium: 500/min
      : { ...RateLimits.general, maxRequests: 60 }; // Free: 60/min

  const result = await rateLimit(`agent:${clientId}`, config);

  return {
    allowed: result.allowed,
    remaining: result.remaining,
    resetAt: result.resetAt,
  };
}

/**
 * Wrapper that combines auth + rate limiting.
 * Returns 429 if rate limited before executing handler.
 */
export function requireAuthWithRateLimit<T extends NextResponse>(
  handler: (request: NextRequest, context: AgentAuthContext) => Promise<T>,
): (request: NextRequest) => Promise<T> {
  return (request: NextRequest) =>
    requireAgentAuth(async (req, context) => {
      const rateLimitResult = await applyTieredRateLimit(req, context);

      if (!rateLimitResult.allowed) {
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            retryAfter: Math.ceil(
              (rateLimitResult.resetAt - Date.now()) / 1000,
            ),
            remaining: rateLimitResult.remaining,
          },
          {
            status: 429,
            headers: {
              "X-RateLimit-Limit": context.tier === "premium" ? "500" : "60",
              "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
              "X-RateLimit-Reset": Math.ceil(
                rateLimitResult.resetAt / 1000,
              ).toString(),
            },
          },
        ) as T;
      }

      return handler(req, context);
    })(request);
}

// ============================================
// Utility Functions
// ============================================

/**
 * Check if a user has premium access.
 * In production, would verify subscription status.
 */
export function isPremiumUser(userId: string): boolean {
  const premiumUsers = process.env.PREMIUM_USERS?.split(",") || [];
  return premiumUsers.includes(userId);
}

/**
 * Generate a simple API key for a user.
 * In production, use proper crypto and store hashed keys.
 */
export function generateApiKey(userId: string): string {
  const random = Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `sk_${userId}_${random}`;
}
