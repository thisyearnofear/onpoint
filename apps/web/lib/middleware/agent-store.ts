/**
 * Agent State Store - Redis persistence for agent-controls
 *
 * Uses Upstash Redis REST API (same pattern as rate-limit.ts).
 * Falls back gracefully to in-memory-only when Redis is not configured.
 *
 * Environment variables:
 * - UPSTASH_REDIS_REST_URL
 * - UPSTASH_REDIS_REST_TOKEN
 */

import type {
  SpendingLimit,
  AgentSuggestion,
  StylePreference,
  ApprovalRequest,
} from "./agent-controls";

import type { CommissionRecord } from "../utils/commissions";
import type { UserMissionState } from "../services/mission-service";

// ============================================
// Redis Key Schema
// ============================================

const KEYS = {
  spendingLimits: (agentId: string) => `agent:limits:${agentId}`,
  autonomyThreshold: (agentId: string) => `agent:autonomy:${agentId}`,
  suggestion: (id: string) => `agent:suggestion:${id}`,
  suggestionIndex: (agentId: string) => `agent:suggestions:${agentId}`,
  approval: (id: string) => `agent:approval:${id}`,
  approvalIndex: (agentId: string) => `agent:approvals:${agentId}`,
  stylePrefs: (userId: string) => `agent:style:${userId}`,
  commission: (id: string) => `agent:commission:${id}`,
  commissionIndex: () => `agent:commissions`,
  missionState: (userId: string) => `agent:missions:${userId}`,
};

// ============================================
// Upstash REST Helpers
// ============================================

interface UpstashResult<T = unknown> {
  result: T;
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

async function redisGet<T>(key: string): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/get/${key}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return null;
    const data: UpstashResult<string | null> = await res.json();
    if (data.result === null) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

async function redisSet(key: string, value: unknown): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: JSON.stringify(value) }),
    });
  } catch (err) {
    console.error(`Redis SET ${key} failed:`, err);
  }
}

async function redisSetEx(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
    });
  } catch (err) {
    console.error(`Redis SET ${key} failed:`, err);
  }
}

async function redisDel(key: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/del/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch (err) {
    console.error(`Redis DEL ${key} failed:`, err);
  }
}

async function redisSadd(key: string, member: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/sadd/${key}/${member}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    // Best effort
  }
}

