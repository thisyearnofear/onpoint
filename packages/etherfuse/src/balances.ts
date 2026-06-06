/**
 * Per-user top-up credit ledger.
 *
 * Supports two backends:
 *   1. **In-memory** (default) — survives as long as the process lives.
 *   2. **Redis** — survives restarts. The Express server injects its
 *      existing `ioredis` connection via `setTopUpRedisClient()`. The
 *      Next.js app (which has no Redis connection) uses in-memory.
 *
 * The Redis data model is simple: per-user LIST keys storing
 * JSON-serialized `TopUpCredit` objects.
 *   Key format: `etherfuse:topups:{userAddress}` (lowercased)
 *
 * The existing `agent-wallet` route reads this ledger to add a "fiat top-up"
 * line to the user's available balance. Spend policy treats credits as a
 * positive adjustment, not a spend, so onramp top-ups never count against
 * the daily spend cap.
 */

import type { TopUpCredit } from "./types.js";

export interface TopUpBalanceStore {
  recordCredit(credit: TopUpCredit): Promise<void>;
  getCredits(userAddress: `0x${string}`): Promise<TopUpCredit[]>;
  getTotalCredited(
    userAddress: `0x${string}`,
    asset?: string,
  ): Promise<string>;
}

// ── In-memory backend (default) ────────────────────────────────────

class InMemoryTopUpBalanceStore implements TopUpBalanceStore {
  private readonly byUser = new Map<string, TopUpCredit[]>();

  async recordCredit(credit: TopUpCredit): Promise<void> {
    const key = credit.userAddress.toLowerCase();
    const list = this.byUser.get(key) ?? [];
    list.push(credit);
    this.byUser.set(key, list);
  }

  async getCredits(userAddress: `0x${string}`): Promise<TopUpCredit[]> {
    return this.byUser.get(userAddress.toLowerCase()) ?? [];
  }

  async getTotalCredited(
    userAddress: `0x${string}`,
    asset: string = "USDC",
  ): Promise<string> {
    const credits = await this.getCredits(userAddress);
    return sumCredits(credits, asset);
  }
}

// ── Redis backend (persistent across restarts) ─────────────────────

const REDIS_KEY_PREFIX = "etherfuse:topups:";

export function createRedisTopUpBalanceStore(
  redis: import("ioredis").Redis,
): TopUpBalanceStore {
  return new RedisTopUpBalanceStore(redis);
}

class RedisTopUpBalanceStore implements TopUpBalanceStore {
  constructor(private readonly redis: import("ioredis").Redis) {}

  private userKey(address: `0x${string}`): string {
    return `${REDIS_KEY_PREFIX}${address.toLowerCase()}`;
  }

  async recordCredit(credit: TopUpCredit): Promise<void> {
    const key = this.userKey(credit.userAddress);
    await this.redis.lpush(key, JSON.stringify(credit));
  }

  async getCredits(userAddress: `0x${string}`): Promise<TopUpCredit[]> {
    const key = this.userKey(userAddress);
    const raw = await this.redis.lrange(key, 0, -1);
    return raw
      .map((s) => {
        try {
          return JSON.parse(s) as TopUpCredit;
        } catch {
          return null;
        }
      })
      .filter((c): c is TopUpCredit => c !== null);
  }

  async getTotalCredited(
    userAddress: `0x${string}`,
    asset: string = "USDC",
  ): Promise<string> {
    const credits = await this.getCredits(userAddress);
    return sumCredits(credits, asset);
  }
}

// ── Shared helpers ─────────────────────────────────────────────────

function sumCredits(credits: TopUpCredit[], asset: string): string {
  let total = 0n;
  for (const c of credits) {
    if (c.cryptoAsset === asset) {
      try {
        total += BigInt(c.cryptoAmount);
      } catch {
        // ignore non-integer amounts (e.g. human-readable quotes from sandbox)
      }
    }
  }
  return total.toString();
}

// ── Singleton store ─────────────────────────────────────────────────

let store: TopUpBalanceStore | null = null;
let redisClient: import("ioredis").Redis | null = null;

/**
 * Inject an existing `ioredis` Redis connection. The Express server
 * calls this at startup with its already-initialized Redis client.
 * Set to `null` to force in-memory mode on a process that previously
 * used Redis (e.g. for testing).
 */
export function setTopUpRedisClient(redis: import("ioredis").Redis | null): void {
  redisClient = redis;
  // Reset the cached store so the next call picks up the new backend.
  store = null;
}

/**
 * Get the singleton top-up balance store.
 *
 * - If a Redis client has been set via `setTopUpRedisClient()`, returns
 *   a Redis-backed store (credits survive restarts).
 * - Otherwise returns the in-memory store (credits reset on restart).
 */
export function getTopUpBalanceStore(): TopUpBalanceStore {
  if (!store) {
    if (redisClient) {
      store = createRedisTopUpBalanceStore(redisClient);
    } else {
      store = new InMemoryTopUpBalanceStore();
    }
  }
  return store;
}

/**
 * Get the total credited balance for a user in human-readable form.
 *
 * Divides atomic units by 10^6 (USDC decimals) and returns the number.
 * Returns 0 if the user has no credits or the store is unreachable.
 * Mainly consumed by the spend policy to factor onramp credits into
 * the available balance without counting them against the daily cap.
 */
export async function getTopUpBalance(
  userAddress: `0x${string}`,
  asset: string = "USDC",
): Promise<number> {
  try {
    const s = getTopUpBalanceStore();
    const totalAtomic = await s.getTotalCredited(userAddress, asset);
    return Number(totalAtomic) / 1_000_000;
  } catch {
    return 0;
  }
}

/** Test helper: swap in a custom store (used by unit tests). */
export function __setTopUpBalanceStore(custom: TopUpBalanceStore): void {
  store = custom;
}
