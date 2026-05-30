import type {
  ExternalProduct,
  MarketPartnerIntegration,
  MarketSignal,
  RetailSignalMemory,
} from "@onpoint/shared-types";
import { logger } from "../utils/logger";
import { redisGet, redisSetEx } from "../utils/redis-helpers";

interface RetailSignalSnapshot {
  query: string;
  products: ExternalProduct[];
  signals: MarketSignal[];
  createdAt: string;
}

interface StoredRetailMemory {
  query: string;
  repeatedIntentCount: number;
  knownGapCount: number;
  rememberedRetailers: string[];
  lastSeenAt: string;
}

interface PartnerResult {
  partnerIntegrations: MarketPartnerIntegration[];
  memory: RetailSignalMemory;
}

const MEMORY_TTL_SECONDS = 60 * 60 * 24 * 30;

function memoryKey(query: string) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `market:intel:memory:${normalized || "unknown"}`;
}

function uniqueRetailers(products: ExternalProduct[], signals: MarketSignal[]) {
  return Array.from(
    new Set(
      [
        ...products.map((product) => product.source),
        ...signals
          .filter((signal) => signal.type === "retailer_availability")
          .map((signal) => signal.source),
      ]
        .map((source) => source?.trim())
        .filter(Boolean),
    ),
  ).slice(0, 8) as string[];
}

function buildSignalSummary(snapshot: RetailSignalSnapshot) {
  const gapCount = snapshot.signals.filter((signal) => signal.type === "product_gap").length;
  const priceSignal = snapshot.signals.find((signal) => signal.type === "competitor_price");
  const action = snapshot.signals.find((signal) => signal.type === "recommended_action")?.action;

  return {
    gapCount,
    priceRange: priceSignal?.title.replace(/^Comparable price range:\s*/i, "") || null,
    retailerCount: uniqueRetailers(snapshot.products, snapshot.signals).length,
    action: action || "Review shopper intent and comparable products.",
  };
}

async function updateLocalMemory(snapshot: RetailSignalSnapshot): Promise<RetailSignalMemory> {
  const key = memoryKey(snapshot.query);
  const previous = await redisGet<StoredRetailMemory>(key);
  const retailers = uniqueRetailers(snapshot.products, snapshot.signals);
  const gapCount = snapshot.signals.filter((signal) => signal.type === "product_gap").length;

  const memory: StoredRetailMemory = {
    query: snapshot.query,
    repeatedIntentCount: (previous?.repeatedIntentCount || 0) + 1,
    knownGapCount: Math.max(previous?.knownGapCount || 0, gapCount),
    rememberedRetailers: Array.from(
      new Set([...(previous?.rememberedRetailers || []), ...retailers]),
    ).slice(0, 8),
    lastSeenAt: snapshot.createdAt,
  };

  await redisSetEx(key, memory, MEMORY_TTL_SECONDS);
  return memory;
}

