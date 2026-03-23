/**
 * Agent Controls Middleware
 *
 * Provides spending limits, approval workflows, and action controls
 * for AI agent operations. This runs at the API layer to enforce
 * business logic before any blockchain transactions.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

import { parseEther, formatEther } from "viem";
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

// Re-export for API routes that need direct store access
export { loadSuggestionFromStore };

// ============================================
// Types
// ============================================

export type ActionType =
  | "tip"
  | "purchase"
  | "mint"
  | "premium"
  | "agent_to_agent";

export interface SpendingLimit {
  agentId: string;
  actionType: ActionType;
  dailyLimit: bigint; // in wei
  perActionLimit: bigint; // in wei
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
  requireApprovalAbove?: bigint; // Amount requiring approval
  autonomyThreshold?: bigint; // Amount below which actions auto-approve silently
}

// ============================================
// Agent Suggestion Types (for quick accept)
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
  autoApprovable: boolean; // True if below autonomy threshold
}

// ============================================
// Style Memory Types (for recommendations)
// ============================================

export interface StylePreference {
  userId: string;
  colors: string[];
  categories: string[];
  brands: string[];
  priceRange: { min: number; max: number };
  lastUpdated: number;
}

export interface StyleRecommendation {
  id: string;
  userId: string;
  productId: string;
  reason: string;
  confidence: number; // 0-100
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
    dailyLimit: parseEther("100"), // 100 cUSD/day
    perActionLimit: parseEther("10"), // 10 cUSD per tip
    requiresApproval: false,
  },
  purchase: {
    actionType: "purchase",
    dailyLimit: parseEther("500"), // 500 cUSD/day
    perActionLimit: parseEther("100"), // 100 cUSD per purchase
    requiresApproval: true, // Purchases require approval
  },
  mint: {
    actionType: "mint",
    dailyLimit: parseEther("50"), // 50 cUSD/day for gas
    perActionLimit: parseEther("10"), // 10 cUSD per mint
    requiresApproval: true, // Mints require approval
  },
  premium: {
    actionType: "premium",
    dailyLimit: parseEther("20"), // 20 cUSD/day
    perActionLimit: parseEther("0.5"), // 0.5 cUSD per session
    requiresApproval: false,
  },
  agent_to_agent: {
    actionType: "agent_to_agent",
    dailyLimit: parseEther("50"), // 50 cUSD/day
    perActionLimit: parseEther("5"), // 5 cUSD per tip
    requiresApproval: false,
  },
};

// ============================================
// Default Autonomy Threshold
// ============================================

/** Actions below this amount auto-approve without user interaction */
const DEFAULT_AUTONOMY_THRESHOLD = parseEther("5"); // 5 cUSD

// ============================================
// In-Memory Store (backed by Redis in production)
// ============================================

// Spending limits per agent
const spendingLimits: Map<string, SpendingLimit[]> = new Map();

// Autonomy thresholds per agent
const autonomyThresholds: Map<string, bigint> = new Map();

// Pending suggestions for quick-accept
const pendingSuggestions: Map<string, AgentSuggestion> = new Map();

// Style preferences per user
const stylePreferences: Map<string, StylePreference> = new Map();

// Pending approvals
const pendingApprovals: Map<string, ApprovalRequest> = new Map();

// Track which agents have been hydrated from Redis
const hydratedAgents: Set<string> = new Set();

/**
 * Initialize the store by loading persisted state from Redis.
 * Call once at the start of each API request.
 * Safe to call multiple times — only hydrates once per agent per process.
 */
export async function initStore(agentId: string): Promise<void> {
  if (hydratedAgents.has(agentId)) return;
  hydratedAgents.add(agentId);

  if (!isRedisConfigured()) return;

  try {
    // Load spending limits
    const limits = await loadSpendingLimits(agentId);
    if (limits) {
      spendingLimits.set(agentId, limits);
    }

    // Load autonomy threshold
    const threshold = await loadAutonomyThreshold(agentId);
    if (threshold !== null) {
      autonomyThresholds.set(agentId, threshold);
    }

    // Hydrate suggestions and approvals
    await Promise.all([
      hydrateSuggestions(agentId, pendingSuggestions),
      hydrateApprovals(agentId, pendingApprovals),
    ]);
  } catch (err) {
    console.error(`Redis hydration failed for ${agentId}:`, err);
    // Continue with in-memory state
  }
}

// ============================================
// Core Functions
// ============================================

/**
 * Initialize spending limits for an agent
 */
export function initializeAgentLimits(
  agentId: string,
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

  // Apply custom limits from config
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

  spendingLimits.set(agentId, limits);
  persistSpendingLimits(agentId, limits).catch(() => {});
  return limits;
}

/**
 * Get spending limits for an agent
 */
export function getAgentLimits(agentId: string): SpendingLimit[] {
  return spendingLimits.get(agentId) || initializeAgentLimits(agentId);
}

/**
 * Check if an action is allowed based on spending limits
 */
