/**
 * Fraud Detection Service - Phase 6.4
 * 
 * Monitors agent behavior for anomalies and implements Dead Man's Switch.
 * Automatically freezes suspicious agents and requires multi-sig for high-value transactions.
 */

import { redisGet, redisSetEx, redisSet, redisDel } from "../utils/redis-helpers";
import { logger } from "../utils/logger";

// ============================================
// Types
// ============================================

export interface AgentHealthCheck {
  agentId: string;
  userId: string;
  lastHeartbeat: number;
  status: "healthy" | "warning" | "frozen";
  consecutiveFailures: number;
  anomalyScore: number; // 0-100, higher = more suspicious
}

export interface TransactionPattern {
  userId: string;
  agentId: string;
  windowStart: number;
  windowEnd: number;
  transactionCount: number;
  totalAmount: string; // in wei
  averageAmount: string;
  uniqueRecipients: number;
  flaggedCount: number;
}

export interface FraudAlert {
  id: string;
  userId: string;
  agentId: string;
  type: "velocity" | "amount" | "pattern" | "heartbeat" | "multisig_required";
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  timestamp: number;
  resolved: boolean;
  metadata?: Record<string, unknown>;
}

export interface MultiSigRequirement {
  transactionId: string;
  userId: string;
  agentId: string;
  amount: bigint;
  recipient: string;
  description: string;
  requiredSignatures: number;
  signatures: Array<{ signer: string; signature: string; timestamp: number }>;
  status: "pending" | "approved" | "rejected" | "expired";
  createdAt: number;
  expiresAt: number;
}

// ============================================
// Configuration
// ============================================

const HEARTBEAT_INTERVAL = 5 * 60 * 1000; // 5 minutes
const HEARTBEAT_TIMEOUT = 15 * 60 * 1000; // 15 minutes (3x interval)
const VELOCITY_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_TRANSACTIONS_PER_HOUR = 20;
const MULTISIG_THRESHOLD = BigInt(500e18); // $500 requires multi-sig
const ANOMALY_FREEZE_THRESHOLD = 75; // Freeze if anomaly score > 75

// ============================================
// Redis Keys
// ============================================

const HEALTH_KEY = (agentId: string, userId: string) => `fraud:health:${agentId}:${userId}`;
const PATTERN_KEY = (userId: string, window: string) => `fraud:pattern:${userId}:${window}`;
const ALERT_KEY = (id: string) => `fraud:alert:${id}`;
const ALERT_INDEX_KEY = (userId: string) => `fraud:alerts:${userId}`;
const MULTISIG_KEY = (txId: string) => `fraud:multisig:${txId}`;
const FROZEN_KEY = (agentId: string, userId: string) => `fraud:frozen:${agentId}:${userId}`;

// ============================================
// Dead Man's Switch (Heartbeat Monitoring)
// ============================================

/**
 * Record agent heartbeat
 */
export async function recordHeartbeat(
  agentId: string,
  userId: string,
): Promise<AgentHealthCheck> {
  let health = await redisGet<AgentHealthCheck>(HEALTH_KEY(agentId, userId));

  if (!health) {
    health = {
      agentId,
      userId,
      lastHeartbeat: Date.now(),
      status: "healthy",
      consecutiveFailures: 0,
      anomalyScore: 0,
    };
  } else {
    health.lastHeartbeat = Date.now();
    health.consecutiveFailures = 0;
    if (health.status === "warning") {
      health.status = "healthy";
    }
  }

  await redisSetEx(HEALTH_KEY(agentId, userId), health, 86400); // 24h retention
  return health;
}

/**
 * Check agent health status
 */
export async function checkAgentHealth(
  agentId: string,
  userId: string,
): Promise<AgentHealthCheck> {
  let health = await redisGet<AgentHealthCheck>(HEALTH_KEY(agentId, userId));

  if (!health) {
    // No heartbeat recorded yet
    health = {
      agentId,
      userId,
      lastHeartbeat: Date.now(),
      status: "healthy",
      consecutiveFailures: 0,
      anomalyScore: 0,
    };
    await redisSetEx(HEALTH_KEY(agentId, userId), health, 86400);
    return health;
  }

  const timeSinceHeartbeat = Date.now() - health.lastHeartbeat;

  // Check if heartbeat is stale
  if (timeSinceHeartbeat > HEARTBEAT_TIMEOUT) {
    health.consecutiveFailures += 1;
    health.status = health.consecutiveFailures >= 3 ? "frozen" : "warning";

    if (health.status === "frozen") {
      await freezeAgent(agentId, userId, "Dead Man's Switch triggered - no heartbeat");
      await createAlert({
        userId,
        agentId,
        type: "heartbeat",
        severity: "critical",
        description: `Agent frozen due to missing heartbeat (${Math.floor(timeSinceHeartbeat / 60000)} minutes)`,
      });
    }

    await redisSetEx(HEALTH_KEY(agentId, userId), health, 86400);
  }

  return health;
}

