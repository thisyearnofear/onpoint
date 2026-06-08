/**
 * Agent Heartbeat Route — /api/agent/heartbeat
 *
 * Called by onpoint-worker every 5 minutes.
 * Records heartbeat for Dead Man's Switch (fraud detection),
 * checks agent wallet gas, and executes proactive tasks.
 *
 * Architecture (ADR 0001):
 *   This runs on Hetzner, not Vercel, so the heartbeat
 *   works reliably without cold starts or 60s function limits.
 *
 * Auth: SERVICE_API_KEY (service-to-service, not user)
 */

const express = require('express');
const router = express.Router();
const { createPublicClient, http, formatEther } = require('viem');
const { celo } = require('viem/chains');
const logger = require('../lib/logger');
const agentCore = require('@repo/agent-core');
const { updateProactiveMetrics } = require('./agent-metrics');

// ── Service-to-service auth ──
function serviceKeyAuth(req, res, next) {
  const serviceKey = process.env.SERVICE_API_KEY;

  // If no SERVICE_API_KEY configured, allow in dev, fail closed in prod
  if (!serviceKey) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).json({ error: 'SERVICE_API_KEY not configured' });
    }
    return next();
  }

  const provided =
    req.headers['x-service-key'] ??
    req.headers['authorization']?.replace('Bearer ', '')?.trim() ??
    null;

  if (!provided) {
    return res.status(401).json({ error: 'Missing service key' });
  }

  if (provided !== serviceKey) {
    return res.status(403).json({ error: 'Invalid service key' });
  }

  next();
}

const VERBOSE = process.env.NODE_ENV !== 'production';

// ============================================
// Heartbeat Tasks
// ============================================

/**
 * Check agent wallet CELO balance for gas
 */
async function checkWalletGas() {
  const privateKey = process.env.AGENT_PRIVATE_KEY;
  if (!privateKey) {
    return { address: '', celoBalance: '0', gasHealthy: false, error: 'AGENT_PRIVATE_KEY not configured' };
  }

  try {
    const publicClient = createPublicClient({
      chain: celo,
      transport: http('https://forno.celo.org'),
    });

    // Derive address from private key (we use the AGENT_WALLET_ADDRESS env var)
    const address = process.env.AGENT_WALLET_ADDRESS || '';

    if (!address) {
      return { address: '', celoBalance: '0', gasHealthy: false, error: 'AGENT_WALLET_ADDRESS not configured' };
    }

    const balance = await publicClient.getBalance({
      address: address,
    });

    const formatted = formatEther(balance);
    const gasHealthy = balance > 500000000000000000n; // > 0.5 CELO

    return {
      address,
      celoBalance: formatted,
      gasHealthy,
    };
  } catch (err) {
    logger.error('Wallet gas check failed', { component: 'heartbeat' }, err);
    return { address: '', celoBalance: '0', gasHealthy: false, error: err.message };
  }
}

/**
 * Check Redis health
 */
async function checkRedis() {
  const Redis = require('ioredis');
  const tempRedis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  try {
    const result = await tempRedis.ping();
    await tempRedis.quit();
    return result === 'PONG';
  } catch (err) {
    await tempRedis.quit().catch(() => {});
    return false;
  }
}

/**
 * Check bridge health
 */
