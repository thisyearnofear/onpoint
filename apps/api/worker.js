#!/usr/bin/env node
/**
 * onpoint-worker — Persistent Agent Task Loop
 *
 * Runs as a separate PM2 process (see deploy/ecosystem.config.js).
 *
 * Responsibilities (Tier 1 autonomous agent):
 *   1. Heartbeat — POST /api/agent/heartbeat every 5 min (existing)
 *   2. Task processing — POST /api/agent/tasks/execute to process
 *      pending external_search suggestions via the web bridge
 *   3. Market signal polling — POST /api/agent/tasks/market-signals
 *      with trending fashion queries for proactive retail intelligence
 *   4. Expose /health for PM2 process monitoring
 *
 * Architecture (ADR 0001):
 *   This is the agent's persistent brain — not a 60-second serverless
 *   function. Runs continuously on the Hetzner VPS.
 *
 * Port: 48754 (internal — not exposed via nginx)
 */

require('dotenv').config();

const express = require('express');
const logger = require('./lib/logger');

// ── Sentry (optional, if SENTRY_DSN is configured) ──
let Sentry;
if (process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || `onpoint-worker@${process.env.npm_package_version || '2.1.0'}`,
    tracesSampleRate: 0.1,
  });
  logger.info('Sentry initialized for worker', { component: 'worker' });
}

// ── Configuration ──
const WORKER_PORT = parseInt(process.env.WORKER_PORT) || 48754;
const API_URL = process.env.API_URL || `http://localhost:${process.env.PORT || 48751}`;
const SERVICE_API_KEY = process.env.SERVICE_API_KEY || '';

// Task intervals in milliseconds
const HEARTBEAT_INTERVAL_MS = parseInt(process.env.HEARTBEAT_INTERVAL_MS) || 5 * 60 * 1000;      // 5 min
const TASK_INTERVAL_MS = parseInt(process.env.TASK_INTERVAL_MS) || 5 * 60 * 1000;                // 5 min
const MARKET_SIGNAL_INTERVAL_MS = parseInt(process.env.MARKET_SIGNAL_INTERVAL_MS) || 15 * 60 * 1000; // 15 min
const RETENTION_DIGEST_INTERVAL_MS = parseInt(process.env.RETENTION_DIGEST_INTERVAL_MS) || 7 * 24 * 60 * 60 * 1000; // 7 days
const PAYOUT_RETRY_INTERVAL_MS = parseInt(process.env.PAYOUT_RETRY_INTERVAL_MS) || 30 * 60 * 1000; // 30 min

// ── State ──
let lastHeartbeat = {
  timestamp: null,
  success: false,
  status: 'pending',
  healthStatus: null,
  error: null,
};

let lastTaskRun = {
  timestamp: null,
  processed: 0,
  succeeded: 0,
  failed: 0,
  error: null,
};

let lastMarketSignalRun = {
  timestamp: null,
  totalSignals: 0,
  queriesProcessed: 0,
  error: null,
};

let lastRetentionDigest = {
  timestamp: null,
  success: false,
  error: null,
};

let lastPayoutRetry = {
  timestamp: null,
  processed: 0,
  succeeded: 0,
  failed: 0,
  autoReleased: 0,
  error: null,
};

let cycleCount = 0;

// ── Initialize Express ──
const app = express();
app.use(express.json({ limit: '1kb' }));