async function sendCogneeMemory(
  snapshot: RetailSignalSnapshot,
  memory: RetailSignalMemory,
): Promise<MarketPartnerIntegration> {
  const createdAt = new Date().toISOString();
  const summary = buildSignalSummary(snapshot);
  const cogneeUrl = process.env.COGNEE_INGEST_URL || process.env.COGNEE_API_URL;
  const cogneeKey = process.env.COGNEE_API_KEY;

  if (!cogneeUrl || !cogneeKey) {
    return {
      id: `cognee-ready-${Date.now()}`,
      partner: "cognee",
      label: "Cognee Memory",
      status: "ready",
      summary: "Retail signal memory prepared",
      evidence: `${memory.repeatedIntentCount} intent capture${memory.repeatedIntentCount === 1 ? "" : "s"} for ${snapshot.query}; ${memory.rememberedRetailers.length} retailer memories ready for Cognee.`,
      createdAt,
    };
  }

  try {
    const response = await fetch(cogneeUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cogneeKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        source: "onpoint-market-intelligence",
        type: "retail_signal_memory",
        query: snapshot.query,
        products: snapshot.products,
        signals: snapshot.signals,
        memory,
        summary,
        createdAt: snapshot.createdAt,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`Cognee returned ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    return {
      id: `cognee-sent-${Date.now()}`,
      partner: "cognee",
      label: "Cognee Memory",
      status: "sent",
      summary: "Retail signal stored in agent memory",
      evidence: `${snapshot.signals.length} signals saved with ${memory.rememberedRetailers.length} retailer references.`,
      externalId: data.id || data.memoryId || data.job_id,
      createdAt,
    };
  } catch (error) {
    logger.warn("Cognee memory write failed", { component: "market-intel" }, error);
    return {
      id: `cognee-failed-${Date.now()}`,
      partner: "cognee",
      label: "Cognee Memory",
      status: "failed",
      summary: "Cognee memory write failed",
      evidence: error instanceof Error ? error.message : "Unknown Cognee error",
      createdAt,
    };
  }
}

async function triggerMerchandisingWorkflow(
  snapshot: RetailSignalSnapshot,
): Promise<MarketPartnerIntegration> {
  const createdAt = new Date().toISOString();
  const summary = buildSignalSummary(snapshot);
  const triggerUrl = process.env.TRIGGERWARE_WEBHOOK_URL || process.env.TRIGGERWARE_API_URL;
  const triggerKey = process.env.TRIGGERWARE_API_KEY;
  const eventName = "retail.product_gap.detected";
  const shouldTrigger = summary.gapCount > 0 || snapshot.signals.some(
    (signal) => signal.type === "recommended_action",
  );

  if (!shouldTrigger) {
    return {
      id: `triggerware-skipped-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: "skipped",
      summary: "No merchandising trigger needed",
      evidence: "No product gap or recommended action was detected for this search.",
      createdAt,
    };
  }

  const payload = {
    event: eventName,
    source: "onpoint-market-intelligence",
    query: snapshot.query,
    summary,
    products: snapshot.products.slice(0, 4),
    signals: snapshot.signals,
    createdAt: snapshot.createdAt,
  };

  if (!triggerUrl || !triggerKey) {
    return {
      id: `triggerware-ready-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: "ready",
      summary: "Merchandising workflow queued",
      evidence: `${eventName} prepared with ${summary.gapCount} product gap signal${summary.gapCount === 1 ? "" : "s"} and ${summary.retailerCount} retailer reference${summary.retailerCount === 1 ? "" : "s"}.`,
      createdAt,
    };
  }

  try {
    const response = await fetch(triggerUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${triggerKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`TriggerWare returned ${response.status}`);
    }

    const data = await response.json().catch(() => ({}));
    return {
      id: `triggerware-sent-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: "sent",
      summary: "Merchandising workflow triggered",
      evidence: `${eventName} sent with ${snapshot.signals.length} live web signals.`,
      externalId: data.id || data.workflowId || data.event_id,
      createdAt,
    };
  } catch (error) {
    logger.warn("TriggerWare workflow failed", { component: "market-intel" }, error);
    return {
      id: `triggerware-failed-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: "failed",
      summary: "TriggerWare workflow failed",
      evidence: error instanceof Error ? error.message : "Unknown TriggerWare error",
      createdAt,
    };
  }
}

export async function processRetailSignalPartners(
  query: string,
  products: ExternalProduct[],
  signals: MarketSignal[],
): Promise<PartnerResult> {
  const snapshot: RetailSignalSnapshot = {
    query,
    products,
    signals,
    createdAt: new Date().toISOString(),
  };

  const memory = await updateLocalMemory(snapshot);
  const partnerIntegrations = await Promise.all([
    sendCogneeMemory(snapshot, memory),
    triggerMerchandisingWorkflow(snapshot),
  ]);

  return { partnerIntegrations, memory };
}