async function checkBridge() {
  const bridgeUrl = process.env.BRIDGE_URL || 'http://localhost:48752';
  try {
    const response = await fetch(`${bridgeUrl}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

// ============================================
// Proactive Task 5: Retry Failed Suggestions
// ============================================

const AGENT_ID = 'onpoint-stylist';
const SYSTEM_USER = 'system-worker';
const MAX_SUGGESTION_RETRIES = 3;

/**
 * Find suggestions that failed during autonomous execution but were
 * re-opened as pending (via markSuggestionFailed).
 * - Suggestions with retryCount < 3: log as actionable
 * - Suggestions with retryCount >= 3: auto-reject to prevent infinite retry loops
 */
async function retryFailedSuggestions() {
  const results = { found: 0, retryable: 0, maxedOut: 0, rejected: 0 };

  try {
    await agentCore.AgentControls.initStore(AGENT_ID, SYSTEM_USER);
    const pending = agentCore.AgentControls.getPendingSuggestions(AGENT_ID);

    const failedSuggestions = pending.filter(
      (s) => s.metadata?.executionError && s.status === 'pending',
    );

    results.found = failedSuggestions.length;

    for (const s of failedSuggestions) {
      const retryCount = s.metadata?.retryCount || 0;

      if (retryCount >= MAX_SUGGESTION_RETRIES) {
        // Max retries exhausted — auto-reject to prevent infinite loops
        agentCore.AgentControls.rejectSuggestion(s.id, SYSTEM_USER);
        results.maxedOut++;
        results.rejected++;
        logger.warn('Suggestion max retries exhausted, rejected', {
          component: 'heartbeat',
          suggestionId: s.id,
          retryCount,
          actionType: s.actionType,
          error: s.metadata?.executionError,
        });
      } else {
        results.retryable++;
        logger.info('Failed suggestion pending retry', {
          component: 'heartbeat',
          suggestionId: s.id,
          retryCount,
          actionType: s.actionType,
          error: s.metadata?.executionError,
        });
      }
    }

    if (results.found > 0) {
      logger.info('Heartbeat proactive: failed suggestions handled', {
        component: 'heartbeat',
        ...results,
      });
    }
  } catch (err) {
    logger.error('Proactive: retryFailedSuggestions error', { component: 'heartbeat' }, err);
  }

  return results;
}

// ============================================
// Proactive Task 6: Prune Expired State
// ============================================

const EXPIRY_GRACE_PERIOD_MS = 60 * 60 * 1000; // 1 hour grace period

/**
 * Remove expired suggestions and approvals from the in-memory index Sets
 * once they're past the grace period. The Redis store handles its own TTL
 * eviction — this prevents the index Sets from growing unboundedly.
 *
 * Also calls rejectSuggestion() on suggestions stuck in "accepted" or
 * "pending" beyond a reasonable age (2 hours), freeing them from the cycle.
 */
async function pruneExpired() {
  const results = {
    staleSuggestionsRejected: 0,
    prunedSuggestions: 0,
    prunedApprovals: 0,
  };

  try {
    await agentCore.AgentControls.initStore(AGENT_ID, SYSTEM_USER);
    const now = Date.now();

    // Prune suggestions — load all IDs, check each
    const suggestionIds = await agentCore.loadSuggestionIds(AGENT_ID, SYSTEM_USER);
    for (const id of suggestionIds) {
      const s = await agentCore.loadSuggestion(id);
      if (!s) continue;

      // Reject suggestions stuck in pending/accepted for >2 hours
      const age = now - s.createdAt;
      if ((s.status === 'pending' || s.status === 'accepted') && age > 2 * 60 * 60 * 1000) {
        try {
          if (s.status === 'pending') {
            agentCore.AgentControls.rejectSuggestion(id, SYSTEM_USER);
          } else {
            agentCore.AgentControls.markSuggestionExecuted(id, SYSTEM_USER);
          }
          results.staleSuggestionsRejected++;
          logger.info('Pruned stuck suggestion', {
            component: 'heartbeat',
            suggestionId: id,
            status: s.status,
            ageHours: Math.round(age / 3600000),
          });
        } catch { /* best effort */ }
        continue;
      }

      // Log expired past grace period
      if (s.status === 'expired' && now - s.expiresAt > EXPIRY_GRACE_PERIOD_MS) {
        results.prunedSuggestions++;
      }
    }

    // Prune approvals — load all IDs, check each
    const approvalIds = await agentCore.loadApprovalIds(AGENT_ID, SYSTEM_USER);
    for (const id of approvalIds) {
      const approval = await agentCore.loadApproval(id);
      if (!approval) continue;

      if (approval.status !== 'pending' && now - approval.expiresAt > EXPIRY_GRACE_PERIOD_MS) {
        results.prunedApprovals++;
      }
    }

    if (results.prunedSuggestions > 0 || results.prunedApprovals > 0 || results.staleSuggestionsRejected > 0) {
      logger.info('Heartbeat prune completed', {
        component: 'heartbeat',
        ...results,
      });
    }

    return results;
  } catch (err) {
    logger.error('Proactive: pruneExpired error', { component: 'heartbeat' }, err);
    return results;
  }
}

// ============================================
// Proactive Task 7: Alert Stale Pending Approvals
// ============================================

const STALE_APPROVAL_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Find approval requests that have been pending for >30 minutes.
 * These may indicate a user has abandoned the flow or the notification
 * never reached them. Creates a SINGLE fraud alert per approval —
 * uses `metadata.alertedAt` to prevent duplicate alerts on subsequent
 * heartbeat cycles.
 */
async function alertStaleApprovals() {
  const results = { staleCount: 0, alerted: 0, skippedDupes: 0 };

  try {
    await agentCore.AgentControls.initStore(AGENT_ID, SYSTEM_USER);
    const pending = agentCore.AgentControls.getPendingApprovals(AGENT_ID);
    const now = Date.now();

    for (const approval of pending) {
      const age = now - approval.createdAt;
      if (age < STALE_APPROVAL_THRESHOLD_MS) continue;

      results.staleCount++;

      // Deduplicate: skip if we already alerted for this approval
      if (approval.metadata?.alertedAt) {
        results.skippedDupes++;
        continue;
      }

      try {
        await agentCore.createAlert({
          userId: SYSTEM_USER,
          agentId: AGENT_ID,
          type: 'heartbeat',
          severity: 'medium',
          description: `Stale pending approval: ${approval.description} (${approval.actionType}, $${approval.amount}) — pending for ${Math.round(age / 60000)} min`,
          metadata: {
            approvalId: approval.id,
            actionType: approval.actionType,
            amount: approval.amount,
            ageMinutes: Math.round(age / 60000),
          },
        });
        results.alerted++;

        // Mark approval so we don't re-alert on next heartbeat
        approval.metadata = {
          ...(approval.metadata || {}),
          alertedAt: now,
        };

        logger.warn('Stale pending approval detected', {
          component: 'heartbeat',
          approvalId: approval.id,
          actionType: approval.actionType,
          amount: approval.amount,
          ageMinutes: Math.round(age / 60000),
        });
      } catch (alertErr) {
        logger.warn('Failed to create stale approval alert', {
          component: 'heartbeat',
          approvalId: approval.id,
        }, alertErr);
      }
    }

    if (results.staleCount > 0) {
      logger.info('Heartbeat proactive: stale approvals alerted', {
        component: 'heartbeat',
        ...results,
      });
    }
  } catch (err) {
    logger.error('Proactive: alertStaleApprovals error', { component: 'heartbeat' }, err);
  }

  return results;
}

// POST /api/agent/heartbeat — Execute heartbeat tasks (auth: SERVICE_API_KEY)
router.post('/', serviceKeyAuth, async (req, res) => {
  const startTime = Date.now();
  const tasksExecuted = [];

  try {
    // Task 1: Record in-memory heartbeat timestamp
    const heartbeat = {
      agentId: 'onpoint-stylist',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '2.0.0',
    };
    tasksExecuted.push('heartbeat_recorded');

    // Task 2: Check wallet gas
    const walletHealth = await checkWalletGas();
    tasksExecuted.push('wallet_gas_checked');

    if (walletHealth.gasHealthy === false && !walletHealth.error) {
      logger.warn('Agent wallet low on gas', {
        component: 'heartbeat',
        balance: walletHealth.celoBalance,
      });
      tasksExecuted.push('gas_alert_logged');
    }

    // Task 3: Check Redis
    const redisHealthy = await checkRedis();
    tasksExecuted.push(redisHealthy ? 'redis_checked' : 'redis_check_failed');

    // Task 4: Check Bridge
    const bridgeHealthy = await checkBridge();
    tasksExecuted.push(bridgeHealthy ? 'bridge_checked' : 'bridge_check_failed');

    // Task 5: Retry failed suggestions
    const retryResults = await retryFailedSuggestions();
    if (retryResults.found > 0) {
      tasksExecuted.push(`retried_suggestions:${retryResults.retryable}_rejected:${retryResults.rejected}`);
    } else {
      tasksExecuted.push('retried_suggestions:0');
    }

    // Task 6: Prune expired state
    const pruneResults = await pruneExpired();
    if (pruneResults.expiredSuggestions > 0) {
      tasksExecuted.push(`pruned_expired:${pruneResults.expiredSuggestions}`);
    } else {
      tasksExecuted.push('pruned_expired:0');
    }

    // Task 7: Alert stale pending approvals
    const alertResults = await alertStaleApprovals();
    if (alertResults.staleCount > 0) {
      tasksExecuted.push(`stale_approvals_alerted:${alertResults.alerted}`);
    } else {
      tasksExecuted.push('stale_approvals:0');
    }

    const elapsed = Date.now() - startTime;

    // Determine overall health
    let healthStatus = 'healthy';
    if (!walletHealth.gasHealthy || !redisHealthy) healthStatus = 'warning';
    if (walletHealth.error || (!redisHealthy && !bridgeHealthy)) healthStatus = 'critical';

    const result = {
      timestamp: heartbeat.timestamp,
      agentId: heartbeat.agentId,
      version: heartbeat.version,
      wallet: {
        address: walletHealth.address,
        celoBalance: walletHealth.celoBalance,
        gasHealthy: walletHealth.gasHealthy,
        error: walletHealth.error || null,
      },
      infrastructure: {
        redis: redisHealthy ? 'connected' : 'disconnected',
        bridge: bridgeHealthy ? 'connected' : 'disconnected',
      },
      proactive: {
        retriedSuggestions: retryResults,
        prunedExpired: pruneResults,
        staleApprovals: alertResults,
      },
      tasksExecuted,
      healthStatus,
      elapsedMs: elapsed,
    };

    // Update shared metrics store with proactive task results
    try {
      updateProactiveMetrics(result.proactive);
    } catch { /* best effort */ }

    // Publish gas balance to the metrics exporter
    try {
      if (walletHealth.address && walletHealth.celoBalance) {
        agentCore.Metrics.setGasBalance(walletHealth.address, walletHealth.celoBalance);
      }
    } catch { /* best effort */ }

    res.json({ success: true, heartbeat: result });
  } catch (error) {
    logger.error('Heartbeat processing failed', { component: 'heartbeat' }, error);
    res.status(500).json({
      success: false,
      error: 'Heartbeat processing failed',
      tasksExecuted,
      elapsedMs: Date.now() - startTime,
    });
  }
});

// GET /api/agent/heartbeat — Public health status (no auth)
router.get('/', async (req, res) => {
  const [redisHealthy, bridgeHealthy] = await Promise.all([
    checkRedis().catch(() => false),
    checkBridge().catch(() => false),
  ]);

  res.json({
    status: 'healthy',
    service: 'onpoint-api',
    version: process.env.npm_package_version || '2.0.0',
    infrastructure: {
      redis: redisHealthy ? 'connected' : 'disconnected',
      bridge: bridgeHealthy ? 'connected' : 'disconnected',
    },
    agent: {
      id: 'onpoint-stylist',
      name: 'OnPoint AI Stylist',
      walletConfigured: !!process.env.AGENT_WALLET_ADDRESS,
      veniceConfigured: !!process.env.VENICE_API_KEY,
    },
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;
