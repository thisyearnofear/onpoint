/**
 * Agent Metrics Route — /api/agent/metrics
 *
 * Exposes structured agent metrics in Prometheus text format.
 *
 * Metrics collected:
 *   agent_actions_total          — Counter, by type + status (attempted/succeeded/failed)
 *   agent_action_latency         — Summary, by type, with p50/p90/p99 quantiles
 *   agent_escrow_balance         — Gauge, by user_id
 *   agent_up                     — Gauge, always 1 if metrics are active
 *   agent_heartbeat_proactive    — Gauge, proactive task results from last heartbeat
 *
 * Auth: Public (read-only metrics)
 */

const express = require('express');
const router = express.Router();
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

// In-memory store for the latest proactive task results (set by heartbeat)
let lastProactiveMetrics = {
  retriedSuggestions: { found: 0, retryable: 0, maxedOut: 0, rejected: 0 },
  prunedExpired: { staleSuggestionsRejected: 0, prunedSuggestions: 0, prunedApprovals: 0 },
  staleApprovals: { staleCount: 0, alerted: 0, skippedDupes: 0 },
  updatedAt: null,
};

/**
 * Update proactive metrics from heartbeat response.
 * Called by the heartbeat route after running proactive tasks.
 */
function updateProactiveMetrics(data) {
  if (data) {
    lastProactiveMetrics.retriedSuggestions = data.retriedSuggestions || lastProactiveMetrics.retriedSuggestions;
    lastProactiveMetrics.prunedExpired = data.prunedExpired || lastProactiveMetrics.prunedExpired;
    lastProactiveMetrics.staleApprovals = data.staleApprovals || lastProactiveMetrics.staleApprovals;
    lastProactiveMetrics.updatedAt = new Date().toISOString();
  }
}

// GET /api/agent/metrics — Prometheus text format
router.get('/', async (req, res) => {
  try {
    // Get metrics from the agent-core Metrics store
    const promMetrics = agentCore.Metrics ? agentCore.Metrics.exportPrometheus() : '';

    // Append proactive task metrics
    const ts = Date.now();
    const proactiveLines = [
      '# HELP agent_heartbeat_proactive Proactive task results from last heartbeat cycle',
      '# TYPE agent_heartbeat_proactive gauge',
      `agent_heartbeat_proactive{task="retryable_suggestions"} ${lastProactiveMetrics.retriedSuggestions.retryable || 0} ${ts}`,
      `agent_heartbeat_proactive{task="maxed_out_suggestions"} ${lastProactiveMetrics.retriedSuggestions.maxedOut || 0} ${ts}`,
      `agent_heartbeat_proactive{task="pruned_suggestions"} ${lastProactiveMetrics.prunedExpired.prunedSuggestions || 0} ${ts}`,
      `agent_heartbeat_proactive{task="stale_approvals_alerted"} ${lastProactiveMetrics.staleApprovals.alerted || 0} ${ts}`,
    ].join('\n');

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(promMetrics + proactiveLines + '\n');
  } catch (error) {
    logger.error('Metrics error', { component: 'metrics' }, error);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.status(500).send('# ERROR Failed to collect metrics\n');
  }
});

// POST /api/agent/metrics — Record a client-side action (claim, stream_g$, etc.)
// Body: { action: string, status: "attempted" | "succeeded" | "failed" }
router.post('/', (req, res) => {
  const { action, status } = req.body;

  if (!action || !status) {
    return res.status(400).json({ error: 'Missing required fields: action, status' });
  }

  const validStatuses = ['attempted', 'succeeded', 'failed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: `status must be one of: ${validStatuses.join(', ')}` });
  }

  if (agentCore.Metrics?.countAction) {
    agentCore.Metrics.countAction(action, status);
  }

  logger.info('Recorded client-side metric', {
    component: 'metrics',
    action,
    status,
  });

  res.json({ success: true, action, status });
});

function getLastProactiveMetrics() {
  return lastProactiveMetrics;
}

module.exports = { router, updateProactiveMetrics, getLastProactiveMetrics };
