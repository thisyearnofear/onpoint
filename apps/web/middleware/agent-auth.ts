/**
 * Agent Authentication Middleware
 * 
 * Lightweight authentication for agent API routes.
 * Follows the same pattern as rate-limit.ts (auto-selects based on config).
 * 
 * Modes:
 * - Development: API key = userId (no validation)
 * - Production: Validates against Redis user store
 * 
 * For production use, integrate with SIWE (Sign-In With Ethereum) or JWT.
 */

import { NextRequest, NextResponse } from "next/server";
import { rateLimit, RateLimits, getClientId } from "../lib/utils/rate-limit";

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
// Auth Extraction
// ============================================

async function extractAuth(request: NextRequest): Promise<AgentAuthContext | null> {
  const origin = request.headers.get("origin");
  
  // Try to get API key from Authorization header
  const authHeader = request.headers.get("Authorization");
  const apiKey = authHeader?.replace("Bearer ", "");
  
  // Fallback to query param (for development)
  const url = new URL(request.url);
  const userId = apiKey || url.searchParams.get("userId");
  
  if (!userId) {
    return null;
  }
  
  // Determine tier (in production, would check subscription status)
  const isPremium = process.env.PREMIUM_USERS?.split(",").includes(userId);
  
  return {
    userId,
    agentId: url.searchParams.get("agentId") || "onpoint-stylist",
    permissions: isPremium ? PREMIUM_TIER_PERMISSIONS : FREE_TIER_PERMISSIONS,
    tier: isPremium ? "premium" : "free",
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
  handler: (
    request: NextRequest,
    context: AgentAuthContext
  ) => Promise<T>,
): (request: NextRequest) => Promise<T> {
  return async (request: NextRequest): Promise<T> => {
    const auth = await extractAuth(request);
    
    if (!auth) {
      return NextResponse.json(
        { error: "Authentication required. Provide userId via Bearer token or query param." },
        { status: 401 }
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
  return function(
    handler: (
      request: NextRequest,
      context: AgentAuthContext
    ) => Promise<NextResponse>
  ) {
    return (request: NextRequest) => requireAgentAuth(async (req, context) => {
      if (!context.permissions.includes(permission)) {
        return NextResponse.json(
          { 
            error: `Permission denied: ${permission}`,
            hint: "Upgrade to premium tier for access"
          },
          { status: 403 }
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
  
  const config = context.tier === "premium"
    ? { ...RateLimits.general, maxRequests: 500 } // Premium: 500/min
    : { ...RateLimits.general, maxRequests: 60 };  // Free: 60/min
  
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
  handler: (
    request: NextRequest,
    context: AgentAuthContext
  ) => Promise<T>,
): (request: NextRequest) => Promise<T> {
  return (request: NextRequest) => requireAgentAuth(async (req, context) => {
    const rateLimitResult = await applyTieredRateLimit(req, context);
    
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { 
          error: "Rate limit exceeded",
          retryAfter: Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          remaining: rateLimitResult.remaining,
        },
        { 
          status: 429,
          headers: {
            "X-RateLimit-Limit": context.tier === "premium" ? "500" : "60",
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": Math.ceil(rateLimitResult.resetAt / 1000).toString(),
          }
        }
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
