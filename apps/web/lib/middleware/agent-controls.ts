/**
 * Agent Controls Middleware
 *
 * Provides spending limits, approval workflows, and action controls
 * for AI agent operations. This runs at the API layer to enforce
 * business logic before any blockchain transactions.
 *
 * For the Tether Hackathon Galactica - Agent Wallets Track
 */

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
// In-Memory Store (use Redis in production)
// ============================================

// Spending limits per agent
const spendingLimits: Map<string, SpendingLimit[]> = new Map();

// Pending approvals
const pendingApprovals: Map<string, ApprovalRequest> = new Map();

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
      reason: limitCheck.reason,
      limit: limitCheck.limit,
    };
  }

  // Check if approval is required
  const limit = limitCheck.limit!;

  if (limit.requiresApproval) {
    // Create approval request
    const approvalRequest = createApprovalRequest({
      agentId,
      actionType,
      amount: amountFormatted,
      description,
      recipient,
    });

    return {
      allowed: false, // Not allowed until approved
      requiresApproval: true,
      approvalRequest,
      limit,
    };
  }

  // Action is allowed without approval
  return {
    allowed: true,
    requiresApproval: false,
    limit,
  };
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse ETH value (simplified - use viem's parseEther in production)
 */
function parseEther(value: string): bigint {
  const num = parseFloat(value);
  const wei = BigInt(Math.floor(num * 1e18));
  return wei;
}

/**
 * Format ETH value (simplified - use viem's formatEther in production)
 */
function formatEther(value: bigint): string {
  const str = value.toString();
  const len = str.length;

  if (len <= 18) {
    const padded = str.padStart(18, "0");
    const trimmed = padded.replace(/0+$/, "");
    return trimmed ? `0.${trimmed}` : "0";
  }

  const integerPart = str.slice(0, len - 18);
  const fractionalPart = str.slice(len - 18).replace(/0+$/, "");
  return fractionalPart ? `${integerPart}.${fractionalPart}` : integerPart;
}

// ============================================
// Exports
// ============================================

export const AgentControls = {
  // Limits
  initializeAgentLimits,
  getAgentLimits,
  checkSpendingLimit,
  recordSpending,
  getRemainingLimit,

  // Approvals
  createApprovalRequest,
  getApprovalRequest,
  approveRequest,
  rejectRequest,
  getPendingApprovals,

  // Validation
  validateAction,
};
