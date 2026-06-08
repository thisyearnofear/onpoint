/**
 * Agent Metrics Store
 *
 * Collects structured metrics about agent actions: counters by action type,
 * latency histograms, and escrow balance snapshots.
 *
 * Metrics are kept in-memory with periodic snapshot to Redis.
 * A /metrics endpoint (Prometheus format) reads from this store.
 *
 * Usage:
 *   Metrics.countAction("tip", "attempted");
 *   Metrics.recordLatency("mint", 1234); // ms
 *   Metrics.setEscrowBalance("user-1", "1000");
 *   Metrics.exportPrometheus(); // → Prometheus text format
 */

import { logger } from "./logger";
import { isRedisConfigured, redisSet, redisGet } from "./redis-helpers";

// ============================================
// Types
// ============================================

export type ActionStatus = "attempted" | "succeeded" | "failed";

export interface ActionCounter {
  type: string;
  status: ActionStatus;
  count: number;
}

export interface LatencyHistogram {
  type: string;
  p50: number;
  p90: number;
  p99: number;
  count: number;
}

export interface EscrowSnapshot {
  userId: string;
  balance: string;
  allowance: string;
  spent: string;
  timestamp: number;
}

export interface MetricsSnapshot {
  actionCounters: Record<string, Record<string, number>>;
  latencies: Record<string, number[]>;
  escrowBalances: Record<string, string>;
  collectedAt: number;
}

// ============================================
// Redis Keys
// ============================================

const METRICS_KEY = "agent:metrics:snapshot";

// ============================================
// In-Memory Store
// ============================================

const actionCounters: Record<string, Record<string, number>> = {};
const latencies: Record<string, number[]> = {};
const escrowBalances: Record<string, string> = {};
let gasBalance: number | null = null; // CELO amount, not wei
let gasWalletAddress: string = "";

// ============================================
// Public API
// ============================================

/**
 * Count an agent action by type and status.
 * Thread-safe for concurrent calls.
 */
export function countAction(type: string, status: ActionStatus): void {
  if (!actionCounters[type]) actionCounters[type] = {};
  actionCounters[type][status] = (actionCounters[type][status] || 0) + 1;
}

/**
 * Record a latency measurement for an action type.
 * Keeps up to the last 1000 samples per type.
 */
export function recordLatency(type: string, latencyMs: number): void {
  if (!latencies[type]) latencies[type] = [];
  latencies[type].push(latencyMs);
  // Keep most recent 1000 samples
  if (latencies[type].length > 1000) {
    latencies[type] = latencies[type].slice(-1000);
  }
}

/**
 * Record an escrow balance snapshot for a user.
 */
export function setEscrowBalance(userId: string, balance: string): void {
  escrowBalances[userId] = balance;
}

/**
 * Record the agent wallet gas (CELO) balance.
 * Called by the heartbeat after checkWalletGas().
 * @param address — Agent wallet address
 * @param celoBalance — CELO balance as a string (e.g. "1.23")
 */
export function setGasBalance(address: string, celoBalance: string): void {
  gasWalletAddress = address;
  gasBalance = parseFloat(celoBalance) || 0;
}

/**
 * Get the current gas balance.
 */
export function getGasBalance(): { address: string; balance: number } | null {
  if (gasBalance === null) return null;
  return { address: gasWalletAddress, balance: gasBalance };
}

/**
 * Get all current counters.
 */
export function getActionCounters(): ActionCounter[] {
  const result: ActionCounter[] = [];
  for (const [type, statuses] of Object.entries(actionCounters)) {
    for (const [status, count] of Object.entries(statuses)) {
      result.push({ type, status: status as ActionStatus, count });
    }
  }
  return result;
}

/**
 * Calculate percentiles from a sorted array.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(index, sorted.length - 1))];
}

/**
 * Get latency histograms for all action types.
 */
export function getLatencyHistograms(): LatencyHistogram[] {
  const result: LatencyHistogram[] = [];
  for (const [type, samples] of Object.entries(latencies)) {
    if (samples.length === 0) continue;
    const sorted = [...samples].sort((a, b) => a - b);
    result.push({
      type,
      p50: percentile(sorted, 50),
      p90: percentile(sorted, 90),
      p99: percentile(sorted, 99),
      count: samples.length,
    });
  }
  return result;
}

/**
 * Get escrow balance snapshots.
 */