export function checkSpendingLimit(
  agentId: string,
  actionType: ActionType,
  amount: bigint,
): { allowed: boolean; reason?: string; limit?: SpendingLimit } {
  const limits = getAgentLimits(agentId);
  const limit = limits.find((l) => l.actionType === actionType);

  if (!limit) {
    return { allowed: false, reason: `Unknown action type: ${actionType}` };
  }

  // Reset daily spending if needed (24-hour window)
  const now = Date.now();
  const dayInMs = 24 * 60 * 60 * 1000;
  if (now - limit.lastResetTimestamp > dayInMs) {
    limit.spentToday = 0n;
    limit.lastResetTimestamp = now;
  }

  // Check per-action limit
  if (amount > limit.perActionLimit) {
    return {
      allowed: false,
      reason: `Amount ${formatEther(amount)} exceeds per-action limit of ${formatEther(limit.perActionLimit)}`,
      limit,
    };
  }

  // Check daily limit
  if (limit.spentToday + amount > limit.dailyLimit) {
    return {
      allowed: false,
      reason: `Daily limit exceeded. Spent: ${formatEther(limit.spentToday)}, Limit: ${formatEther(limit.dailyLimit)}`,
      limit,
    };
  }

  return { allowed: true, limit };
}

/**
 * Record that spending occurred
 */
export function recordSpending(
  agentId: string,
  actionType: ActionType,
  amount: bigint,
): void {
  const limits = getAgentLimits(agentId);
  const limit = limits.find((l) => l.actionType === actionType);

  if (limit) {
    limit.spentToday += amount;
    persistSpendingLimits(agentId, limits).catch(() => {});
  }
}

/**
 * Get remaining daily limit for an action
 */
