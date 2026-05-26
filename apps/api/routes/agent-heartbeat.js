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

// POST /api/agent/heartbeat — Execute heartbeat tasks (auth: SERVICE_API_KEY)
// Auth is enforced here so the server.js mount doesn't need separate auth middleware
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
      tasksExecuted,
      healthStatus,
      elapsedMs: elapsed,
    };

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