// ============================================
// Anomaly Detection
// ============================================

/**
 * Analyze transaction patterns for anomalies
 */
export async function analyzeTransactionPattern(
  userId: string,
  agentId: string,
  amount: bigint,
  recipient: string,
): Promise<{ anomalyScore: number; flags: string[] }> {
  const now = Date.now();
  const windowKey = Math.floor(now / VELOCITY_WINDOW).toString();
  const patternKey = PATTERN_KEY(userId, windowKey);

  let pattern = await redisGet<TransactionPattern>(patternKey);

  if (!pattern) {
    pattern = {
      userId,
      agentId,
      windowStart: now,
      windowEnd: now + VELOCITY_WINDOW,
      transactionCount: 0,
      totalAmount: "0",
      averageAmount: "0",
      uniqueRecipients: 0,
      flaggedCount: 0,
    };
  }

  const flags: string[] = [];
  let anomalyScore = 0;

  // Check velocity (transactions per hour)
  if (pattern.transactionCount >= MAX_TRANSACTIONS_PER_HOUR) {
    flags.push("high_velocity");
    anomalyScore += 30;
  }

  // Check amount deviation
  const avgAmount = BigInt(pattern.averageAmount || "0");
  if (avgAmount > 0n) {
    const deviation = amount > avgAmount ? amount - avgAmount : avgAmount - amount;
    const deviationPercent = Number((deviation * 100n) / avgAmount);

    if (deviationPercent > 200) {
      flags.push("unusual_amount");
      anomalyScore += 25;
    }
  }

  // Check for rapid large transactions
  if (amount > BigInt(100e18) && pattern.transactionCount > 5) {
    flags.push("rapid_large_transactions");
    anomalyScore += 20;
  }

  // Update pattern
  pattern.transactionCount += 1;
  pattern.totalAmount = (BigInt(pattern.totalAmount) + amount).toString();
  pattern.averageAmount = (
    BigInt(pattern.totalAmount) / BigInt(pattern.transactionCount)
  ).toString();

  if (flags.length > 0) {
    pattern.flaggedCount += 1;
  }

  await redisSetEx(patternKey, pattern, Math.ceil(VELOCITY_WINDOW / 1000));

  return { anomalyScore, flags };
}

/**
 * Update agent anomaly score
 */
export async function updateAnomalyScore(
  agentId: string,
  userId: string,
  scoreChange: number,
): Promise<AgentHealthCheck> {
  const health = await checkAgentHealth(agentId, userId);
  health.anomalyScore = Math.max(0, Math.min(100, health.anomalyScore + scoreChange));

  // Auto-freeze if score too high
  if (health.anomalyScore >= ANOMALY_FREEZE_THRESHOLD && health.status !== "frozen") {
    health.status = "frozen";
    await freezeAgent(agentId, userId, `High anomaly score: ${health.anomalyScore}`);
    await createAlert({
      userId,
      agentId,
      type: "pattern",
      severity: "critical",
      description: `Agent frozen due to high anomaly score (${health.anomalyScore}/100)`,
    });
  }

  await redisSetEx(HEALTH_KEY(agentId, userId), health, 86400);
  return health;
}

// ============================================
// Agent Freezing
// ============================================

/**
 * Freeze agent (prevent all actions)
 */
export async function freezeAgent(
  agentId: string,
  userId: string,
  reason: string,
): Promise<void> {
  await redisSetEx(
    FROZEN_KEY(agentId, userId),
    { reason, frozenAt: Date.now() },
    86400 * 7, // 7 days
  );

  logger.warn("Agent frozen", {
    component: "fraud-detection",
    agentId,
    userId,
    reason,
  });
}

/**
 * Unfreeze agent
 */