// ── Health Endpoint (for PM2 process monitoring) ──
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    process: 'onpoint-worker',
    pid: process.pid,
    uptime: process.uptime(),
    cycleCount,
    heartbeat: {
      lastRun: lastHeartbeat.timestamp,
      lastSuccess: lastHeartbeat.success,
      lastStatus: lastHeartbeat.status,
      lastError: lastHeartbeat.error,
    },
    taskProcessing: {
      lastRun: lastTaskRun.timestamp,
      lastProcessed: lastTaskRun.processed,
      lastSucceeded: lastTaskRun.succeeded,
      lastFailed: lastTaskRun.failed,
      lastError: lastTaskRun.error,
    },
    marketSignals: {
      lastRun: lastMarketSignalRun.timestamp,
      lastTotalSignals: lastMarketSignalRun.totalSignals,
      lastQueriesProcessed: lastMarketSignalRun.queriesProcessed,
      lastError: lastMarketSignalRun.error,
      lastDropsFound: lastMarketSignalRun.dropsFound || 0,
      lastAutoBuyAttempted: lastMarketSignalRun.autoBuyAttempted || 0,
      lastAutoBuyExecuted: lastMarketSignalRun.autoBuyExecuted || 0,
    },
    retentionDigest: {
      lastRun: lastRetentionDigest.timestamp,
      lastSuccess: lastRetentionDigest.success,
      lastError: lastRetentionDigest.error,
    },
    payoutRetry: {
      lastRun: lastPayoutRetry.timestamp,
      lastProcessed: lastPayoutRetry.processed,
      lastSucceeded: lastPayoutRetry.succeeded,
      lastFailed: lastPayoutRetry.failed,
      lastAutoReleased: lastPayoutRetry.autoReleased,
      lastError: lastPayoutRetry.error,
    },
    intervals: {
      heartbeatMs: HEARTBEAT_INTERVAL_MS,
      taskMs: TASK_INTERVAL_MS,
      marketSignalMs: MARKET_SIGNAL_INTERVAL_MS,
      retentionDigestMs: RETENTION_DIGEST_INTERVAL_MS,
      payoutRetryMs: PAYOUT_RETRY_INTERVAL_MS,
    },
    apiUrl: API_URL,
    sentry: !!process.env.SENTRY_DSN,
    timestamp: Date.now(),
  });
});

// ── HTTP Helpers ──

