/**
 * Durable backend for @repo/agent-core's persistent state (receipts, tip
 * ledgers, treasury).
 *
 * agent-core writes that state through Upstash REST helpers. The production
 * box sets REDIS_URL but no UPSTASH_* variables, so the helpers were silent
 * no-ops and every receipt lived only in process memory — each deploy or
 * restart erased them all. This installs the box's own Redis as the store.
 *
 * Call once per process that records or reads receipts.
 */

const Redis = require('ioredis');

const TIMEOUT_MS = 3000;

function withTimeout(promise) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Redis timed out')), TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function installPersistentStateBackend() {
  const url = process.env.REDIS_URL;
  // Upstash, when configured, stays the store — don't split state across two.
  if (!url || (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)) {
    return false;
  }

  const agentCore = require('@repo/agent-core');
  if (typeof agentCore.setPersistentStateBackend !== 'function') return false;

  // Fail commands fast instead of queueing them forever while disconnected.
  const redis = new Redis(url, { maxRetriesPerRequest: 2 });
  redis.on('error', (err) => {
    console.error('[PersistentState] Redis error:', err.message);
  });

  agentCore.setPersistentStateBackend({
    get: (key) => withTimeout(redis.get(key)),
    set: async (key, value) => {
      await withTimeout(redis.set(key, value));
    },
  });
  return true;
}

module.exports = { installPersistentStateBackend };
