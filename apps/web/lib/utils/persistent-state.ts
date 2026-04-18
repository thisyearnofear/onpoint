import { redisGet, redisSet } from "./redis-helpers";

const localStateCache = new Map<string, unknown>();

export async function readPersistentState<T>(
  key: string,
  createFallback: () => T,
): Promise<T> {
  const redisValue = await redisGet<T>(key);
  if (redisValue !== null) {
    localStateCache.set(key, redisValue);
    return redisValue;
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
  await redisSet(key, value);
  return value;
}

export function clearPersistentStateCache(key?: string): void {
  if (key) {
    localStateCache.delete(key);
    return;
  }

  localStateCache.clear();
}
