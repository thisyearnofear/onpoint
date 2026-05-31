/**
 * Curator Funnel Analytics Store — aggregates funnel metrics in Upstash Redis.
 *
 * Follows the same pattern as analytics-store.ts (provider outcome aggregation).
 * Tracks the full curator funnel: page views → try-ons → buy clicks → shares →
 * share visits → leads → purchases, with cross-curator attribution.
 *
 * All writes are best-effort: failures are logged but never thrown.
 */

const KEY_PREFIX = "curator:analytics";
const KEY_SEP = ":";

// ── Redis helpers ──

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function redisPipeline(commands: string[][]): Promise<void> {
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
      body: JSON.stringify(commands),
    });
  } catch {
    // Best-effort
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

async function redisScanKeys(pattern: string): Promise<string[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return [];

  try {
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

// ── Aggregation helpers ──

function k(...parts: string[]): string {
  return [KEY_PREFIX, ...parts].join(KEY_SEP);
}

/**
 * Increment a single curator funnel counter + daily time-series.
 */
async function incrementFunnelMetric(
  curatorSlug: string,
  metric: string,
  extraKeys: string[][] = [],
): Promise<void> {
  const today = todayStr();
  const cmds: string[][] = [
    ["INCR", k("total", curatorSlug)],
    ["INCR", k(metric, curatorSlug)],
    ["INCR", k("daily", today, curatorSlug, metric)],
    ...extraKeys,
  ];
  await redisPipeline(cmds);
}

// ── Public API ──

/**
 * Record a curator page view.
 */
export async function recordCuratorPageView(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "page_views");
}

/**
 * Record a try-on initiation from a curator storefront.
 */
export async function recordCuratorTryOn(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "try_ons");
}

/**
 * Record a buy button click on a curator storefront.
 */
export async function recordCuratorBuyClick(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "buy_clicks");
}

/**
 * Record a share action with optional attribution curator.
 */
export async function recordCuratorShare(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "shares");
}

/**
 * Record a visit from a shared link (referral).
 * shareSourceSlug is the curator whose link was shared.
 */
export async function recordCuratorShareVisit(
  shareSourceSlug: string,
  visitorCuratorSlug?: string,
): Promise<void> {
  const cmds: string[][] = [
    ["INCR", k("share_visits", shareSourceSlug)],
    ["INCR", k("daily", todayStr(), shareSourceSlug, "share_visits")],
  ];
  if (visitorCuratorSlug && visitorCuratorSlug !== shareSourceSlug) {
    // Cross-curator share visit
    cmds.push(["INCR", k("cross_share_visits", shareSourceSlug, visitorCuratorSlug)]);
  }
  await redisPipeline(cmds);
}

/**
 * Record a lead generated for a curator.
 */
export async function recordCuratorLead(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "leads");
}

/**
 * Record a completed purchase/payment for a curator.
 * If attributedCuratorSlug is different from curatorSlug,
 * this counts as a cross-curator attributed purchase.
 */
export async function recordCuratorPurchase(
  curatorSlug: string,
  attributedCuratorSlug?: string,
): Promise<void> {
  const today = todayStr();
  const cmds: string[][] = [
    ["INCR", k("total", curatorSlug)],
    ["INCR", k("purchases", curatorSlug)],
    ["INCR", k("daily", today, curatorSlug, "purchases")],
    ["INCR", k("daily", today, curatorSlug, "page_views")], // keep page_views daily aligned
  ];
  if (attributedCuratorSlug && attributedCuratorSlug !== curatorSlug) {
    cmds.push(["INCR", k("cross_attr_purchases", attributedCuratorSlug, curatorSlug)]);
  }
  await redisPipeline(cmds);
}

/**
 * Record high-intent listing view.
 */
export async function recordCuratorHighIntentView(
  curatorSlug: string,
): Promise<void> {
  await incrementFunnelMetric(curatorSlug, "high_intent_views");
}

// ── Report types ──

