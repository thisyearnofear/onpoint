/**
 * Agent Controls Middleware
 *
 * Provides spending limits, approval workflows, and action controls
 * for AI agent operations. Runs at the API layer to enforce
 * business logic before any blockchain transactions.
 *
 * Architecture (Phase A-3):
 *   Redis is the source of truth for persistent agent state.
 *   An LRU cache provides fast synchronous reads for hot keys.
 *   On startup, initStore() warms the cache from Redis.
 *   All writes are write-through: LRU cache + Redis.
 *   On Redis failure, falls back to LRU cache or defaults.
 */

import { LRUCache } from "lru-cache";
import { parseEther, formatEther } from "viem";
import { logger } from "./logger";
import { Metrics } from "./metrics";
import {
  loadSpendingLimits,
  persistSpendingLimits,
  loadAutonomyThreshold,
  persistAutonomyThreshold,
  persistSuggestion,
  loadSuggestion as loadSuggestionFromStore,
  loadSuggestionIds,
  persistApproval,
  loadApproval,
  loadApprovalIds,
  persistStylePreferences,
  loadStylePreferences,
  isRedisConfigured,
} from "./agent-store";
import { canSpendFromEscrow, deductFromEscrow } from "./escrow-service";
import {
  checkAgentHealth,
  recordHeartbeat,
  isAgentFrozen,
  analyzeTransactionPattern,
  updateAnomalyScore,
  requiresMultiSig,
  createMultiSigRequirement,
} from "./fraud-detection";

// Re-export for API routes that need direct store access
export { loadSuggestionFromStore, persistSuggestion };

// ============================================
// LRU Cache — Single source of truth for reads
// ============================================

const CACHE = new LRUCache<string, any>({
  max: 2000,
  ttl: 1000 * 60 * 5, // 5 min default TTL
});

const CACHE_TTL = {
  spendingLimits: 1000 * 60 * 2, // 2 min (changes frequently)
  autonomyThreshold: 1000 * 60 * 15, // 15 min (rarely changes)
  suggestion: 1000 * 60 * 30, // 30 min (matches Redis TTL)
  stylePrefs: 1000 * 60 * 15, // 15 min
  approval: 1000 * 60 * 30, // 30 min
};

const KEY = {
  spendingLimits: (agentId: string, userId: string) =>
    `ctrl:spending:${agentId}:${userId}`,
  autonomyThreshold: (agentId: string, userId: string) =>
    `ctrl:autonomy:${agentId}:${userId}`,
  suggestion: (id: string) => `ctrl:suggestion:${id}`,
  stylePrefs: (userId: string) => `ctrl:style:${userId}`,
  approval: (id: string) => `ctrl:approval:${id}`,
  suggestionIndex: (agentId: string) => `ctrl:suggestionIndex:${agentId}`,
  approvalIndex: (agentId: string) => `ctrl:approvalIndex:${agentId}`,
};

// ============================================
// Index Sets (for efficient iteration)
// Suggestions and approvals need iteration by agentId.
// These Sets track which IDs belong to which agent.
// They are kept in sync with the LRU cache.
// ============================================

const suggestionIndex: Map<string, Set<string>> = new Map();
const approvalIndex: Map<string, Set<string>> = new Map();

function getSuggestionIdSet(agentId: string): Set<string> {
  let set = suggestionIndex.get(agentId);
  if (!set) {
    set = new Set();
    suggestionIndex.set(agentId, set);
  }
  return set;
}

function getApprovalIdSet(agentId: string): Set<string> {
  let set = approvalIndex.get(agentId);
  if (!set) {
    set = new Set();
    approvalIndex.set(agentId, set);
  }
  return set;
}

// ============================================
// Types
// ============================================

export type ActionType =
  | "tip"
  | "purchase"
  | "mint"
  | "premium"
  | "agent_to_agent"
  | "external_search"
  | "external_purchase"
  /**
   * GoodDollar UBI claim. See ADR 0009. Caps are app-layer audit honesty —
   * GoodDollar's `ClaimFacet` enforces the real rate limit on-chain.
   */
  | "ubi_claim";

export interface SpendingLimit {
  agentId: string;
  actionType: ActionType;
  dailyLimit: bigint;
  perActionLimit: bigint;
  spentToday: bigint;
  lastResetTimestamp: number;
  requiresApproval: boolean;
}

