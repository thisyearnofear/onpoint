/**
 * One-time wallet-signature challenges for agent auth.
 *
 * A challenge is stored per address with a short TTL and consumed atomically
 * on verify (GET+DEL in a single Redis MULTI), so a signature can only be
 * exchanged for a session token once. Redis is the production store; the
 * in-memory store exists for local dev/test and single-process use only.
 */

const CHALLENGE_KEY_PREFIX = 'agent-auth:challenge:';

function challengeKey(address) {
  return `${CHALLENGE_KEY_PREFIX}${String(address).toLowerCase()}`;
}

/**
 * @param {import('ioredis').Redis} redis
 */
function createRedisChallengeStore(redis) {
  return {
    async save(address, challenge, ttlSeconds) {
      await redis.set(challengeKey(address), JSON.stringify(challenge), 'EX', ttlSeconds);
    },
    /** Atomically read-and-delete. Returns the challenge or null. */
    async take(address) {
      const key = challengeKey(address);
      const results = await redis.multi().get(key).del(key).exec();
      const getRes = results ? results[0] : null;
      if (!getRes || getRes[0]) {
        throw new Error('Challenge store unavailable');
      }
      return getRes[1] ? JSON.parse(getRes[1]) : null;
    },
  };
}

function createMemoryChallengeStore() {
  const entries = new Map();
  return {
    async save(address, challenge, ttlSeconds) {
      entries.set(challengeKey(address), {
        challenge,
        expiresAt: Date.now() + ttlSeconds * 1000,
      });
    },
    async take(address) {
      const key = challengeKey(address);
      const entry = entries.get(key);
      entries.delete(key);
      if (!entry || entry.expiresAt <= Date.now()) return null;
      return entry.challenge;
    },
  };
}

module.exports = { createRedisChallengeStore, createMemoryChallengeStore };