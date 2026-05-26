#!/usr/bin/env node
/**
 * onpoint-worker — Persistent Agent Worker Loop
 *
 * Runs as a separate PM2 process (see deploy/ecosystem.config.js).
 * Responsibilities:
 *   1. POST /api/agent/heartbeat every 5 minutes (with SERVICE_API_KEY)
 *   2. Report errors to Sentry
 *   3. Expose /health for PM2 process monitoring
 *
 * Architecture (ADR 0001):
 *   This is the first step toward making the agent truly autonomous —
 *   a persistent loop, not a 60-second serverless function.
 *
 * Port: 48754 (internal — not exposed via nginx)
 */

require('dotenv').config();

const cron = require('node-cron');
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
const HEARTBEAT_INTERVAL = process.env.HEARTBEAT_INTERVAL || '*/5 * * * *'; // every 5 min

// Track last heartbeat result for the health endpoint
let lastHeartbeat = {
  timestamp: null,
  success: false,
  status: 'pending',
  healthStatus: null,
  error: null,
};

// ── Initialize Express ──
const app = express();

// JSON body parser (small limit — just for health checks)
app.use(express.json({ limit: '1kb' }));

// ── Health Endpoint (for PM2 process monitoring) ──
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    process: 'onpoint-worker',
    pid: process.pid,
    uptime: process.uptime(),
    heartbeat: {
      lastRun: lastHeartbeat.timestamp,
      lastSuccess: lastHeartbeat.success,
      lastStatus: lastHeartbeat.status,
      lastError: lastHeartbeat.error,
    },
    sentry: !!process.env.SENTRY_DSN,
    apiUrl: API_URL,
    cronSchedule: HEARTBEAT_INTERVAL,
    timestamp: Date.now(),
  });
});

// ── Heartbeat Task ──
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
    const response = await fetch(`${API_URL}/api/agent/heartbeat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-service-key': SERVICE_API_KEY,
      },
      signal: AbortSignal.timeout(15000), // 15s timeout
    });

    const body = await response.json().catch(() => null);
    const elapsed = Date.now() - startTime;

    if (response.ok && body?.success) {
      lastHeartbeat = {
        timestamp: new Date().toISOString(),
        success: true,
        status: 'healthy',
        healthStatus: body.heartbeat?.healthStatus || 'unknown',
        error: null,
      };
      logger.info('Heartbeat completed', {
        component: 'worker',
        healthStatus: body.heartbeat?.healthStatus,
        tasksExecuted: body.heartbeat?.tasksExecuted,
        elapsedMs: elapsed,
      });
    } else {
      lastHeartbeat = {
        timestamp: new Date().toISOString(),
        success: false,
        status: 'unhealthy',
        healthStatus: body?.heartbeat?.healthStatus || 'error',
        error: body?.error || `HTTP ${response.status}`,
      };
      logger.warn('Heartbeat returned unhealthy', {
        component: 'worker',
        status: response.status,
        body,
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

    if (Sentry) {
      Sentry.captureException(err, {
        tags: { component: 'worker', task: 'heartbeat' },
      });
    }
  }
}

// ── Start Cron ──
logger.info('Starting onpoint-worker', {
  component: 'worker',
  port: WORKER_PORT,
  apiUrl: API_URL,
  cronSchedule: HEARTBEAT_INTERVAL,
  sentry: !!process.env.SENTRY_DSN,
});

// Schedule the heartbeat cron
const task = cron.schedule(HEARTBEAT_INTERVAL, () => {
  executeHeartbeat().catch((err) => {
    logger.error('Unhandled heartbeat error', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
});

// Also run immediately on startup (after a brief delay to let the API warm up)
setTimeout(() => {
  executeHeartbeat().catch((err) => {
    logger.error('Initial heartbeat failed', { component: 'worker' }, err);
    if (Sentry) Sentry.captureException(err);
  });
}, 3000);

// ── Start Express Server ──
app.listen(WORKER_PORT, '127.0.0.1', () => {
  logger.info(`onpoint-worker running on port ${WORKER_PORT}`, { component: 'worker' });
  logger.info(`Heartbeat cron scheduled: ${HEARTBEAT_INTERVAL}`, { component: 'worker' });
});

// ── Graceful Shutdown ──
process.on('SIGTERM', () => {
  logger.info('Worker shutting down (SIGTERM)', { component: 'worker' });
  task.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Worker shutting down (SIGINT)', { component: 'worker' });
  task.stop();
  process.exit(0);
});
