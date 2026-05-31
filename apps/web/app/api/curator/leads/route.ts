import { NextRequest, NextResponse } from "next/server";
import { logger } from "../../../../lib/utils/logger";

export { OPTIONS } from "../../ai/_utils/http";

const LEAD_PREFIX = "curator:leads";
const MAX_RECENT_LEADS = 200;

type CuratorLeadPayload = {
  curatorSlug?: string;
  listingId?: string | null;
  styleProfile?: string | null;
  selectedItem?: string | null;
  source?: "try-on-result" | "market-intel" | "storefront" | string;
  marketIntent?: string | null;
  action?: string | null;
};

function getRedisUrl(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_URL;
}

function getRedisToken(): string | undefined {
  return process.env.UPSTASH_REDIS_REST_TOKEN;
}

function getServiceKey(): string | undefined {
  return process.env.SERVICE_API_KEY;
}

function cleanText(value: unknown, max = 240): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (!clean) return null;
  return clean.slice(0, max);
}

function cleanSlug(value: unknown): string | null {
  const clean = cleanText(value, 64)?.toLowerCase() || null;
  if (!clean || !/^[a-z0-9-]{2,64}$/.test(clean)) return null;
  return clean;
}

async function persistLead(lead: Record<string, unknown>): Promise<boolean> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return false;

  const key = `${LEAD_PREFIX}:${lead.curatorSlug}`;
  const recentKey = `${LEAD_PREFIX}:recent`;
  const dailyKey = `${LEAD_PREFIX}:daily:${new Date().toISOString().slice(0, 10)}`;
  const serialized = JSON.stringify(lead);

  const commands = [
    ["LPUSH", key, serialized],
    ["LTRIM", key, "0", String(MAX_RECENT_LEADS - 1)],
    ["LPUSH", recentKey, serialized],
    ["LTRIM", recentKey, "0", String(MAX_RECENT_LEADS - 1)],
    ["INCR", `${LEAD_PREFIX}:count:${lead.curatorSlug}`],
    ["INCR", dailyKey],
  ];

  const response = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  return response.ok;
}

async function readLeads(curatorSlug: string): Promise<Record<string, unknown>[]> {
  const url = getRedisUrl();
  const token = getRedisToken();
  if (!url || !token) return [];

  const key = `${LEAD_PREFIX}:${curatorSlug}`;
  const response = await fetch(`${url}/lrange/${key}/0/49`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) return [];

  const data = await response.json();
  const rows = Array.isArray(data?.result) ? data.result : [];
  return rows
    .map((row: unknown) => {
      if (typeof row !== "string") return null;
      try {
        return JSON.parse(row) as Record<string, unknown>;
      } catch {
        return null;
      }
    })
    .filter((row: Record<string, unknown> | null): row is Record<string, unknown> => Boolean(row));
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const serviceKey = getServiceKey();
  const providedKey = request.headers.get("x-service-key");
  if (!serviceKey || providedKey !== serviceKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const curatorSlug = cleanSlug(new URL(request.url).searchParams.get("curatorSlug"));
  if (!curatorSlug) {
    return NextResponse.json(
      { error: "Valid curatorSlug is required" },
      { status: 400 },
    );
  }

  try {
    const leads = await readLeads(curatorSlug);
    return NextResponse.json({ leads, total: leads.length });
  } catch (error) {
    logger.error("Curator lead read error", { component: "curator-leads", curatorSlug }, error);
    return NextResponse.json(
      { error: "Failed to read curator leads" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as CuratorLeadPayload;
    const curatorSlug = cleanSlug(body.curatorSlug);

    if (!curatorSlug) {
      return NextResponse.json(
        { error: "Valid curatorSlug is required" },
        { status: 400 },
      );
    }

    const lead = {
      id: `lead_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      curatorSlug,
      listingId: cleanText(body.listingId, 80),
      styleProfile: cleanText(body.styleProfile),
      selectedItem: cleanText(body.selectedItem),
      source: cleanText(body.source, 80) || "unknown",
      marketIntent: cleanText(body.marketIntent),
      action: cleanText(body.action),
      createdAt: new Date().toISOString(),
    };

    let persisted = false;
    try {
      persisted = await persistLead(lead);
    } catch (error) {
      logger.warn(
        "Curator lead persistence failed",
        { component: "curator-leads", curatorSlug },
        error,
      );
    }

    logger.info("Curator lead captured", {
      component: "curator-leads",
      curatorSlug,
      listingId: lead.listingId,
      source: lead.source,
      persisted,
    });

    return NextResponse.json({ success: true, persisted, lead });
  } catch (error) {
    logger.error("Curator lead capture error", { component: "curator-leads" }, error);
    return NextResponse.json(
      { error: "Failed to capture curator lead" },
      { status: 500 },
    );
  }
}
