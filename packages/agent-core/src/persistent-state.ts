import { redisGet, redisSet } from "./redis-helpers";

const localStateCache = new Map<string, unknown>();

/**
 * A durable store the host process can install (the API installs its ioredis
 * connection). Without one, state is written through the Upstash REST helpers
 * — and when those aren't configured either, it lives only in this process and
 * is lost on restart, which is how production lost every receipt on each
 * deploy until 2026-11-12.
 */
export interface PersistentStateBackend {
  /** Raw JSON string, or null when the key does not exist. Rejects on failure. */
  get(key: string): Promise<string | null>;
  /** Rejects on failure. */
  set(key: string, value: string): Promise<void>;
}

let backend: PersistentStateBackend | null = null;

export function setPersistentStateBackend(
  next: PersistentStateBackend | null,
): void {
  backend = next;
}

export function hasPersistentStateBackend(): boolean {
  return backend !== null;
}

export async function readPersistentState<T>(
  key: string,
  createFallback: () => T,
): Promise<T> {
  if (backend) {
    let raw: string | null;
    try {
      raw = await backend.get(key);
    } catch (err) {
      // A failed read is not an empty store. Serve what this process last
      // saw, or refuse — never hand back a fallback the caller would then
      // write over the real data.
      if (localStateCache.has(key)) return localStateCache.get(key) as T;
      throw new Error(
        `Persistent state unavailable for "${key}": ${(err as Error)?.message ?? err}`,
      );
    }
    if (raw !== null) {
      const value = JSON.parse(raw) as T;
      localStateCache.set(key, value);
      return value;
    }
  } else {
    const redisValue = await redisGet<T>(key);
    if (redisValue !== null) {
      localStateCache.set(key, redisValue);
      return redisValue;
    }
  }

  if (localStateCache.has(key)) {
    return localStateCache.get(key) as T;
  }

  const fallback = createFallback();
  localStateCache.set(key, fallback);
  return fallback;
}

export async function writePersistentState<T>(
  key: string,
  value: T,
): Promise<T> {
  localStateCache.set(key, value);
  if (backend) {
    await backend.set(key, JSON.stringify(value));
  } else {
    await redisSet(key, value);
  }
  return value;
}

export function clearPersistentStateCache(key?: string): void {
  if (key) {
    localStateCache.delete(key);
    return;
  }
  localStateCache.clear();
}
