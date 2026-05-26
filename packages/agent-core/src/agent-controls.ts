/**
 * Agent Controls Middleware
 *
 * Provides spending limits, approval workflows, and action controls
 * for AI agent operations. Runs at the API layer to enforce
 * business logic before any blockchain transactions.
 */

import { parseEther, formatEther } from "viem";
import { logger } from "./logger";
import {
  loadSpendingLimits,
  persistSpendingLimits,
  loadAutonomyThreshold,
  persistAutonomyThreshold,
  persistSuggestion,
  loadSuggestion as loadSuggestionFromStore,
  persistApproval,
  persistStylePreferences,
  loadStylePreferences,
  hydrateSuggestions,
  hydrateApprovals,
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
// Types
// ============================================

export type ActionType =
  | "tip"
  | "purchase"
  | "mint"
  | "premium"
  | "agent_to_agent"
  | "external_search"
  | "external_purchase";

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
};

const DEFAULT_AUTONOMY_THRESHOLD = parseEther("5"); // 5 cUSD

// ============================================
// In-Memory Store
// ============================================

const spendingLimits: Map<string, SpendingLimit[]> = new Map();
const autonomyThresholds: Map<string, bigint> = new Map();
const pendingSuggestions: Map<string, AgentSuggestion> = new Map();
const stylePreferences: Map<string, StylePreference> = new Map();
const pendingApprovals: Map<string, ApprovalRequest> = new Map();
const hydratedKeys: Set<string> = new Set();

function storeKey(agentId: string, userId: string): string {
  return `${agentId}:${userId}`;
}

export async function initStore(
  agentId: string,
  userId: string,
): Promise<void> {
  const key = storeKey(agentId, userId);
  if (hydratedKeys.has(key)) {
    await recordHeartbeat(agentId, userId).catch(() => {});
    return;
  }
  hydratedKeys.add(key);

  if (!isRedisConfigured()) return;

  try {
    await recordHeartbeat(agentId, userId);

    const limits = await loadSpendingLimits(agentId, userId);
    if (limits) {
      spendingLimits.set(key, limits);
    }

    const threshold = await loadAutonomyThreshold(agentId, userId);
    if (threshold !== null) {
      autonomyThresholds.set(key, threshold);
    }

    await Promise.all([
      hydrateSuggestions(agentId, userId, pendingSuggestions),
      hydrateApprovals(agentId, userId, pendingApprovals),
    ]);
  } catch (err) {
    logger.error(
      "Redis hydration failed",
      { component: "agent-controls", agentId, userId },
      err,
    );
  }
}

// ============================================
// Core Functions
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

  const key = storeKey(agentId, userId);
  spendingLimits.set(key, limits);
  persistSpendingLimits(agentId, userId, limits).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return limits;
}

export function getAgentLimits(
  agentId: string,
  userId: string,
): SpendingLimit[] {
  const key = storeKey(agentId, userId);
  return spendingLimits.get(key) || initializeAgentLimits(agentId, userId);
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
  const key = storeKey(agentId, userId);
  autonomyThresholds.set(key, threshold);
  persistAutonomyThreshold(agentId, userId, threshold).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
}

export function getAutonomyThreshold(agentId: string, userId: string): bigint {
  const key = storeKey(agentId, userId);
  return autonomyThresholds.get(key) || DEFAULT_AUTONOMY_THRESHOLD;
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

  pendingSuggestions.set(id, suggestion);
  persistSuggestion(suggestion, params.userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return suggestion;
}

export function getSuggestion(id: string): AgentSuggestion | null {
  const suggestion = pendingSuggestions.get(id);
  if (!suggestion) return null;

  if (Date.now() > suggestion.expiresAt && suggestion.status === "pending") {
    suggestion.status = "expired";
  }

  return suggestion;
}

export function acceptSuggestion(id: string, userId: string): boolean {
  const suggestion = pendingSuggestions.get(id);
  if (!suggestion || suggestion.status !== "pending") return false;
  if (Date.now() > suggestion.expiresAt) {
    suggestion.status = "expired";
    return false;
  }

  suggestion.status = "accepted";
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function rejectSuggestion(id: string, userId: string): boolean {
  const suggestion = pendingSuggestions.get(id);
  if (!suggestion || suggestion.status !== "pending") return false;

  suggestion.status = "rejected";
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function markSuggestionExecuted(id: string, userId: string): boolean {
  const suggestion = pendingSuggestions.get(id);
  if (!suggestion || suggestion.status !== "accepted") return false;

  suggestion.status = "executed";
  persistSuggestion(suggestion, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function getPendingSuggestions(agentId: string): AgentSuggestion[] {
  const now = Date.now();
  return Array.from(pendingSuggestions.values()).filter(
    (s) =>
      s.agentId === agentId &&
      (s.status === "pending" || s.status === "accepted") &&
      s.expiresAt > now,
  );
}

// ============================================
// Style Memory
// ============================================

export function getStylePreferences(userId: string): StylePreference {
  if (!stylePreferences.has(userId)) {
    stylePreferences.set(userId, {
      userId,
      colors: [],
      categories: [],
      brands: [],
      priceRange: { min: 0, max: 500 },
      lastUpdated: Date.now(),
    });
  }
  return stylePreferences.get(userId)!;
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
  prefs.lastUpdated = Date.now();

  stylePreferences.set(userId, prefs);
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

  pendingApprovals.set(id, request);
  persistApproval(request, params.userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return request;
}

export function getApprovalRequest(id: string): ApprovalRequest | null {
  const request = pendingApprovals.get(id);
  if (!request) return null;

  if (Date.now() > request.expiresAt && request.status === "pending") {
    request.status = "expired";
  }

  return request;
}

export function approveRequest(
  id: string,
  userId: string,
  userSignature?: string,
): boolean {
  const request = pendingApprovals.get(id);
  if (!request || request.status !== "pending") return false;
  if (Date.now() > request.expiresAt) {
    request.status = "expired";
    return false;
  }

  request.status = "approved";
  request.userSignature = userSignature;
  persistApproval(request, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function rejectRequest(id: string, userId: string): boolean {
  const request = pendingApprovals.get(id);
  if (!request || request.status !== "pending") return false;

  request.status = "rejected";
  persistApproval(request, userId).catch((err) =>
    logger.error("Persist failed", { component: "agent-controls" }, err),
  );
  return true;
}

export function getPendingApprovals(agentId: string): ApprovalRequest[] {
  const now = Date.now();
  return Array.from(pendingApprovals.values()).filter(
    (req) =>
      req.agentId === agentId &&
      req.status === "pending" &&
      req.expiresAt > now,
  );
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
    return {
      allowed: false,
      requiresApproval: false,
      autoApproved: false,
      reason: limitCheck.reason,
      limit: limitCheck.limit,
    };
  }

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

  try {
    const response = await fetch(`${bridgeUrl}/v1/agent/${action.type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, ...action.payload }),
    });

    if (!response.ok) {
      throw new Error(`Bridge returned error: ${response.statusText}`);
    }

    const data = await response.json();
    return { success: true, data };
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