export function getEscrowBalances(): EscrowSnapshot[] {
  return Object.entries(escrowBalances).map(([userId, balance]) => ({
    userId,
    balance,
    allowance: "0",
    spent: "0",
    timestamp: Date.now(),
  }));
}

/**
 * Export all metrics in Prometheus exposition format.
 * Suitable for serving from a /metrics endpoint.
 */
export function exportPrometheus(): string {
  const lines: string[] = [];
  // Prometheus expects Unix timestamps in seconds, not milliseconds
  const ts = Math.floor(Date.now() / 1000);

  // Action counters
  lines.push("# HELP agent_actions_total Total agent actions by type and status");
  lines.push("# TYPE agent_actions_total counter");
  for (const [type, statuses] of Object.entries(actionCounters)) {
    for (const [status, count] of Object.entries(statuses)) {
      lines.push(
        `agent_actions_total{type="${escapeLabel(type)}",status="${status}"} ${count} ${ts}`,
      );
    }
  }

  // Latency histograms (summary format)
  lines.push("# HELP agent_action_latency Action latency in milliseconds");
  lines.push("# TYPE agent_action_latency summary");
  for (const [type, samples] of Object.entries(latencies)) {
    if (samples.length === 0) continue;
    const sorted = [...samples].sort((a, b) => a - b);
    const p50 = percentile(sorted, 50);
    const p90 = percentile(sorted, 90);
    const p99 = percentile(sorted, 99);
    lines.push(
      `agent_action_latency{type="${escapeLabel(type)}",quantile="0.5"} ${p50} ${ts}`,
    );
    lines.push(
      `agent_action_latency{type="${escapeLabel(type)}",quantile="0.9"} ${p90} ${ts}`,
    );
    lines.push(
      `agent_action_latency{type="${escapeLabel(type)}",quantile="0.99"} ${p99} ${ts}`,
    );
    lines.push(
      `agent_action_latency_count{type="${escapeLabel(type)}"} ${samples.length} ${ts}`,
    );
  }

  // Escrow balances
  lines.push("# HELP agent_escrow_balance Current escrow balance per user");
  lines.push("# TYPE agent_escrow_balance gauge");
  for (const [userId, balance] of Object.entries(escrowBalances)) {
    lines.push(
      `agent_escrow_balance{user_id="${escapeLabel(userId)}"} ${balance} ${ts}`,
    );
  }

  // Gas balance (CELO)
  if (gasBalance !== null) {
    lines.push("# HELP agent_gas_balance Current agent wallet CELO balance");
    lines.push("# TYPE agent_gas_balance gauge");
    lines.push(
      `agent_gas_balance{address="${escapeLabel(gasWalletAddress)}"} ${gasBalance} ${ts}`,
    );
  }

  // Health metric
  lines.push("# HELP agent_up Whether the agent metrics collection is active");
  lines.push("# TYPE agent_up gauge");
  lines.push(`agent_up 1 ${ts}`);

  return lines.join("\n") + "\n";
}

/**
 * Persist current metrics snapshot to Redis.
 * Called periodically (e.g., from heartbeat).
 */
export async function persistMetrics(): Promise<void> {
  if (!isRedisConfigured()) return;

  const snapshot: MetricsSnapshot = {
    actionCounters,
    latencies: Object.fromEntries(
      Object.entries(latencies).map(([k, v]) => [k, v]),
    ),
    escrowBalances,
    collectedAt: Date.now(),
  };

  try {
    await redisSet(METRICS_KEY, snapshot);
  } catch (err) {
    logger.warn("Failed to persist metrics", { component: "metrics" }, err);
  }
}

/**
 * Reset all in-memory metrics (for testing or between deployment restarts).
 */
export function resetMetrics(): void {
  for (const key of Object.keys(actionCounters)) delete actionCounters[key];
  for (const key of Object.keys(latencies)) delete latencies[key];
  for (const key of Object.keys(escrowBalances)) delete escrowBalances[key];
}

// ============================================
// Helpers
// ============================================

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

// ============================================
// Exports
// ============================================

export const Metrics = {
  countAction,
  recordLatency,
  setEscrowBalance,
  setGasBalance,
  getGasBalance,
  getActionCounters,
  getLatencyHistograms,
  getEscrowBalances,
  exportPrometheus,
  persistMetrics,
  resetMetrics,
};
