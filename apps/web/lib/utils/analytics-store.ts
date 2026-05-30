/**
 * Analytics store — aggregates provider outcome metrics in Upstash Redis.
 *
 * Relies on the same UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * environment variables used by the rate limiter.
 *
 * All writes are best-effort: failures are logged but never thrown, so
 * analytics ingestion never blocks the request path.
 */

const KEY_PREFIX = "analytics:provider_outcomes";

interface ProviderOutcomeProperties {
  provider?: string;
  imageConditioned: boolean;
  fallbackReason?: string | null;
  latencyMs?: number;
  errorClass?: string | null;
  garmentSource?: string;
  garmentCategory?: string;
  hasPersonImage: boolean;
  hasGarmentImage: boolean;
}

// ── Redis helpers ───────────────────────────────────────────────────────────

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

async function redisIncr(key: string): Promise<void> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return;

  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["INCR", key]]),
    });
  } catch {
    // Best-effort — analytics must never block
  }
}

async function redisGet(key: string): Promise<number | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  try {
    const res = await fetch(`${url}/get/${key}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

async function redisBatchGet(keys: string[]): Promise<(number | null)[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token || keys.length === 0) return [];

  try {
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(keys.map((k) => ["GET", k])),
    });
    if (!res.ok) return keys.map(() => null);
    const data: { result: number | null }[] = await res.json();
    return data.map((d) => d.result);
  } catch {
    return keys.map(() => null);
  }
}

async function redisScanKeys(
  pattern: string,
): Promise<string[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return [];

  try {
    // Upstash REST API supports SCAN via pipeline
    const res = await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([["SCAN", "0", "MATCH", pattern, "COUNT", "200"]]),
    });
    if (!res.ok) return [];
    const data: { result: [string, string[]] }[] = await res.json();
    return data[0]?.result?.[1] ?? [];
  } catch {
    return [];
  }
}

// ── Aggregation API ─────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Record a provider outcome event — increments all relevant counters.
 * Safe to call on every event (batch-increment by 1 each time).
 */
export async function recordProviderOutcome(
  props: ProviderOutcomeProperties,
): Promise<void> {
  const today = todayStr();
  const provider = props.provider || "unknown";
  const fallback = props.fallbackReason || "no_fallback";
  const errorClass = props.errorClass || null;
  const source = props.garmentSource || "unknown";
  const category = props.garmentCategory || "unknown";

  // Build batch of INCR commands
  const cmds: string[][] = [
    ["INCR", `${KEY_PREFIX}:total`],
    ["INCR", `${KEY_PREFIX}:by_provider:${provider}`],
    [
      "INCR",
      props.imageConditioned
        ? `${KEY_PREFIX}:image_conditioned:yes`
        : `${KEY_PREFIX}:image_conditioned:no`,
    ],
    ["INCR", `${KEY_PREFIX}:fallback:${fallback}`],
    ["INCR", `${KEY_PREFIX}:source:${source}`],
    ["INCR", `${KEY_PREFIX}:category:${category}`],
    // Daily time-series
    ["INCR", `${KEY_PREFIX}:daily:${today}:total`],
    ["INCR", `${KEY_PREFIX}:daily:${today}:by_provider:${provider}`],
  ];

  // Error class (if present)
  if (errorClass) {
    cmds.push(["INCR", `${KEY_PREFIX}:error:${errorClass}`]);
  }

  // Latency (track sum + count to compute average)
  if (typeof props.latencyMs === "number") {
    cmds.push(["INCRBY", `${KEY_PREFIX}:latency_sum`, String(Math.round(props.latencyMs))]);
    cmds.push(["INCR", `${KEY_PREFIX}:latency_count`]);
  }

  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return;

  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cmds),
    });
  } catch {
    // Best-effort
  }
}

// ── Query API ───────────────────────────────────────────────────────────────

export interface ProviderOutcomeReport {
  total: number;
  byProvider: Record<string, number>;
  imageConditioned: { yes: number; no: number };
  fallbackReasons: Record<string, number>;
  errorClasses: Record<string, number>;
  avgLatencyMs: number | null;
  garmentSources: Record<string, number>;
  garmentCategories: Record<string, number>;
  last7Days: { date: string; total: number }[];
}

/**
 * Fetch the aggregated provider outcome report from Redis.
 */
export async function getProviderOutcomeReport(): Promise<ProviderOutcomeReport | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  const today = todayStr();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }

  // Scan for dynamic keys
  const [providerKeys, fallbackKeys, errorKeys, sourceKeys, categoryKeys] =
    await Promise.all([
      redisScanKeys(`${KEY_PREFIX}:by_provider:*`),
      redisScanKeys(`${KEY_PREFIX}:fallback:*`),
      redisScanKeys(`${KEY_PREFIX}:error:*`),
      redisScanKeys(`${KEY_PREFIX}:source:*`),
      redisScanKeys(`${KEY_PREFIX}:category:*`),
    ]);

  // Build keys list for batch GET
  const keys = [
    `${KEY_PREFIX}:total`,
    `${KEY_PREFIX}:image_conditioned:yes`,
    `${KEY_PREFIX}:image_conditioned:no`,
    `${KEY_PREFIX}:latency_sum`,
    `${KEY_PREFIX}:latency_count`,
    ...providerKeys,
    ...fallbackKeys,
    ...errorKeys,
    ...sourceKeys,
    ...categoryKeys,
    ...dates.map((d) => `${KEY_PREFIX}:daily:${d}:total`),
  ];

  const values = await redisBatchGet(keys);

  // Parse result
  let idx = 0;

  const total = values[idx++] ?? 0;
  const imgYes = values[idx++] ?? 0;
  const imgNo = values[idx++] ?? 0;
  const latSum = values[idx++] ?? 0;
  const latCount = values[idx++] ?? 0;

  const byProvider: Record<string, number> = {};
  for (const k of providerKeys) {
    const name = k.replace(`${KEY_PREFIX}:by_provider:`, "");
    byProvider[name] = (values[idx++] ?? 0) as number;
  }

  const fallbackReasons: Record<string, number> = {};
  for (const k of fallbackKeys) {
    const name = k.replace(`${KEY_PREFIX}:fallback:`, "");
    fallbackReasons[name] = (values[idx++] ?? 0) as number;
  }

  const errorClasses: Record<string, number> = {};
  for (const k of errorKeys) {
    const name = k.replace(`${KEY_PREFIX}:error:`, "");
    errorClasses[name] = (values[idx++] ?? 0) as number;
  }

  const garmentSources: Record<string, number> = {};
  for (const k of sourceKeys) {
    const name = k.replace(`${KEY_PREFIX}:source:`, "");
    garmentSources[name] = (values[idx++] ?? 0) as number;
  }

  const garmentCategories: Record<string, number> = {};
  for (const k of categoryKeys) {
    const name = k.replace(`${KEY_PREFIX}:category:`, "");
    garmentCategories[name] = (values[idx++] ?? 0) as number;
  }

  // Daily time-series (remaining values)
  const last7Days: { date: string; total: number }[] = [];
  for (const date of dates) {
    last7Days.push({
      date,
      total: (values[idx++] ?? 0) as number,
    });
  }

  return {
    total,
    byProvider,
    imageConditioned: { yes: imgYes as number, no: imgNo as number },
    fallbackReasons,
    errorClasses,
    avgLatencyMs: latCount > 0 ? (latSum as number) / (latCount as number) : null,
    garmentSources,
    garmentCategories,
    last7Days,
  };
}