async function redisSmembers(key: string): Promise<string[]> {
  const config = getRedisConfig();
  if (!config) return [];

  try {
    const res = await fetch(`${config.url}/smembers/${key}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return [];
    const data: UpstashResult<string[]> = await res.json();
    return data.result || [];
  } catch {
    return [];
  }
}

async function redisSrem(key: string, member: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/srem/${key}/${member}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    // Best effort
  }
}

// ============================================
// Serialization helpers (bigint → string)
// ============================================

function serializeSpendingLimit(limit: SpendingLimit) {
  return {
    ...limit,
    dailyLimit: limit.dailyLimit.toString(),
    perActionLimit: limit.perActionLimit.toString(),
    spentToday: limit.spentToday.toString(),
  };
}

function deserializeSpendingLimit(
  data: Record<string, unknown>,
): SpendingLimit {
  return {
    agentId: data.agentId as string,
    actionType: data.actionType as SpendingLimit["actionType"],
    dailyLimit: BigInt(data.dailyLimit as string),
    perActionLimit: BigInt(data.perActionLimit as string),
    spentToday: BigInt(data.spentToday as string),
    lastResetTimestamp: data.lastResetTimestamp as number,
    requiresApproval: data.requiresApproval as boolean,
  };
}

// ============================================
// Spending Limits Persistence
// ============================================

export async function loadSpendingLimits(
  agentId: string,
): Promise<SpendingLimit[] | null> {
  const data = await redisGet<Record<string, unknown>[]>(
    KEYS.spendingLimits(agentId),
  );
  if (!data) return null;
  return data.map(deserializeSpendingLimit);
}

export async function persistSpendingLimits(
  agentId: string,
  limits: SpendingLimit[],
): Promise<void> {
  const serialized = limits.map(serializeSpendingLimit);
  await redisSet(KEYS.spendingLimits(agentId), serialized);
}

// ============================================
// Autonomy Threshold Persistence
// ============================================

export async function loadAutonomyThreshold(
  agentId: string,
): Promise<bigint | null> {
  const data = await redisGet<string>(KEYS.autonomyThreshold(agentId));
  if (data === null) return null;
  return BigInt(data);
}

export async function persistAutonomyThreshold(
  agentId: string,
  threshold: bigint,
): Promise<void> {
  await redisSet(KEYS.autonomyThreshold(agentId), threshold.toString());
}

// ============================================
// Suggestion Persistence
// ============================================

export async function persistSuggestion(
  suggestion: AgentSuggestion,
): Promise<void> {
  const ttlSeconds = Math.ceil(
    (suggestion.expiresAt - Date.now()) / 1000 + 3600, // expire + 1h buffer
  );
  await Promise.all([
    redisSetEx(KEYS.suggestion(suggestion.id), suggestion, ttlSeconds),
    redisSadd(KEYS.suggestionIndex(suggestion.agentId), suggestion.id),
  ]);
}

export async function loadSuggestion(
  id: string,
): Promise<AgentSuggestion | null> {
  return redisGet<AgentSuggestion>(KEYS.suggestion(id));
}

export async function loadSuggestionIds(agentId: string): Promise<string[]> {
  return redisSmembers(KEYS.suggestionIndex(agentId));
}

// ============================================
// Approval Persistence
// ============================================

export async function persistApproval(
  approval: ApprovalRequest,
): Promise<void> {
  const ttlSeconds = Math.ceil((approval.expiresAt - Date.now()) / 1000 + 3600);
  await Promise.all([
    redisSetEx(KEYS.approval(approval.id), approval, ttlSeconds),
    redisSadd(KEYS.approvalIndex(approval.agentId), approval.id),
  ]);
}

export async function loadApproval(
  id: string,
): Promise<ApprovalRequest | null> {
  return redisGet<ApprovalRequest>(KEYS.approval(id));
}

export async function loadApprovalIds(agentId: string): Promise<string[]> {
  return redisSmembers(KEYS.approvalIndex(agentId));
}

// ============================================
// Style Preferences Persistence
// ============================================

export async function persistStylePreferences(
  prefs: StylePreference,
): Promise<void> {
  await redisSet(KEYS.stylePrefs(prefs.userId), prefs);
}

export async function loadStylePreferences(
  userId: string,
): Promise<StylePreference | null> {
  return redisGet<StylePreference>(KEYS.stylePrefs(userId));
}

// ============================================
// Commission Persistence
// ============================================

export async function persistCommission(
  record: CommissionRecord,
): Promise<void> {
  await Promise.all([
    redisSetEx(KEYS.commission(record.id), record, 86400 * 90), // 90 day TTL
    redisSadd(KEYS.commissionIndex(), record.id),
  ]);
}

export async function loadCommission(
  id: string,
): Promise<CommissionRecord | null> {
  return redisGet<CommissionRecord>(KEYS.commission(id));
}

export async function loadCommissionIds(): Promise<string[]> {
  return redisSmembers(KEYS.commissionIndex());
}

// ============================================
// Mission State Persistence
// ============================================

export async function persistMissionState(
  state: UserMissionState,
): Promise<void> {
  await redisSetEx(KEYS.missionState(state.userId), state, 86400 * 30); // 30 day TTL
}

export async function loadMissionState(
  userId: string,
): Promise<UserMissionState | null> {
  return redisGet<UserMissionState>(KEYS.missionState(userId));
}

// ============================================
// Bulk Hydration (for initStore)
// ============================================

export async function hydrateSuggestions(
  agentId: string,
  target: Map<string, AgentSuggestion>,
): Promise<void> {
  const ids = await loadSuggestionIds(agentId);
  const results = await Promise.all(ids.map(loadSuggestion));
  for (const suggestion of results) {
    if (suggestion) {
      // Re-check expiry on hydration
      if (
        Date.now() > suggestion.expiresAt &&
        suggestion.status === "pending"
      ) {
        suggestion.status = "expired";
      }
      target.set(suggestion.id, suggestion);
    }
  }
}

export async function hydrateApprovals(
  agentId: string,
  target: Map<string, ApprovalRequest>,
): Promise<void> {
  const ids = await loadApprovalIds(agentId);
  const results = await Promise.all(ids.map(loadApproval));
  for (const approval of results) {
    if (approval) {
      if (Date.now() > approval.expiresAt && approval.status === "pending") {
        approval.status = "expired";
      }
      target.set(approval.id, approval);
    }
  }
}

// ============================================
// Utility
// ============================================

export function isRedisConfigured(): boolean {
  return !!getRedisConfig();
}