export interface CuratorAnalyticsReport {
  slug: string;
  pageViews: number;
  tryOns: number;
  buyClicks: number;
  shares: number;
  shareVisits: number;
  leads: number;
  purchases: number;
  highIntentViews: number;
  conversionRates: {
    tryOnToPurchase: string;  // percentage as string
    viewToTryOn: string;
    buyClickToPurchase: string;
    shareToVisit: string;
    visitToPurchase: string;
  };
  crossCuratorAttributions: Record<string, number>; // other curator slug → count
  crossShareVisits: Record<string, number>;
  last7Days: { date: string; pageViews: number; tryOns: number; purchases: number }[];
}

export interface CuratorFunnelOverview {
  totalCurators: number;
  totalPageViews: number;
  totalTryOns: number;
  totalShares: number;
  totalShareVisits: number;
  totalLeads: number;
  totalPurchases: number;
  topCurators: Array<{ slug: string; name: string; pageViews: number; purchases: number }>;
  last7Days: { date: string; totalViews: number; totalPurchases: number }[];
}

// ── Report builders ──

/**
 * Fetch the analytics report for a single curator.
 */
export async function getCuratorAnalytics(
  curatorSlug: string,
  curatorName?: string,
): Promise<CuratorAnalyticsReport | null> {
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

  // Scan for cross-curator attribution keys
  const [crossAttrKeys, crossShareKeys] = await Promise.all([
    redisScanKeys(k("cross_attr_purchases", curatorSlug, "*")),
    redisScanKeys(k("cross_share_visits", curatorSlug, "*")),
  ]);

  const metricKeys = [
    k("page_views", curatorSlug),
    k("try_ons", curatorSlug),
    k("buy_clicks", curatorSlug),
    k("shares", curatorSlug),
    k("share_visits", curatorSlug),
    k("leads", curatorSlug),
    k("purchases", curatorSlug),
    k("high_intent_views", curatorSlug),
    ...crossAttrKeys,
    ...crossShareKeys,
    ...dates.flatMap((d) => [
      k("daily", d, curatorSlug, "page_views"),
      k("daily", d, curatorSlug, "try_ons"),
      k("daily", d, curatorSlug, "purchases"),
    ]),
  ];

  const values = await redisBatchGet(metricKeys);

  let idx = 0;
  const pageViews = (values[idx++] ?? 0) as number;
  const tryOns = (values[idx++] ?? 0) as number;
  const buyClicks = (values[idx++] ?? 0) as number;
  const shares = (values[idx++] ?? 0) as number;
  const shareVisits = (values[idx++] ?? 0) as number;
  const leads = (values[idx++] ?? 0) as number;
  const purchases = (values[idx++] ?? 0) as number;
  const highIntentViews = (values[idx++] ?? 0) as number;

  // Parse cross-curator attributions
  const crossCuratorAttributions: Record<string, number> = {};
  for (const key of crossAttrKeys) {
    const otherSlug = key.replace(k("cross_attr_purchases", curatorSlug), "").replace(/^:/, "");
    crossCuratorAttributions[otherSlug] = (values[idx++] ?? 0) as number;
  }

  const crossShareVisits: Record<string, number> = {};
  for (const key of crossShareKeys) {
    const otherSlug = key.replace(k("cross_share_visits", curatorSlug), "").replace(/^:/, "");
    crossShareVisits[otherSlug] = (values[idx++] ?? 0) as number;
  }

  // Daily time-series
  const last7Days: { date: string; pageViews: number; tryOns: number; purchases: number }[] = [];
  for (const date of dates) {
    last7Days.push({
      date,
      pageViews: (values[idx++] ?? 0) as number,
      tryOns: (values[idx++] ?? 0) as number,
      purchases: (values[idx++] ?? 0) as number,
    });
  }

  // Conversion rates
  const pct = (num: number, denom: number): string => {
    if (denom === 0) return "0%";
    return `${Math.round((num / denom) * 100)}%`;
  };

  return {
    slug: curatorSlug,
    pageViews,
    tryOns,
    buyClicks,
    shares,
    shareVisits,
    leads,
    purchases,
    highIntentViews,
    conversionRates: {
      tryOnToPurchase: pct(purchases, tryOns),
      viewToTryOn: pct(tryOns, pageViews),
      buyClickToPurchase: pct(purchases, buyClicks),
      shareToVisit: pct(shareVisits, shares),
      visitToPurchase: pct(purchases, pageViews),
    },
    crossCuratorAttributions,
    crossShareVisits,
    last7Days,
  };
}

