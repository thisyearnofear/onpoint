/**
 * Redis Helper Functions
 * 
 * Shared Redis operations using Upstash REST API.
 * Used across auth, rate limiting, and agent store.
 */

interface UpstashResult<T = unknown> {
  result: T;
}

function getRedisConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url, token } : null;
}

export async function redisGet<T>(key: string): Promise<T | null> {
  const config = getRedisConfig();
  if (!config) return null;

  try {
    const res = await fetch(`${config.url}/get/${key}`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });
    if (!res.ok) return null;
    const data: UpstashResult<string | null> = await res.json();
    if (data.result === null) return null;
    return JSON.parse(data.result) as T;
  } catch {
    return null;
  }
}

export async function redisSet(key: string, value: unknown): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: JSON.stringify(value) }),
    });
  } catch {
    // Silent fail
  }
}

export async function redisSetEx(
  key: string,
  value: unknown,
  ttlSeconds: number,
): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/set/${key}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ value: JSON.stringify(value), ex: ttlSeconds }),
    });
  } catch {
    // Silent fail
  }
}

export async function redisDel(key: string): Promise<void> {
  const config = getRedisConfig();
  if (!config) return;

  try {
    await fetch(`${config.url}/del/${key}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${config.token}` },
    });
  } catch {
    // Silent fail
  }
}

export function isRedisConfigured(): boolean {
  return !!getRedisConfig();
}