async function apiPost(path, body = {}) {
  const url = `${API_URL}${path}`;
  const headers = {
    'Content-Type': 'application/json',
  };
  if (SERVICE_API_KEY) {
    headers['x-service-key'] = SERVICE_API_KEY;
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(90000), // 90s timeout (web bridge + commerce pipeline)
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

async function apiGet(path) {
  const url = `${API_URL}${path}`;
  const headers = {};
  if (SERVICE_API_KEY) {
    headers['x-service-key'] = SERVICE_API_KEY;
  }

  const response = await fetch(url, {
    method: 'GET',
    headers,
    signal: AbortSignal.timeout(15000),
  });

  const data = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

// ── Task Execution ──

/**
 * Task 1: Heartbeat — POST /api/agent/heartbeat
 * Checks wallet gas, Redis, and bridge health. Reports to Sentry on failure.
 */
async function executeHeartbeat() {
  const startTime = Date.now();

  if (!SERVICE_API_KEY) {
    lastHeartbeat = {
      timestamp: new Date().toISOString(),
      success: false,
      status: 'skipped',
      healthStatus: null,
      error: 'SERVICE_API_KEY not configured',
    };
    logger.warn('Heartbeat skipped — SERVICE_API_KEY not set', { component: 'worker' });
    return;
  }

  try {
    const { ok, status, data } = await apiPost('/api/agent/heartbeat');
    const elapsed = Date.now() - startTime;

    if (ok && data?.success) {
      lastHeartbeat = {
        timestamp: new Date().toISOString(),
        success: true,
        status: 'healthy',
        healthStatus: data.heartbeat?.healthStatus || 'unknown',
        error: null,
      };
      logger.info('Heartbeat completed', {
        component: 'worker',
        healthStatus: data.heartbeat?.healthStatus,
        tasksExecuted: data.heartbeat?.tasksExecuted?.length,
        elapsedMs: elapsed,
      });
    } else {
      lastHeartbeat = {
        timestamp: new Date().toISOString(),
        success: false,
        status: 'unhealthy',
        healthStatus: data?.heartbeat?.healthStatus || 'error',
        error: data?.error || `HTTP ${status}`,
      };
      logger.warn('Heartbeat returned unhealthy', {
        component: 'worker',
        status,
        data,
        elapsedMs: elapsed,
      });
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    lastHeartbeat = {
      timestamp: new Date().toISOString(),
      success: false,
      status: 'error',
      healthStatus: null,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };

    logger.error('Heartbeat failed', { component: 'worker', elapsedMs: elapsed }, err);
    if (Sentry) Sentry.captureException(err, { tags: { component: 'worker', task: 'heartbeat' } });
  }
}

/**
 * Task 2: Process pending suggestions — POST /api/agent/tasks/execute
 * Fetches pending external_search suggestions and dispatches them to the web bridge.
 */
async function executeTaskProcessing() {
  const startTime = Date.now();

  if (!SERVICE_API_KEY) {
    lastTaskRun = {
      timestamp: new Date().toISOString(),
      processed: 0, succeeded: 0, failed: 0,
      error: 'SERVICE_API_KEY not configured',
    };
    return;
  }

  try {
    const { ok, data } = await apiPost('/api/agent/tasks/execute');

    if (ok && data?.success) {
      lastTaskRun = {
        timestamp: new Date().toISOString(),
        processed: data.processed || 0,
        succeeded: data.succeeded || 0,
        failed: data.failed || 0,
        error: null,
      };

      if (data.processed > 0) {
        logger.info('Tasks executed', {
          component: 'worker',
          processed: data.processed,
          succeeded: data.succeeded,
          failed: data.failed,
          pendingCount: data.pendingCount,
          elapsedMs: Date.now() - startTime,
        });
      }
    } else {
      lastTaskRun = {
        timestamp: new Date().toISOString(),
        processed: 0, succeeded: 0, failed: 0,
        error: data?.error || 'Task execution failed',
      };
      logger.warn('Task processing returned error', {
        component: 'worker',
        data,
        elapsedMs: Date.now() - startTime,
      });
    }
  } catch (err) {
    lastTaskRun = {
      timestamp: new Date().toISOString(),
      processed: 0, succeeded: 0, failed: 0,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };
    logger.error('Task processing failed', { component: 'worker', elapsedMs: Date.now() - startTime }, err);
    if (Sentry) Sentry.captureException(err, { tags: { component: 'worker', task: 'task-processing' } });
  }
}

/**
 * Task 3: Market signal polling — POST /api/agent/tasks/market-signals
 * Proactively fetches trending fashion data from the web bridge.
 */
async function executeMarketSignalPolling() {
  const startTime = Date.now();

  if (!SERVICE_API_KEY) {
    lastMarketSignalRun = {
      timestamp: new Date().toISOString(),
      totalSignals: 0, queriesProcessed: 0,
      error: 'SERVICE_API_KEY not configured',
    };
    return;
  }

  try {
    // Fetch active user IDs for market signal matching
    let matchUserIds = [];
    try {
      const activeUsers = await apiGet('/api/agent/tasks/active-users');
      if (activeUsers.ok && activeUsers.data?.userIds?.length > 0) {
        matchUserIds = activeUsers.data.userIds;
        logger.info(`Market signals: will match against ${matchUserIds.length} active user(s)`, {
          component: 'worker',
          userCount: matchUserIds.length,
        });
      }
    } catch (err) {
      logger.warn('Market signals: failed to fetch active users', { component: 'worker' }, err);
    }

    const { ok, data } = await apiPost('/api/agent/tasks/market-signals', {
      maxResults: 3,
      matchUserIds,
    });

    if (ok && data?.success) {
      lastMarketSignalRun = {
        timestamp: new Date().toISOString(),
        totalSignals: data.totalSignals || 0,
        queriesProcessed: data.queriesProcessed || 0,
        error: null,
      };

      if (data.totalSignals > 0) {
        logger.info('Market signals collected', {
          component: 'worker',
          queriesProcessed: data.queriesProcessed,
          totalSignals: data.totalSignals,
          dropCount: data.dropsFound || 0,
          autoBuyCount: data.autoBuyResults?.length || 0,
          elapsedMs: Date.now() - startTime,
        });

        // Log auto-buy results
        if (data.autoBuyResults?.length > 0) {
          for (const result of data.autoBuyResults) {
            if (result.success) {
              logger.info(`Auto-buy: ${result.description || result.dropName}`, {
                component: 'worker',
                userId: result.userId,
                autoExecuted: result.autoExecuted,
              });
            }
          }
        }
      }

      // Update market signal run with commerce data
      if (data.dropsFound > 0 || data.autoBuyResults?.length > 0) {
        lastMarketSignalRun.dropsFound = data.dropsFound || 0;
        lastMarketSignalRun.autoBuyAttempted = data.autoBuyResults?.length || 0;
        lastMarketSignalRun.autoBuyExecuted = data.autoBuyResults?.filter(r => r.autoExecuted).length || 0;
      }
    } else {
      lastMarketSignalRun = {
        timestamp: new Date().toISOString(),
        totalSignals: 0, queriesProcessed: 0,
        error: data?.error || 'Market signal polling failed',
      };
      logger.warn('Market signal polling returned error', {
        component: 'worker',
        data,
        elapsedMs: Date.now() - startTime,
      });
    }
  } catch (err) {
    lastMarketSignalRun = {
      timestamp: new Date().toISOString(),
      totalSignals: 0, queriesProcessed: 0,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };
    logger.error('Market signal polling failed', {
      component: 'worker',
      elapsedMs: Date.now() - startTime,
    }, err);
    if (Sentry) Sentry.captureException(err, {
      tags: { component: 'worker', task: 'market-signals' },
    });
  }
}

/**
 * Task 4: Weekly retention digest — POST /api/cron/retention-digest
 * Sends admin email with top retention metrics for the week.
 */
async function executeRetentionDigest() {
  const startTime = Date.now();

  const webUrl = process.env.WEB_URL || (process.env.VERCEL_DOMAIN ? `https://${process.env.VERCEL_DOMAIN}` : null);
  if (!webUrl) {
    lastRetentionDigest = {
      timestamp: new Date().toISOString(),
      success: false,
      error: 'WEB_URL or VERCEL_DOMAIN not configured',
    };
    logger.warn('Retention digest skipped — WEB_URL not set', { component: 'worker' });
    return;
  }

  try {
    const url = `${webUrl}/api/cron/retention-digest`;
    const headers = { 'Content-Type': 'application/json' };
    if (SERVICE_API_KEY) {
      headers['x-service-key'] = SERVICE_API_KEY;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(30000),
    });

    const data = await response.json().catch(() => null);
    const elapsed = Date.now() - startTime;

    if (response.ok && data?.sent) {
      lastRetentionDigest = {
        timestamp: new Date().toISOString(),
        success: true,
        error: null,
      };
      logger.info('Retention digest sent', {
        component: 'worker',
        recipient: data.recipient,
        totalSaves: data.summary?.totalSaves,
        totalShares: data.summary?.totalShares,
        shareRate: data.summary?.shareRate,
        elapsedMs: elapsed,
      });
    } else {
      lastRetentionDigest = {
        timestamp: new Date().toISOString(),
        success: false,
        error: data?.error || `HTTP ${response.status}`,
      };
      logger.warn('Retention digest returned error', {
        component: 'worker',
        status: response.status,
        data,
        elapsedMs: elapsed,
      });
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    lastRetentionDigest = {
      timestamp: new Date().toISOString(),
      success: false,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };
    logger.error('Retention digest failed', {
      component: 'worker',
      elapsedMs: elapsed,
    }, err);
    if (Sentry) Sentry.captureException(err, { tags: { component: 'worker', task: 'retention-digest' } });
  }
}

/**
 * Task 5: Payout retry + split distribution — POST /api/cron/payout-retry
 * Retries failed curator payouts and distributes pending SplitV2 balances.
 * Also auto-releases shipped orders to delivered after AUTO_RELEASE_DAYS.
 */
async function executePayoutRetry() {
  const startTime = Date.now();

  if (!SERVICE_API_KEY) {
    lastPayoutRetry = {
      timestamp: new Date().toISOString(),
      processed: 0, succeeded: 0, failed: 0, autoReleased: 0,
      error: 'SERVICE_API_KEY not configured',
    };
    return;
  }

  try {
    const { ok, data } = await apiPost('/api/cron/payout-retry');

    if (ok && data?.success) {
      lastPayoutRetry = {
        timestamp: new Date().toISOString(),
        processed: data.processed || 0,
        succeeded: data.succeeded || 0,
        failed: data.failed || 0,
        autoReleased: data.autoReleased || 0,
        error: null,
      };
      logger.info('Payout retry completed', {
        component: 'worker',
        processed: data.processed,
        succeeded: data.succeeded,
        failed: data.failed,
        autoReleased: data.autoReleased,
        elapsedMs: Date.now() - startTime,
      });
    } else {
      lastPayoutRetry = {
        timestamp: new Date().toISOString(),
        processed: 0, succeeded: 0, failed: 0, autoReleased: 0,
        error: data?.error || 'Payout retry failed',
      };
      logger.warn('Payout retry returned error', {
        component: 'worker',
        data,
        elapsedMs: Date.now() - startTime,
      });
    }
  } catch (err) {
    lastPayoutRetry = {
      timestamp: new Date().toISOString(),
      processed: 0, succeeded: 0, failed: 0, autoReleased: 0,
      error: err.message?.slice(0, 200) || 'Unknown error',
    };
    logger.error('Payout retry failed', { component: 'worker', elapsedMs: Date.now() - startTime }, err);
    if (Sentry) Sentry.captureException(err, { tags: { component: 'worker', task: 'payout-retry' } });
  }
}

/**
 * Full worker cycle: heartbeat → task processing → market signals
 */
async function runCycle() {
  cycleCount++;
  const startTime = Date.now();

  logger.info(`Worker cycle ${cycleCount} starting`, {
    component: 'worker',
    cycleCount,
  });

  // Task 1: Heartbeat (always runs)
  await executeHeartbeat();

  // Task 2: Process pending suggestions (always runs)
  await executeTaskProcessing();

  const elapsed = Date.now() - startTime;
  logger.info(`Worker cycle ${cycleCount} complete`, {
    component: 'worker',
    cycleCount,
    elapsedMs: elapsed,
    heartbeatStatus: lastHeartbeat.status,
    tasksProcessed: lastTaskRun.processed,
    signalsCollected: lastMarketSignalRun.totalSignals,
  });
}

// ── Start Background Tasks ──

logger.info('Starting onpoint-worker', {
  component: 'worker',
  port: WORKER_PORT,
  apiUrl: API_URL,
  intervals: {
    heartbeatMs: HEARTBEAT_INTERVAL_MS,
    taskMs: TASK_INTERVAL_MS,
    marketSignalMs: MARKET_SIGNAL_INTERVAL_MS,
    retentionDigestMs: RETENTION_DIGEST_INTERVAL_MS,
    payoutRetryMs: PAYOUT_RETRY_INTERVAL_MS,
  },
  sentry: !!process.env.SENTRY_DSN,
});

// Heartbeat + task processing: every HEARTBEAT_INTERVAL_MS (5 min)
setInterval(() => {
  runCycle().catch((err) => {
    logger.error('Unhandled worker cycle error', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, HEARTBEAT_INTERVAL_MS);

// Market signal polling: every MARKET_SIGNAL_INTERVAL_MS (15 min)
setInterval(() => {
  executeMarketSignalPolling().catch((err) => {
    logger.error('Market signal polling error', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, MARKET_SIGNAL_INTERVAL_MS);

// Payout retry + split distribution: every PAYOUT_RETRY_INTERVAL_MS (30 min)
setInterval(() => {
  executePayoutRetry().catch((err) => {
    logger.error('Payout retry cycle error', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, PAYOUT_RETRY_INTERVAL_MS);

// Retention digest: every RETENTION_DIGEST_INTERVAL_MS (7 days by default)
setInterval(() => {
  executeRetentionDigest().catch((err) => {
    logger.error('Retention digest cycle error', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, RETENTION_DIGEST_INTERVAL_MS);

// Also run the full cycle immediately on startup (after a brief delay to let the API warm up)
setTimeout(() => {
  runCycle().catch((err) => {
    logger.error('Initial worker cycle failed', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, 3000);

// Initial market signal poll (staggered — runs 30s after the initial cycle)
setTimeout(() => {
  executeMarketSignalPolling().catch((err) => {
    logger.error('Initial market signal poll failed', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, 35000);

// Initial retention digest (staggered — runs 2 minutes after startup)
setTimeout(() => {
  executeRetentionDigest().catch((err) => {
    logger.error('Initial retention digest failed', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, 120000);

// Initial payout retry (staggered — runs 2.5 min after startup)
setTimeout(() => {
  executePayoutRetry().catch((err) => {
    logger.error('Initial payout retry failed', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, 150000);

// ── Start Express Server ──
app.listen(WORKER_PORT, '127.0.0.1', () => {
  logger.info(`onpoint-worker running on port ${WORKER_PORT}`, { component: 'worker' });
  logger.info(`Cycle interval: ${HEARTBEAT_INTERVAL_MS}ms`, { component: 'worker' });
});

// ── Graceful Shutdown ──
process.on('SIGTERM', () => {
  logger.info('Worker shutting down (SIGTERM)', { component: 'worker' });
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Worker shutting down (SIGINT)', { component: 'worker' });
  process.exit(0);
});
