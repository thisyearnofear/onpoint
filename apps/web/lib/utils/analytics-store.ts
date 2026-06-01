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
// ══════════════════════════════════════════════════════════════════════════
// Deep-link persona funnel
// ══════════════════════════════════════════════════════════════════════════

const DL_PREFIX = "analytics:deep_link_personas";

export async function recordDeepLinkPersonaSelected(props: {
  persona: string;
  curatorSlug?: string;
  listingId?: string;
}): Promise<void> {
  const today = todayStr();
  const persona = props.persona || "unknown";
  const curator = props.curatorSlug || "unknown";

  const cmds: string[][] = [
    ["INCR", `${DL_PREFIX}:total_selected`],
    ["INCR", `${DL_PREFIX}:by_persona:${persona}`],
    ["INCR", `${DL_PREFIX}:by_curator:${curator}`],
    ["INCR", `${DL_PREFIX}:by_persona_curator:${persona}:${curator}`],
    ["INCR", `${DL_PREFIX}:daily:${today}:selected`],
    ["INCR", `${DL_PREFIX}:daily:${today}:by_persona:${persona}`],
  ];

  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return;

  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
  } catch {
    // Best-effort
  }
}

export async function recordDeepLinkPersonaOutcome(props: {
  persona: string;
  curatorSlug?: string;
  completed: boolean;
  durationMs?: number;
}): Promise<void> {
  const today = todayStr();
  const persona = props.persona || "unknown";
  const curator = props.curatorSlug || "unknown";
  const completedKey = props.completed ? "completed" : "abandoned";

  const cmds: string[][] = [
    ["INCR", `${DL_PREFIX}:total_outcomes`],
    ["INCR", `${DL_PREFIX}:outcomes:${completedKey}`],
    ["INCR", `${DL_PREFIX}:outcomes_by_persona:${persona}:${completedKey}`],
    ["INCR", `${DL_PREFIX}:daily:${today}:outcomes`],
    ["INCR", `${DL_PREFIX}:daily:${today}:outcomes_by_persona:${persona}:${completedKey}`],
  ];

  if (typeof props.durationMs === "number") {
    cmds.push(["INCRBY", `${DL_PREFIX}:duration_sum`, String(Math.round(props.durationMs))]);
    cmds.push(["INCR", `${DL_PREFIX}:duration_count`]);
  }

  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return;

  try {
    await fetch(`${url}/pipeline`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(cmds),
    });
  } catch {
    // Best-effort
  }
}

export interface DeepLinkPersonaReport {
  totalSelected: number;
  totalOutcomes: number;
  totalCompleted: number;
  totalAbandoned: number;
  completionRate: string;
  avgDurationMs: number | null;
  byPersona: Record<string, {
    selected: number;
    completed: number;
    abandoned: number;
    completionRate: string;
    daily: { date: string; selected: number; completed: number }[];
  }>;
  byCurator: Record<string, number>;
  last7Days: { date: string; selected: number; completed: number }[];
}