export async function unfreezeAgent(
  agentId: string,
  userId: string,
): Promise<void> {
  await redisDel(FROZEN_KEY(agentId, userId));

  const health = await checkAgentHealth(agentId, userId);
  health.status = "healthy";
  health.anomalyScore = 0;
  health.consecutiveFailures = 0;
  await redisSetEx(HEALTH_KEY(agentId, userId), health, 86400);

  logger.info("Agent unfrozen", {
    component: "fraud-detection",
    agentId,
    userId,
  });
}

/**
 * Check if agent is frozen
 */
export async function isAgentFrozen(
  agentId: string,
  userId: string,
): Promise<{ frozen: boolean; reason?: string }> {
  const frozenData = await redisGet<{ reason: string; frozenAt: number }>(
    FROZEN_KEY(agentId, userId),
  );

  if (!frozenData) {
    return { frozen: false };
  }

  return { frozen: true, reason: frozenData.reason };
}

// ============================================
// Multi-Signature Requirements
// ============================================

/**
 * Check if transaction requires multi-sig
 */
export function requiresMultiSig(amount: bigint): boolean {
  return amount >= MULTISIG_THRESHOLD;
}

/**
 * Create multi-sig requirement
 */
export async function createMultiSigRequirement(
  userId: string,
  agentId: string,
  amount: bigint,
  recipient: string,
  description: string,
): Promise<MultiSigRequirement> {
  const txId = `multisig_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const now = Date.now();

  const requirement: MultiSigRequirement = {
    transactionId: txId,
    userId,
    agentId,
    amount,
    recipient,
    description,
    requiredSignatures: 2, // Agent + User
    signatures: [],
    status: "pending",
    createdAt: now,
    expiresAt: now + 60 * 60 * 1000, // 1 hour expiry
  };

  await redisSetEx(MULTISIG_KEY(txId), requirement, 3600);

  await createAlert({
    userId,
    agentId,
    type: "multisig_required",
    severity: "high",
    description: `Multi-sig required for ${amount.toString()} wei transaction`,
    metadata: { transactionId: txId },
  });

  return requirement;
}

/**
 * Add signature to multi-sig requirement
 */
export async function addMultiSigSignature(
  txId: string,
  signer: string,
  signature: string,
): Promise<MultiSigRequirement | null> {
  const requirement = await redisGet<MultiSigRequirement>(MULTISIG_KEY(txId));
  if (!requirement) return null;

  if (requirement.status !== "pending") {
    return requirement;
  }

  // Check if already signed by this signer
  if (requirement.signatures.some((s) => s.signer === signer)) {
    return requirement;
  }

  requirement.signatures.push({
    signer,
    signature,
    timestamp: Date.now(),
  });

  // Check if enough signatures
  if (requirement.signatures.length >= requirement.requiredSignatures) {
    requirement.status = "approved";
  }

  await redisSetEx(MULTISIG_KEY(txId), requirement, 3600);
  return requirement;
}

/**
 * Get multi-sig requirement
 */
export async function getMultiSigRequirement(
  txId: string,
): Promise<MultiSigRequirement | null> {
  return redisGet<MultiSigRequirement>(MULTISIG_KEY(txId));
}

// ============================================
// Alert Management
// ============================================

/**
 * Create fraud alert
 */
export async function createAlert(params: {
  userId: string;
  agentId: string;
  type: FraudAlert["type"];
  severity: FraudAlert["severity"];
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<FraudAlert> {
  const id = `alert_${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const alert: FraudAlert = {
    id,
    userId: params.userId,
    agentId: params.agentId,
    type: params.type,
    severity: params.severity,
    description: params.description,
    timestamp: Date.now(),
    resolved: false,
    metadata: params.metadata,
  };

  await redisSetEx(ALERT_KEY(id), alert, 86400 * 30); // 30 day retention

  logger.warn("Fraud alert created", {
    component: "fraud-detection",
    ...alert,
  });

  return alert;
}

/**
 * Get alert by ID
 */
export async function getAlert(id: string): Promise<FraudAlert | null> {
  return redisGet<FraudAlert>(ALERT_KEY(id));
}

/**
 * Resolve alert
 */
export async function resolveAlert(id: string): Promise<FraudAlert | null> {
  const alert = await getAlert(id);
  if (!alert) return null;

  alert.resolved = true;
  await redisSetEx(ALERT_KEY(id), alert, 86400 * 30);

  return alert;
}