export function getRemainingLimit(
  agentId: string,
  actionType: ActionType,
): { daily: bigint; remaining: bigint; perAction: bigint } {
  const limits = getAgentLimits(agentId);
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
// Autonomy Threshold Management
// ============================================

/**
 * Set autonomy threshold for an agent
 * Actions below this amount auto-approve without user interaction
 */
export function setAutonomyThreshold(agentId: string, threshold: bigint): void {
  autonomyThresholds.set(agentId, threshold);
  persistAutonomyThreshold(agentId, threshold).catch(() => {});
}

/**
 * Get autonomy threshold for an agent
 */
export function getAutonomyThreshold(agentId: string): bigint {
  return autonomyThresholds.get(agentId) || DEFAULT_AUTONOMY_THRESHOLD;
}

/**
 * Check if an amount is below autonomy threshold (auto-approve)
 */
export function isBelowAutonomyThreshold(
  agentId: string,
  amount: bigint,
): boolean {
  const threshold = getAutonomyThreshold(agentId);
  return amount <= threshold;
}

// ============================================
// Suggestion System (Quick Accept)
// ============================================

/**
 * Create a suggestion for an action (can be quick-accepted if below threshold)
 */
export function createSuggestion(params: {
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  expiresInMinutes?: number;
}): AgentSuggestion {
  const id = `suggestion_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresIn = params.expiresInMinutes || 10; // 10 minutes

  // Parse the amount to check if it's auto-approvable
  const amountWei = parseAmount(params.amount);
  const autoApprovable = isBelowAutonomyThreshold(params.agentId, amountWei);

  const suggestion: AgentSuggestion = {
    id,
    agentId: params.agentId,
    actionType: params.actionType,
    amount: params.amount,
    description: params.description,
    recipient: params.recipient,
    metadata: params.metadata,
    status: autoApprovable ? "accepted" : "pending", // Auto-accept if below threshold
    createdAt: Date.now(),
    expiresAt: Date.now() + expiresIn * 60 * 1000,
    autoApprovable,
  };

  pendingSuggestions.set(id, suggestion);
  persistSuggestion(suggestion).catch(() => {});
  return suggestion;
}

/**
 * Get a suggestion by ID
 */
export function getSuggestion(id: string): AgentSuggestion | null {
  const suggestion = pendingSuggestions.get(id);

  if (!suggestion) return null;

  // Check if expired
  if (Date.now() > suggestion.expiresAt && suggestion.status === "pending") {
    suggestion.status = "expired";
  }

  return suggestion;
}

/**
 * Accept a suggestion (user quick-accept)
 */
export function acceptSuggestion(id: string): boolean {
  const suggestion = pendingSuggestions.get(id);

  if (!suggestion || suggestion.status !== "pending") {
    return false;
  }

  if (Date.now() > suggestion.expiresAt) {
    suggestion.status = "expired";
    return false;
  }

  suggestion.status = "accepted";
  persistSuggestion(suggestion).catch(() => {});
  return true;
}

/**
 * Reject a suggestion
 */
export function rejectSuggestion(id: string): boolean {
  const suggestion = pendingSuggestions.get(id);

  if (!suggestion || suggestion.status !== "pending") {
    return false;
  }

  suggestion.status = "rejected";
  persistSuggestion(suggestion).catch(() => {});
  return true;
}

/**
 * Mark suggestion as executed
 */
export function markSuggestionExecuted(id: string): boolean {
  const suggestion = pendingSuggestions.get(id);

  if (!suggestion || suggestion.status !== "accepted") {
    return false;
  }

  suggestion.status = "executed";
  persistSuggestion(suggestion).catch(() => {});
  return true;
}

/**
 * Get pending suggestions for an agent
 */
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
// Style Memory (for recommendations)
// ============================================

/**
 * Get or create style preferences for a user
 */
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

/**
 * Update style preferences
 */
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
  persistStylePreferences(prefs).catch(() => {});
  return prefs;
}

/**
 * Track a try-on and update preferences
 */
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
// Approval Workflow
// ============================================

/**
 * Create an approval request for an action
 */
export function createApprovalRequest(params: {
  agentId: string;
  actionType: ActionType;
  amount: string;
  description: string;
  recipient?: string;
  metadata?: Record<string, unknown>;
  expiresInMinutes?: number;
}): ApprovalRequest {
  const id = `approval_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const expiresIn = params.expiresInMinutes || 5; // Default 5 minutes

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
  persistApproval(request).catch(() => {});
  return request;
}

/**
 * Get a pending approval request
 */
export function getApprovalRequest(id: string): ApprovalRequest | null {
  const request = pendingApprovals.get(id);

  if (!request) return null;

  // Check if expired
  if (Date.now() > request.expiresAt && request.status === "pending") {
    request.status = "expired";
  }

  return request;
}

/**
 * Approve a pending request
 */
export function approveRequest(id: string, userSignature?: string): boolean {
  const request = pendingApprovals.get(id);

  if (!request || request.status !== "pending") {
    return false;
  }

  if (Date.now() > request.expiresAt) {
    request.status = "expired";
    return false;
  }

  request.status = "approved";
  request.userSignature = userSignature;
  persistApproval(request).catch(() => {});
  return true;
}

/**
 * Reject a pending request
 */
export function rejectRequest(id: string): boolean {
  const request = pendingApprovals.get(id);

  if (!request || request.status !== "pending") {
    return false;
  }

  request.status = "rejected";
  persistApproval(request).catch(() => {});
  return true;
}

/**
 * Get all pending approvals for an agent
 */
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

/**
 * Validate if an action can proceed
 * Returns the result including whether approval is needed
 * Now supports autonomy threshold - small amounts auto-approve
 */
export function validateAction(params: {
  agentId: string;
  actionType: ActionType;
  amount: bigint;
  amountFormatted: string;
  description: string;
  recipient?: string;
}): {
  allowed: boolean;
  requiresApproval: boolean;
  autoApproved: boolean; // True if auto-approved via autonomy threshold
  approvalRequest?: ApprovalRequest;
  reason?: string;
  limit?: SpendingLimit;
} {
  const {
    agentId,
    actionType,
    amount,
    amountFormatted,
    description,
    recipient,
  } = params;

  // Check spending limit
  const limitCheck = checkSpendingLimit(agentId, actionType, amount);

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

  // If action doesn't require approval, it's allowed
  if (!limit.requiresApproval) {
    return {
      allowed: true,
      requiresApproval: false,
      autoApproved: false,
      limit,
    };
  }

  // Action requires approval - check autonomy threshold
  if (isBelowAutonomyThreshold(agentId, amount)) {
    // Auto-approve via autonomy threshold
    return {
      allowed: true,
      requiresApproval: false,
      autoApproved: true, // Indicate this was auto-approved
      limit,
    };
  }

  // Above threshold - create approval request
  const approvalRequest = createApprovalRequest({
    agentId,
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

/**
 * Suggest an action to the user (can be quick-accepted)
 * Returns a suggestion that may be auto-accepted if below threshold
 */
export function suggestAction(params: {
  agentId: string;
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

  // If auto-approved (below threshold), mark for immediate execution
  if (suggestion.autoApprovable) {
    return {
      suggestion,
      autoExecuted: true,
    };
  }

  return {
    suggestion,
    autoExecuted: false,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse amount string (e.g., "5 cUSD") to wei
 */
function parseAmount(amount: string): bigint {
  // Handle common formats: "5 cUSD", "5.00 cUSD", "5"
  const cleaned = amount.replace(/[^0-9.]/g, "");
  return parseEther(cleaned || "0");
}

// ============================================
// Exports
// ============================================

export const AgentControls = {
  // Store initialization
  initStore,

  // Limits
  initializeAgentLimits,
  getAgentLimits,
  checkSpendingLimit,
  recordSpending,
  getRemainingLimit,

  // Autonomy
  setAutonomyThreshold,
  getAutonomyThreshold,
  isBelowAutonomyThreshold,

  // Suggestions (Quick Accept)
  createSuggestion,
  getSuggestion,
  acceptSuggestion,
  rejectSuggestion,
  markSuggestionExecuted,
  getPendingSuggestions,

  // Style Memory
  getStylePreferences,
  updateStylePreferences,
  trackStyleInteraction,

  // Validation
  validateAction,
  suggestAction,

  // Approvals
  createApprovalRequest,
  getApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,

  // Validation (already exported above)
  // validateAction,
};