export interface ApprovalRequest {
  id: string;
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: number;
  expiresAt: number;
  userSignature?: string;
}

export interface AgentControlsConfig {
  agentId: string;
  maxBalance?: bigint;
  dailyTipLimit?: bigint;
  dailyPurchaseLimit?: bigint;
  dailyMintLimit?: bigint;
  requireApprovalAbove?: bigint;
  autonomyThreshold?: bigint;
}

// ============================================
// Agent Suggestion Types
// ============================================

export type SuggestionStatus =
  | "pending"
  | "accepted"
  | "rejected"
  | "expired"
  | "executed";

export interface AgentSuggestion {
  id: string;
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: number;
  expiresAt: number;
  autoApprovable: boolean;
  source?: string;
  externalUrl?: string;
  liveUrl?: string;
  isSearching?: boolean;
  products?: Array<{
    name: string;
    price: number;
    source: string;
    url: string;
    image_url?: string;
    currency?: string;
  }>;
  verifiableLogCid?: string;
  signature?: string;
}

// ============================================
// Style Memory Types
// ============================================

export interface StylePreference {
  userId: string;
  colors: string[];
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  lastUpdated: number;
  bodyType?: "slim" | "athletic" | "average" | "plus" | "petite" | "tall";
  styleAesthetics?: string[];
  budgetTier?: "budget-friendly" | "moderate" | "premium" | "luxury";
  /** Max price the agent can auto-buy without approval. 0 = disabled (no auto-buy). */
  autoBuyMaxPrice?: number;
}

export interface StyleRecommendation {
  id: string;
  userId: string;
  productId: string;
  reason: string;
  confidence: number;
  createdAt: number;
}

// ============================================
// Default Configurations
// ============================================

const DEFAULT_LIMITS: Record<
  ActionType,
  Omit<SpendingLimit, "agentId" | "spentToday" | "lastResetTimestamp">
> = {
  tip: {
    actionType: "tip",
    dailyLimit: parseEther("100"),
    perActionLimit: parseEther("10"),
    requiresApproval: false,
  },
  purchase: {
    actionType: "purchase",
    dailyLimit: parseEther("500"),
    perActionLimit: parseEther("100"),
    requiresApproval: true,
  },
  mint: {
    actionType: "mint",
    dailyLimit: parseEther("50"),
    perActionLimit: parseEther("10"),
    requiresApproval: true,
  },
  premium: {
    actionType: "premium",
    dailyLimit: parseEther("20"),
    perActionLimit: parseEther("0.5"),
    requiresApproval: false,
  },
  agent_to_agent: {
    actionType: "agent_to_agent",
    dailyLimit: parseEther("50"),
    perActionLimit: parseEther("5"),
    requiresApproval: false,
  },
  external_search: {
    actionType: "external_search",
    dailyLimit: parseEther("10"),
    perActionLimit: parseEther("0.1"),
    requiresApproval: false,
  },
  external_purchase: {
    actionType: "external_purchase",
    dailyLimit: parseEther("1000"),
    perActionLimit: parseEther("200"),
    requiresApproval: true,
  },
  ubi_claim: {
    actionType: "ubi_claim",
    dailyLimit: parseEther("1"),
    perActionLimit: parseEther("1"),
    requiresApproval: false,
  },
};

const DEFAULT_AUTONOMY_THRESHOLD = parseEther("5"); // 5 cUSD

// ============================================
// Init Store — Warmup Redis → LRU Cache
// ============================================

/**
 * Initialize and warm the store for a given agent+user.
 * On first call: loads all Redis state into the LRU cache.
 * On subsequent calls: records heartbeat (lightweight).
 * Handles Redis outages gracefully — falls back to defaults.
 */
