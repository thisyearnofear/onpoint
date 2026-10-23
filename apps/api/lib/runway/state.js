/**
 * Runway game state (ADR 0022). Redis-backed with an in-memory fallback,
 * mirroring the linq-agent pattern. No Linq imports — channel-agnostic.
 *
 * Keys:
 *   runway:chat:{chatId}            — current round record, TTL 24h
 *   runway:result:{roundId}         — judged result, TTL 30d (card render)
 *   runway:count:{chatId}:{yyyymmdd}— per-chat daily round counter, 2d TTL
 *   runway:vision:{yyyymmdd}        — global daily vision-call counter, 2d TTL
 */

const crypto = require('crypto');
const { getRedis } = require('../redis');

const ROUND_TTL_SECONDS = 24 * 60 * 60;
const RESULT_TTL_SECONDS = 30 * 24 * 60 * 60;
const COUNTER_TTL_SECONDS = 2 * 24 * 60 * 60;

const ROUNDS_PER_CHAT_DAY = parseInt(process.env.RUNWAY_ROUNDS_PER_CHAT_DAY, 10) || 15;
const DAILY_VISION_CAP = parseInt(process.env.RUNWAY_DAILY_VISION_CAP, 10) || 500;

const mem = {
  rounds: new Map(),
  results: new Map(),
  counters: new Map(),
};

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of mem.rounds) if (v.expiresAt <= now) mem.rounds.delete(k);
  for (const [k, v] of mem.results) if (v.expiresAt <= now) mem.results.delete(k);
  for (const [k, v] of mem.counters) if (v.expiresAt <= now) mem.counters.delete(k);
}, 5 * 60 * 1000).unref();

function utcDay(now = Date.now()) {
  return new Date(now).toISOString().slice(0, 10).replace(/-/g, '');
}

async function readJson(key) {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get(key);
      if (value !== null) return JSON.parse(value);
    } catch {
      // fall through to memory
    }
  }
  const entry = mem.rounds.get(key) || mem.results.get(key);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

async function writeJson(key, value, ttlSeconds, bucket) {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      return;
    } catch {
      // fall through to memory
    }
  }
  bucket.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
}

async function getRound(chatId) {
  return readJson(`runway:chat:${chatId}`);
}

async function saveRound(chatId, round) {
  await writeJson(`runway:chat:${chatId}`, round, ROUND_TTL_SECONDS, mem.rounds);
  return round;
}

function newRound({ themeId, persona, now = Date.now(), recentThemes = [] }) {
  return {
    roundId: crypto.randomBytes(6).toString('hex'),
    themeId,
    persona,
    startedAt: now,
    deadline: now + 180_000,
    status: 'awaiting_photo',
    recentThemes,
  };
}

async function saveResult(roundId, result) {
  await writeJson(`runway:result:${roundId}`, result, RESULT_TTL_SECONDS, mem.results);
  return result;
}

async function getResult(roundId) {
  const redis = getRedis();
  if (redis) {
    try {
      const value = await redis.get(`runway:result:${roundId}`);
      if (value !== null) return JSON.parse(value);
    } catch {
      // fall through to memory
    }
  }
  const entry = mem.results.get(`runway:result:${roundId}`);
  if (entry && entry.expiresAt > Date.now()) return entry.value;
  return null;
}

async function incrCounter(key, ttlSeconds = COUNTER_TTL_SECONDS) {
  const redis = getRedis();
  if (redis) {
    try {
      const n = await redis.incr(key);
      if (n === 1) await redis.expire(key, ttlSeconds);
      return n;
    } catch {
      // fall through to memory
    }
  }
  const entry = mem.counters.get(key);
  if (!entry || entry.expiresAt <= Date.now()) {
    mem.counters.set(key, { value: 1, expiresAt: Date.now() + ttlSeconds * 1000 });
    return 1;
  }
  entry.value += 1;
  return entry.value;
}

/** Per-chat rounds today — returns the new count. */
async function incrChatRounds(chatId, now = Date.now()) {
  return incrCounter(`runway:count:${chatId}:${utcDay(now)}`);
}

/** Global vision calls today — returns the new count. */
async function incrVisionCalls(now = Date.now()) {
  return incrCounter(`runway:vision:${utcDay(now)}`);
}

module.exports = {
  ROUND_TTL_SECONDS,
  RESULT_TTL_SECONDS,
  ROUNDS_PER_CHAT_DAY,
  DAILY_VISION_CAP,
  utcDay,
  getRound,
  saveRound,
  newRound,
  saveResult,
  getResult,
  incrChatRounds,
  incrVisionCalls,
};