export async function getDeepLinkPersonaReport(): Promise<DeepLinkPersonaReport | null> {
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
  const [personaKeys, curatorKeys, personaOutcomeKeys] = await Promise.all([
    redisScanKeys(`${DL_PREFIX}:by_persona:*`),
    redisScanKeys(`${DL_PREFIX}:by_curator:*`),
    redisScanKeys(`${DL_PREFIX}:outcomes_by_persona:*`),
  ]);

  // Extract persona names for daily per-persona queries
  const personaNames = personaKeys.map((k) => k.replace(`${DL_PREFIX}:by_persona:`, ""));

  const keys = [
    `${DL_PREFIX}:total_selected`,
    `${DL_PREFIX}:total_outcomes`,
    `${DL_PREFIX}:outcomes:completed`,
    `${DL_PREFIX}:outcomes:abandoned`,
    `${DL_PREFIX}:duration_sum`,
    `${DL_PREFIX}:duration_count`,
    ...personaKeys,
    ...curatorKeys,
    ...personaOutcomeKeys,
    ...dates.flatMap((d) => [
      `${DL_PREFIX}:daily:${d}:selected`,
      `${DL_PREFIX}:daily:${d}:outcomes`,
      // Per-persona daily selected + completed
      ...personaNames.flatMap((p) => [
        `${DL_PREFIX}:daily:${d}:by_persona:${p}`,
        `${DL_PREFIX}:daily:${d}:outcomes_by_persona:${p}:completed`,
      ]),
    ]),
  ];

  const values = await redisBatchGet(keys);
  let idx = 0;

  const totalSelected = (values[idx++] ?? 0) as number;
  const totalOutcomes = (values[idx++] ?? 0) as number;
  const totalCompleted = (values[idx++] ?? 0) as number;
  const totalAbandoned = (values[idx++] ?? 0) as number;
  const durationSum = (values[idx++] ?? 0) as number;
  const durationCount = (values[idx++] ?? 0) as number;

  const byPersona: Record<string, { selected: number; completed: number; abandoned: number; completionRate: string; daily: { date: string; selected: number; completed: number }[] }> = {};
  for (const k of personaKeys) {
    const name = k.replace(`${DL_PREFIX}:by_persona:`, "");
    byPersona[name] = { selected: (values[idx++] ?? 0) as number, completed: 0, abandoned: 0, completionRate: "0%", daily: [] };
  }

  const byCurator: Record<string, number> = {};
  for (const k of curatorKeys) {
    const name = k.replace(`${DL_PREFIX}:by_curator:`, "");
    byCurator[name] = (values[idx++] ?? 0) as number;
  }

  for (const k of personaOutcomeKeys) {
    // e.g. outcomes_by_persona:miranda:completed
    const rest = k.replace(`${DL_PREFIX}:outcomes_by_persona:`, "");
    const lastColon = rest.lastIndexOf(":");
    const persona = rest.slice(0, lastColon);
    const outcome = rest.slice(lastColon + 1);
    if (!byPersona[persona]) {
      byPersona[persona] = { selected: 0, completed: 0, abandoned: 0, completionRate: "0%", daily: [] };
    }
    byPersona[persona][outcome as "completed" | "abandoned"] = (values[idx++] ?? 0) as number;
  }

  // Parse per-persona daily data — keys are date-major, so read date-major
  const personaDaily: Record<string, { date: string; selected: number; completed: number }[]> = {};
  for (const p of personaNames) personaDaily[p] = [];
  const last7Days: { date: string; selected: number; completed: number }[] = [];

  for (const date of dates) {
    // Read aggregate daily:selected and daily:outcomes first
    const daySelected = (values[idx++] ?? 0) as number;
    const dayCompleted = (values[idx++] ?? 0) as number;
    last7Days.push({ date, selected: daySelected, completed: dayCompleted });
    // Then per-persona daily values
    for (const p of personaNames) {
      personaDaily[p]!.push({
        date,
        selected: (values[idx++] ?? 0) as number,
        completed: (values[idx++] ?? 0) as number,
      });
    }
  }
  for (const p of personaNames) {
    if (byPersona[p]) byPersona[p]!.daily = personaDaily[p]!;
  }

  // Compute completion rates
  for (const p of Object.values(byPersona)) {
    const total = p.completed + p.abandoned;
    p.completionRate = total > 0 ? `${Math.round((p.completed / total) * 100)}%` : "—";
  }

  return {
    totalSelected,
    totalOutcomes,
    totalCompleted,
    totalAbandoned,
    completionRate: totalOutcomes > 0 ? `${Math.round((totalCompleted / totalOutcomes) * 100)}%` : "—",
    avgDurationMs: durationCount > 0 ? durationSum / durationCount : null,
    byPersona,
    byCurator,
    last7Days,
  };
}

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