export async function initStore(
  agentId: string,
  userId: string,
): Promise<void> {
  const limitsKey = KEY.spendingLimits(agentId, userId);

  // If already in cache, just record heartbeat and return
  if (CACHE.has(limitsKey)) {
    await recordHeartbeat(agentId, userId).catch(() => {});
    return;
  }

  // Record heartbeat first
  await recordHeartbeat(agentId, userId).catch(() => {});

  if (!isRedisConfigured()) return;

  try {
    // Warmup spending limits
    const limits = await loadSpendingLimits(agentId, userId);
    if (limits) {
      CACHE.set(limitsKey, limits, { ttl: CACHE_TTL.spendingLimits });
    }

    // Warmup autonomy threshold
    const threshold = await loadAutonomyThreshold(agentId, userId);
    if (threshold !== null) {
      CACHE.set(KEY.autonomyThreshold(agentId, userId), threshold.toString(), {
        ttl: CACHE_TTL.autonomyThreshold,
      });
    }

    // Warmup suggestions
    const suggestionIds = await loadSuggestionIds(agentId, userId);
    const idSet = getSuggestionIdSet(agentId);
    for (const id of suggestionIds) {
      idSet.add(id);
      const suggestion = await loadSuggestionFromStore(id);
      if (suggestion) {
        CACHE.set(KEY.suggestion(id), suggestion, {
          ttl: CACHE_TTL.suggestion,
        });
      }
    }

    // Warmup approvals
    const approvalIds = await loadApprovalIds(agentId, userId);
    const approvalIdSet = getApprovalIdSet(agentId);
    for (const id of approvalIds) {
      approvalIdSet.add(id);
      const approval = await loadApproval(id);
      if (approval) {
        CACHE.set(KEY.approval(id), approval, { ttl: CACHE_TTL.approval });
      }
    }

    // Warmup style preferences
    // We don't know the userId here, so style prefs are lazily loaded
  } catch (err) {
    logger.error(
      "Redis warmup failed — will use defaults until Redis recovers",
      { component: "agent-controls", agentId, userId },
      err,
    );
  }
}


// ============================================
// Core Functions — Spending Limits
// ============================================

export function initializeAgentLimits(
  agentId: string,
  userId: string,
  config?: Partial<AgentControlsConfig>,
): SpendingLimit[] {
  const limits: SpendingLimit[] = [];

  for (const [actionType, defaults] of Object.entries(DEFAULT_LIMITS)) {
    limits.push({
      agentId,
      actionType: actionType as ActionType,
      dailyLimit: defaults.dailyLimit,
      perActionLimit: defaults.perActionLimit,
      spentToday: 0n,
      lastResetTimestamp: Date.now(),
      requiresApproval: defaults.requiresApproval,
    });
  }

  if (config?.dailyTipLimit) {
    const tipLimit = limits.find((l) => l.actionType === "tip");
    if (tipLimit) tipLimit.dailyLimit = config.dailyTipLimit;
  }

  if (config?.dailyPurchaseLimit) {
    const purchaseLimit = limits.find((l) => l.actionType === "purchase");
    if (purchaseLimit) purchaseLimit.dailyLimit = config.dailyPurchaseLimit;
  }

  if (config?.dailyMintLimit) {
    const mintLimit = limits.find((l) => l.actionType === "mint");
    if (mintLimit) mintLimit.dailyLimit = config.dailyMintLimit;
  }

  // Write-through: LRU cache + Redis
  const key = KEY.spendingLimits(agentId, userId);
  CACHE.set(key, limits, { ttl: CACHE_TTL.spendingLimits });
  persistSpendingLimits(agentId, userId, limits).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return limits;
}

export function getAgentLimits(
  agentId: string,
  userId: string,
): SpendingLimit[] {
  const key = KEY.spendingLimits(agentId, userId);
  const cached = CACHE.get(key) as SpendingLimit[] | undefined;
  if (cached) return cached;

  // Cache miss — initialize with defaults and kick off background Redis load
  const limits = initializeAgentLimits(agentId, userId);

  // Background fetch from Redis to get real state
  loadSpendingLimits(agentId, userId).then((redisLimits) => {
    if (redisLimits) {
      CACHE.set(key, redisLimits, { ttl: CACHE_TTL.spendingLimits });
    }
  }).catch(() => {
    // Fall back to defaults — already set
  });

  return limits;
}

