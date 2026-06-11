/**
 * Redis Helper Functions
 *
 * Shared Redis operations using Upstash REST API.
 * Used across auth, rate limiting, and agent store.
 *
 * All fetch calls have a 2-second request-scoped timeout.
 * On timeout or error, functions return null/[] gracefully
 * (circuit breaker pattern — no cascading failures).
 */

interface UpstashResult<T = unknown> {
  result: T;
}

const REQUEST_TIMEOUT_MS = 2000;

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

/**
 * Create an AbortSignal that times out after REQUEST_TIMEOUT_MS.
 * Falls back to undefined if AbortSignal.timeout is not available
 * (Node < 16).
 */
function createTimeoutSignal(): AbortSignal | undefined {
  try {
    return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
  } catch {
    return undefined;
  }
}

/**
 * Generic fetch wrapper with timeout and error handling.
 * Returns null on any failure (network, timeout, non-2xx).
 */
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response | null> {
  try {
    const signal = createTimeoutSignal();
    const response = await fetch(url, {
      ...options,
      signal: signal ?? options.signal,
    });
    if (!response.ok) return null;
    return response;
  } catch {
    return null;
  }
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  const response = await fetchWithTimeout(`${config.url}/get/${key}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!response) return null;

  try {
    const data: UpstashResult<string | null> = await response.json();
    if (data.result === null) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: unknown): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  await fetchWithTimeout(`${config.url}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value) }),
  });
}

export async function redisSetEx(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  await fetchWithTimeout(`${config.url}/set/${key}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
  });
}

export async function redisDel(key: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  await fetchWithTimeout(`${config.url}/del/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
  });
}

export async function redisSadd(key: string, member: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  await fetchWithTimeout(`${config.url}/sadd/${key}/${member}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
  });
}

export async function redisSmembers(key: string): Promise<string[]> {
  const config = getRedisConfig();
  if (!config) return [];

  const response = await fetchWithTimeout(`${config.url}/smembers/${key}`, {
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!response) return [];

  try {
    const data: UpstashResult<string[]> = await response.json();
    return data.result || [];
  } catch {
    return [];
  }
}

/**
 * Atomically increment a Redis key and return the new value.
 * Uses INCR which is atomic — safe for concurrent access.
 * Returns null if Redis is not configured or the call fails.
 */
export async function redisIncr(key: string): Promise<number | null> {
  const config = getRedisConfig();
  if (!config) return null;

  const response = await fetchWithTimeout(`${config.url}/incr/${key}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
  });
  if (!response) return null;

  try {
    const data: UpstashResult<number> = await response.json();
    return data.result;
  } catch {
    return null;
  }
}

export async function redisSrem(key: string, member: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  await fetchWithTimeout(`${config.url}/srem/${key}/${member}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.token}` },
  });
}

/**
 * Scan for keys matching a pattern using the Redis SCAN command.
 * Returns up to `count` matching keys. Performs multiple iterations
 * if needed to reach the count limit.
 */
export async function redisScan(
  pattern: string,
  count: number = 100,
): Promise<string[]> {
  const config = getRedisConfig();
  if (!config) return [];

  const keys: string[] = [];
  let cursor = 0;

  do {
    const response = await fetchWithTimeout(
      `${config.url}/scan/${cursor}/match/${encodeURIComponent(pattern)}/count/${Math.min(count - keys.length, 100)}`,
      { headers: { Authorization: `Bearer ${config.token}` } },
    );
    if (!response) break;

    try {
      const data: UpstashResult<[string, string[]]> = await response.json();
      const [nextCursor, batch] = data.result;
      cursor = parseInt(nextCursor, 10);
      keys.push(...batch);
    } catch {
      break;
    }
  } while (cursor !== 0 && keys.length < count);

  return keys.slice(0, count);
}

export function isRedisConfigured(): boolean {
  return !!getRedisConfig();
}