/**
 * Fetch the overview report across all curators.
 */
export async function getCuratorFunnelOverview(): Promise<CuratorFunnelOverview | null> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return null;

  // Scan for all curator slugs with analytics data
  const totalKeys = await redisScanKeys(k("total", "*"));
  const slugs = totalKeys.map((key) => key.replace(k("total"), "").replace(/^:/, ""));

  if (slugs.length === 0) {
    return {
      totalCurators: 0,
      totalPageViews: 0,
      totalTryOns: 0,
      totalShares: 0,
      totalShareVisits: 0,
      totalLeads: 0,
      totalPurchases: 0,
      topCurators: [],
      last7Days: [],
    };
  }

  // Batch read total metrics for all curators
  const metricKeys = slugs.flatMap((slug) => [
    k("page_views", slug),
    k("try_ons", slug),
    k("shares", slug),
    k("share_visits", slug),
    k("leads", slug),
    k("purchases", slug),
  ]);

  const values = await redisBatchGet(metricKeys);

  // Parse results per curator
  let totalPageViews = 0;
  let totalTryOns = 0;
  let totalShares = 0;
  let totalShareVisits = 0;
  let totalLeads = 0;
  let totalPurchases = 0;

  const curatorStats: Array<{
    slug: string;
    pageViews: number;
    purchases: number;
  }> = [];

  let vIdx = 0;
  for (const slug of slugs) {
    const pv = (values[vIdx++] ?? 0) as number;
    const to = (values[vIdx++] ?? 0) as number;
    const sh = (values[vIdx++] ?? 0) as number;
    const sv = (values[vIdx++] ?? 0) as number;
    const ld = (values[vIdx++] ?? 0) as number;
    const pu = (values[vIdx++] ?? 0) as number;

    totalPageViews += pv;
    totalTryOns += to;
    totalShares += sh;
    totalShareVisits += sv;
    totalLeads += ld;
    totalPurchases += pu;

    curatorStats.push({ slug, pageViews: pv, purchases: pu });
  }

  // Top curators by page views
  const topCurators = curatorStats
    .sort((a, b) => b.pageViews - a.pageViews)
    .slice(0, 10)
    .map((c) => ({ slug: c.slug, name: c.slug, pageViews: c.pageViews, purchases: c.purchases }));

  // Last 7 days aggregation
  const today = todayStr();
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
    );
  }

  const dailyKeys = dates.flatMap((d) =>
    slugs.flatMap((slug) => [
      k("daily", d, slug, "page_views"),
      k("daily", d, slug, "purchases"),
    ]),
  );

  const dailyValues = await redisBatchGet(dailyKeys);

  const last7Days = dates.map((date, di) => {
    let totalViews = 0;
    let totalPurchasesInDay = 0;
    for (let si = 0; si < slugs.length; si++) {
      const baseIdx = di * slugs.length * 2 + si * 2;
      totalViews += (dailyValues[baseIdx] ?? 0) as number;
      totalPurchasesInDay += (dailyValues[baseIdx + 1] ?? 0) as number;
    }
    return { date, totalViews, totalPurchases: totalPurchasesInDay };
  });

  return {
    totalCurators: slugs.length,
    totalPageViews,
    totalTryOns,
    totalShares,
    totalShareVisits,
    totalLeads,
    totalPurchases,
    topCurators,
    last7Days,
  };
}