export function checkSpendingLimit(
  agentId: string,
  userId: string,
  actionType: ActionType,
  amount: bigint,
): { allowed: boolean; reason?: string; limit?: SpendingLimit } {
  const limits = getAgentLimits(agentId, userId);
  const limit = limits.find((l) => l.actionType === actionType);

  if (!limit) {
    return { allowed: false, reason: `Unknown action type: ${actionType}` };
  }

  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  if (now - limit.lastResetTimestamp > dayInMs) {
    limit.spentToday = 0n;
    limit.lastResetTimestamp = now;
  }

  if (amount > limit.perActionLimit) {
    return {
      allowed: false,
      reason: `Amount ${formatEther(amount)} exceeds per-action limit of ${formatEther(limit.perActionLimit)}`,
      limit,
    };
  }

  if (limit.spentToday + amount > limit.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit exceeded. Spent: ${formatEther(limit.spentToday)}, Limit: ${formatEther(limit.dailyLimit)}`,
      limit,
    };
  }

  return { allowed: true, limit };
}

export function recordSpending(
  agentId: string,
  userId: string,
  actionType: ActionType,
  amount: bigint,
): void {
  const limits = getAgentLimits(agentId, userId);
  const limit = limits.find((l) => l.actionType === actionType);
  if (limit) {
    limit.spentToday += amount;
    Metrics.countAction(actionType, "succeeded");
    // Write-through: update cache TTL and persist to Redis
    const key = KEY.spendingLimits(agentId, userId);
    CACHE.set(key, limits, { ttl: CACHE_TTL.spendingLimits });
    persistSpendingLimits(agentId, userId, limits).catch((err) =>
      logger.error("Persist failed", { component: "agent-controls" }, err),
    );
  }
}

export async function recordSpendingWithEscrow(
  agentId: string,
  userId: string,
  actionType: ActionType,
  amount: bigint,
): Promise<void> {
  recordSpending(agentId, userId, actionType, amount);
  try {
    await deductFromEscrow(userId, agentId, amount);
  } catch (err) {
    logger.error(
      "Escrow deduction failed",
      { component: "agent-controls", userId, agentId, amount: amount.toString() },
      err,
    );
  }
}

export function getRemainingLimit(
  agentId: string,
  userId: string,
  actionType: ActionType,
): { daily: bigint; remaining: bigint; perAction: bigint } {
  const limits = getAgentLimits(agentId, userId);
  const limit = limits.find((l) => l.actionType === actionType);

  if (!limit) {
    return { daily: 0n, remaining: 0n, perAction: 0n };
  }

  const remaining = limit.dailyLimit - limit.spentToday;
  return {
    daily: limit.dailyLimit,
    remaining: remaining > 0n ? remaining : 0n,
    perAction: limit.perActionLimit,
  };
}

// ============================================
// Autonomy Threshold
// ============================================

export function setAutonomyThreshold(
  agentId: string,
  userId: string,
  threshold: bigint,
): void {
  const key = KEY.autonomyThreshold(agentId, userId);
  CACHE.set(key, threshold.toString(), { ttl: CACHE_TTL.autonomyThreshold });
  persistAutonomyThreshold(agentId, userId, threshold).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
}

export function getAutonomyThreshold(
  agentId: string,
  userId: string,
): bigint {
  const key = KEY.autonomyThreshold(agentId, userId);
  const cached = CACHE.get(key) as string | undefined;
  if (cached !== undefined) return BigInt(cached);

  // Background fetch from Redis
  loadAutonomyThreshold(agentId, userId).then((threshold) => {
    if (threshold !== null) {
      CACHE.set(key, threshold.toString(), {
        ttl: CACHE_TTL.autonomyThreshold,
      });
    }
  }).catch(() => {});

  return DEFAULT_AUTONOMY_THRESHOLD;
}

export function isBelowAutonomyThreshold(
  agentId: string,
  userId: string,
  amount: bigint,
): boolean {
  const threshold = getAutonomyThreshold(agentId, userId);
  return amount <= threshold;
}

// ============================================
// Suggestions
// ============================================

export function createSuggestion(params: {
  id?: string;
  agentId: string;
  userId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  expiresInMinutes?: number;
}): AgentSuggestion {
  const id =
    params.id ||
    `suggestion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresIn = params.expiresInMinutes || 10;

  const amountWei = parseAmount(params.amount);
  const autoApprovable = isBelowAutonomyThreshold(
    params.agentId,
    params.userId,
    amountWei,
  );

  const suggestion: AgentSuggestion = {
    id,
    agentId: params.agentId,
    actionType: params.actionType,
    amount: params.amount,
    description: params.description,
    recipient: params.recipient,
    metadata: params.metadata,
    status: autoApprovable ? "accepted" : "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresIn * 60 * 1000,
    autoApprovable,
  };

  // Write-through: LRU cache + index + Redis
  CACHE.set(KEY.suggestion(id), suggestion, { ttl: CACHE_TTL.suggestion });
  getSuggestionIdSet(params.agentId).add(id);
  persistSuggestion(suggestion, params.userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return suggestion;
}

export function getSuggestion(id: string): AgentSuggestion | null {
  const cached = CACHE.get(KEY.suggestion(id)) as AgentSuggestion | null | undefined;
  if (!cached) return null;

  if (Date.now() > cached.expiresAt && cached.status === "pending") {
    cached.status = "expired";
    CACHE.set(KEY.suggestion(id), cached, { ttl: CACHE_TTL.suggestion });
  }

  return cached;
}

export function acceptSuggestion(id: string, userId: string): boolean {
  const suggestion = getSuggestion(id);
  if (!suggestion || suggestion.status !== "pending") return false;
  if (Date.now() > suggestion.expiresAt) {
    suggestion.status = "expired";
    return false;
  }

  suggestion.status = "accepted";
  CACHE.set(KEY.suggestion(id), suggestion, { ttl: CACHE_TTL.suggestion });
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function rejectSuggestion(id: string, userId: string): boolean {
  const suggestion = getSuggestion(id);
  if (!suggestion || suggestion.status !== "pending") return false;

  suggestion.status = "rejected";
  CACHE.set(KEY.suggestion(id), suggestion, { ttl: CACHE_TTL.suggestion });
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function markSuggestionExecuted(id: string, userId: string): boolean {
  const suggestion = getSuggestion(id);
  if (!suggestion || suggestion.status !== "accepted") return false;

  suggestion.status = "executed";
  CACHE.set(KEY.suggestion(id), suggestion, { ttl: CACHE_TTL.suggestion });
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function getPendingSuggestions(agentId: string): AgentSuggestion[] {
  const now = Date.now();
  const ids = getSuggestionIdSet(agentId);
  const results: AgentSuggestion[] = [];

  for (const id of ids) {
    const suggestion = getSuggestion(id);
    if (
      suggestion &&
      (suggestion.status === "pending" || suggestion.status === "accepted") &&
      suggestion.expiresAt > now
    ) {
      results.push(suggestion);
    }
  }

  return results;
}

// ============================================
// Style Memory
// ============================================

const DEFAULT_STYLE_PREFS: Omit<StylePreference, "userId"> = {
  colors: [],
  categories: [],
  brands: [],
  priceRange: { min: 0, max: 500 },
  lastUpdated: 0,
};

export function getStylePreferences(userId: string): StylePreference {
  const key = KEY.stylePrefs(userId);
  const cached = CACHE.get(key) as StylePreference | undefined;
  if (cached) return cached;

  // Background load from Redis
  loadStylePreferences(userId).then((prefs) => {
    if (prefs) {
      CACHE.set(key, prefs, { ttl: CACHE_TTL.stylePrefs });
    }
  }).catch(() => {});

  // Return default
  const prefs: StylePreference = {
    userId,
    ...DEFAULT_STYLE_PREFS,
    lastUpdated: Date.now(),
  };
  CACHE.set(key, prefs, { ttl: CACHE_TTL.stylePrefs });
  return prefs;
}

export function updateStylePreferences(
  userId: string,
  updates: Partial<Omit<StylePreference, "userId" | "lastUpdated">>,
): StylePreference {
  const prefs = getStylePreferences(userId);

  if (updates.colors)
    prefs.colors = [...new Set([...prefs.colors, ...updates.colors])];
  if (updates.categories)
    prefs.categories = [
      ...new Set([...prefs.categories, ...updates.categories]),
    ];
  if (updates.brands)
    prefs.brands = [...new Set([...prefs.brands, ...updates.brands])];
  if (updates.priceRange) prefs.priceRange = updates.priceRange;
  if (updates.autoBuyMaxPrice !== undefined)
    prefs.autoBuyMaxPrice = updates.autoBuyMaxPrice;
  prefs.lastUpdated = Date.now();

  const key = KEY.stylePrefs(userId);
  CACHE.set(key, prefs, { ttl: CACHE_TTL.stylePrefs });
  persistStylePreferences(prefs).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return prefs;
}

export function trackStyleInteraction(
  userId: string,
  product: { category: string; price: number },
): void {
  updateStylePreferences(userId, {
    categories: [product.category],
    priceRange: {
      min: 0,
      max: Math.max(product.price * 1.5, 500),
    },
  });
}

// ============================================
// Approvals
// ============================================

export function createApprovalRequest(params: {
  agentId: string;
  userId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  expiresInMinutes?: number;
}): ApprovalRequest {
  const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresIn = params.expiresInMinutes || 5;

  const request: ApprovalRequest = {
    id,
    agentId: params.agentId,
    actionType: params.actionType,
    amount: params.amount,
    description: params.description,
    recipient: params.recipient,
    metadata: params.metadata,
    status: "pending",
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresIn * 60 * 1000,
  };

  // Write-through: LRU + index + Redis
  CACHE.set(KEY.approval(id), request, { ttl: CACHE_TTL.approval });
  getApprovalIdSet(params.agentId).add(id);
  persistApproval(request, params.userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return request;
}

export function getApprovalRequest(id: string): ApprovalRequest | null {
  const request = CACHE.get(KEY.approval(id)) as ApprovalRequest | undefined;
  if (!request) return null;

  if (Date.now() > request.expiresAt && request.status === "pending") {
    request.status = "expired";
    CACHE.set(KEY.approval(id), request, { ttl: CACHE_TTL.approval });
  }

  return request;
}

export function approveRequest(
  id: string,
  userId: string,
  userSignature?: string,
): boolean {
  const request = getApprovalRequest(id);
  if (!request || request.status !== "pending") return false;
  if (Date.now() > request.expiresAt) {
    request.status = "expired";
    return false;
  }

  request.status = "approved";
  request.userSignature = userSignature;
  CACHE.set(KEY.approval(id), request, { ttl: CACHE_TTL.approval });
  persistApproval(request, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function rejectRequest(id: string, userId: string): boolean {
  const request = getApprovalRequest(id);
  if (!request || request.status !== "pending") return false;

  request.status = "rejected";
  CACHE.set(KEY.approval(id), request, { ttl: CACHE_TTL.approval });
  persistApproval(request, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function getPendingApprovals(agentId: string): ApprovalRequest[] {
  const now = Date.now();
  const ids = getApprovalIdSet(agentId);
  const results: ApprovalRequest[] = [];

  for (const id of ids) {
    const request = getApprovalRequest(id);
    if (
      request &&
      request.status === "pending" &&
      request.expiresAt > now
    ) {
      results.push(request);
    }
  }

  return results;
}

// ============================================
// Action Validation
// ============================================

export function validateAction(params: {
  agentId: string;
  userId: string;
  actionType: ActionType;
  amount: bigint;
  amountFormatted: string;
  description: string;
  recipient?: string;
}): {
  allowed: boolean;
  requiresApproval: boolean;
  autoApproved: boolean;
  approvalRequest?: ApprovalRequest;
  reason?: string;
  limit?: SpendingLimit;
  escrowCheck?: boolean;
} {
  const { agentId, userId, actionType, amount, amountFormatted, description, recipient } =
    params;

  const limitCheck = checkSpendingLimit(agentId, userId, actionType, amount);

  if (!limitCheck.allowed) {
    Metrics.countAction(actionType, "failed");
    return {
      allowed: false,
      requiresApproval: false,
      autoApproved: false,
      reason: limitCheck.reason,
      limit: limitCheck.limit,
    };
  }

  Metrics.countAction(actionType, "attempted");

  const limit = limitCheck.limit!;

  if (!limit.requiresApproval) {
    return {
      allowed: true,
      requiresApproval: false,
      autoApproved: false,
      limit,
    };
  }

  if (isBelowAutonomyThreshold(agentId, userId, amount)) {
    return {
      allowed: true,
      requiresApproval: false,
      autoApproved: true,
      limit,
    };
  }

  const approvalRequest = createApprovalRequest({
    agentId,
    userId,
    actionType,
    amount: amountFormatted,
    description,
    recipient,
  });

  return {
    allowed: false,
    requiresApproval: true,
    autoApproved: false,
    approvalRequest,
    limit,
  };
}

export async function validateActionWithEscrow(params: {
  agentId: string;
  userId: string;
  actionType: ActionType;
  amount: bigint;
  amountFormatted: string;
  description: string;
  recipient?: string;
}): Promise<{
  allowed: boolean;
  requiresApproval: boolean;
  requiresMultiSig: boolean;
  autoApproved: boolean;
  approvalRequest?: ApprovalRequest;
  multiSigTxId?: string;
  reason?: string;
  limit?: SpendingLimit;
  escrowCheck: boolean;
  fraudCheck: boolean;
  anomalyScore?: number;
  flags?: string[];
}> {
  const { agentId, userId, amount, recipient } = params;

  const frozenCheck = await isAgentFrozen(agentId, userId);
  if (frozenCheck.frozen) {
    return {
      allowed: false,
      requiresApproval: false,
      requiresMultiSig: false,
      autoApproved: false,
      reason: `Agent is frozen: ${frozenCheck.reason}`,
      escrowCheck: false,
      fraudCheck: true,
    };
  }

  const health = await checkAgentHealth(agentId, userId);
  if (health.status === "frozen") {
    return {
      allowed: false,
      requiresApproval: false,
      requiresMultiSig: false,
      autoApproved: false,
      reason: "Agent health check failed - frozen",
      escrowCheck: false,
      fraudCheck: true,
    };
  }

  const standardCheck = validateAction(params);

  if (!standardCheck.allowed && !standardCheck.requiresApproval) {
    return {
      ...standardCheck,
      escrowCheck: false,
      fraudCheck: false,
      requiresMultiSig: false,
    };
  }

  const escrowCheck = await canSpendFromEscrow(userId, agentId, amount);

  if (!escrowCheck.allowed) {
    return {
      allowed: false,
      requiresApproval: false,
      requiresMultiSig: false,
      autoApproved: false,
      reason: `Escrow check failed: ${escrowCheck.reason}`,
      escrowCheck: true,
      fraudCheck: false,
    };
  }

  const fraudAnalysis = await analyzeTransactionPattern(
    userId,
    agentId,
    amount,
    recipient || "unknown",
  );

  if (fraudAnalysis.flags.length > 0) {
    await updateAnomalyScore(agentId, userId, fraudAnalysis.anomalyScore);
  }

  if (fraudAnalysis.anomalyScore >= 50) {
    return {
      allowed: false,
      requiresApproval: false,
      requiresMultiSig: false,
      autoApproved: false,
      reason: `Transaction blocked due to suspicious pattern (score: ${fraudAnalysis.anomalyScore})`,
      escrowCheck: true,
      fraudCheck: true,
      anomalyScore: fraudAnalysis.anomalyScore,
      flags: fraudAnalysis.flags,
    };
  }

  const needsMultiSig = requiresMultiSig(amount);

  if (needsMultiSig) {
    const multiSigReq = await createMultiSigRequirement(
      userId,
      agentId,
      amount,
      recipient || "unknown",
      params.description,
    );

    return {
      allowed: false,
      requiresApproval: true,
      requiresMultiSig: true,
      autoApproved: false,
      multiSigTxId: multiSigReq.transactionId,
      reason: "Multi-signature required for transactions over $500",
      escrowCheck: true,
      fraudCheck: true,
      anomalyScore: fraudAnalysis.anomalyScore,
      flags: fraudAnalysis.flags,
    };
  }

  return {
    ...standardCheck,
    requiresMultiSig: false,
    escrowCheck: true,
    fraudCheck: true,
    anomalyScore: fraudAnalysis.anomalyScore,
    flags: fraudAnalysis.flags,
  };
}

export function suggestAction(params: {
  agentId: string;
  userId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
}): {
  suggestion: AgentSuggestion;
  autoExecuted: boolean;
} {
  const suggestion = createSuggestion(params);

  if (suggestion.autoApprovable) {
    return { suggestion, autoExecuted: true };
  }

  return { suggestion, autoExecuted: false };
}

export async function dispatchExternalAction(
  userId: string,
  action: {
    type: "search" | "purchase" | "action";
    payload: Record<string, unknown>;
  },
): Promise<{ success: boolean; data?: any; error?: string }> {
  const bridgeUrl = process.env.EXTERNAL_AGENT_URL;

  if (!bridgeUrl) {
    return {
      success: false,
      error: "EXTERNAL_AGENT_URL not configured. Web-Bridge is disabled.",
    };
  }

  // ADR 0008 D6/D7 + review #1 fix: when payload.stream is true, route to
  // the SSE variant and *consume the stream* (not response.json() — SSE
  // bodies are not valid JSON). We accumulate frames until we see the
  // terminal `result` event (whose payload mirrors the JSON SearchResponse),
  // then return it as `data`.
  const wantsStream = Boolean((action.payload as any)?.stream);
  const endpoint = wantsStream ? `${bridgeUrl}/v1/agent/search/stream` : `${bridgeUrl}/v1/agent/${action.type}`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (wantsStream) headers["Accept"] = "text/event-stream";
  // Bridge requires Authorization in production (verify_api_key gates
  // every endpoint on it). lib/product-search.js already does this; the
  // agent-controls path (used by the worker for external_search and
  // market-signals) was missing it, causing silent 401s in production.
  // BRIDGE_API_KEY is the canonical var; fall back to SERVICE_API_KEY
  // to match the product-search pattern and minimise config drift.
  const bridgeAuthKey = process.env.BRIDGE_API_KEY || process.env.SERVICE_API_KEY;
  if (bridgeAuthKey) {
    headers["Authorization"] = `Bearer ${bridgeAuthKey}`;
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, ...action.payload }),
    });

    if (!response.ok) {
      throw new Error(`Bridge returned error: ${response.statusText}`);
    }

    // Non-streaming path: a single JSON body, unchanged from before.
    if (!wantsStream) {
      const data = await response.json();
      return { success: true, data };
    }

    // Streaming path: parse `event:` / `data:` frames from the SSE body
    // until we see the terminal `result` event. Anything before that
    // (`phase.starting`, `phase.running`, `phase.error`) is discarded
    // after being logged — the caller's contract is the final payload.
    if (!response.body) {
      throw new Error("Bridge SSE response had no body");
    }

    const reader = (response.body as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentEvent = "";
    let resultPayload: any = null;

    // Hard cap on stream consumption to prevent infinite loops on
    // malformed streams. Each search is bounded by max_wait_ms server-side,
    // so 5 MB of accumulated text is a generous ceiling.
    const MAX_BYTES = 5 * 1024 * 1024;
    let bytesRead = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Bridge SSE stream exceeded size cap");
      }
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are delimited by a blank line. Process any complete
      // frames currently in the buffer.
      let frameEnd;
      while ((frameEnd = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, frameEnd);
        buffer = buffer.slice(frameEnd + 2);

        let dataLines: string[] = [];
        for (const line of frame.split("\n")) {
          if (line.startsWith("event:")) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith("data:")) {
            dataLines.push(line.slice(5).trim());
          }
        }
        const dataStr = dataLines.join("\n");
        if (!dataStr) continue;

        if (currentEvent === "result") {
          try {
            resultPayload = JSON.parse(dataStr);
          } catch (parseErr) {
            throw new Error(
              `Bridge SSE 'result' event was not valid JSON: ${dataStr.slice(0, 200)}`,
            );
          }
          // Terminal — drain remaining buffered bytes and stop.
          await reader.cancel();
          break;
        }
        if (currentEvent === "phase.error") {
          // Surface as a soft failure — phase.error can arrive without a
          // terminal `result` event. Capture the error and stop.
          try {
            const errData = JSON.parse(dataStr);
            return {
              success: false,
              error: errData?.error || "Bridge reported phase error",
            };
          } catch {
            return { success: false, error: "Bridge reported phase error" };
          }
        }
        // Other phase events (phase.starting, phase.running, phase.done)
        // are intentionally ignored here — the caller's contract is the
        // final structured payload, which only `result` carries.
      }

      if (resultPayload !== null) break;
    }

    if (resultPayload === null) {
      return {
        success: false,
        error: "Bridge SSE stream ended without a `result` event",
      };
    }

    return { success: true, data: resultPayload };
  } catch (err) {
    logger.error(
      "External action dispatch failed",
      { component: "agent-controls" },
      err,
    );
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown bridge error",
    };
  }
}

// ============================================
// Helpers
// ============================================

function parseAmount(amount: string): bigint {
  const cleaned = amount.replace(/[^0-9.]/g, "");
  return parseEther(cleaned || "0");
}

// ============================================
// Exports
// ============================================

export const AgentControls = {
  initStore,
  initializeAgentLimits,
  getAgentLimits,
  checkSpendingLimit,
  recordSpending,
  recordSpendingWithEscrow,
  getRemainingLimit,
  setAutonomyThreshold,
  getAutonomyThreshold,
  isBelowAutonomyThreshold,
  createSuggestion,
  getSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  markSuggestionExecuted,
  getPendingSuggestions,
  getStylePreferences,
  updateStylePreferences,
  trackStyleInteraction,
  validateAction,
  validateActionWithEscrow,
  suggestAction,
  createApprovalRequest,
  getApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,
  dispatchExternalAction,
};
