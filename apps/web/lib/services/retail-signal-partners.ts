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
const AIML_API_BASE_URL = process.env.AIML_API_BASE_URL || "https://api.aimlapi.com/v1";
const AIML_API_MODEL = process.env.AIML_API_MODEL || "gpt-4o-mini";

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

function fallbackMerchantBrief(snapshot: RetailSignalSnapshot, memory: RetailSignalMemory) {
  const summary = buildSignalSummary(snapshot);
  const topProduct = snapshot.products[0];
  const priceContext = summary.priceRange ? ` The comparable price range is ${summary.priceRange}.` : "";
  const productContext = topProduct
    ? ` Top comparable product: ${topProduct.name} from ${topProduct.source}.`
    : "";

  return {
    title: `Merchant brief for ${snapshot.query}`,
    summary: `${summary.gapCount || "No"} product gap signal${summary.gapCount === 1 ? "" : "s"} found for ${snapshot.query}.${priceContext}${productContext}`,
    recommendedCopy: `Feature or source ${snapshot.query} while shopper intent is active.`,
    urgency: summary.gapCount > 0 || memory.repeatedIntentCount > 1 ? "high" : "medium",
  };
}

function parseBriefJson(text: string) {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  try {
    return JSON.parse(cleaned) as {
      title?: string;
      summary?: string;
      recommendedCopy?: string;
      urgency?: string;
    };
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
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
  const cogneeBaseUrl = process.env.COGNEE_API_URL;
  const cogneeKey = process.env.COGNEE_API_KEY;
  const cogneeTenantId = process.env.COGNEE_TENANT_ID;

  if (!cogneeBaseUrl || !cogneeKey || !cogneeTenantId) {
    return {
      id: `cognee-ready-${Date.now()}`,
      partner: "cognee",
      label: "Cognee Memory",
      status: "ready",
      summary: "Retail signal memory prepared",
      evidence: `${memory.repeatedIntentCount} intent capture${memory.repeatedIntentCount === 1 ? "" : "s"} for ${snapshot.query}; ${memory.rememberedRetailers.length} retailer memories ready for Cognee. Set COGNEE_API_URL, COGNEE_TENANT_ID, and COGNEE_API_KEY to send live memory.`,
      createdAt,
    };
  }

  try {
    const response = await fetch(`${cogneeBaseUrl.replace(/\/$/, "")}/api/v1/add`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": cogneeKey,
        "X-Tenant-Id": cogneeTenantId,
      },
      body: JSON.stringify({
        dataset_name: "onpoint_retail_signals",
        data: JSON.stringify({
          source: "onpoint-market-intelligence",
          type: "retail_signal_memory",
          query: snapshot.query,
          products: snapshot.products,
          signals: snapshot.signals,
          memory,
          summary,
          createdAt: snapshot.createdAt,
        }),
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
  const triggerwareBaseUrl = process.env.TRIGGERWARE_API_URL || "https://api.triggerware.com";
  const triggerKey = process.env.TRIGGERWARE_API_KEY;
  const triggerName = process.env.TRIGGERWARE_TRIGGER_NAME || "onpoint_retail_product_gap";
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

  if (!triggerKey) {
    return {
      id: `triggerware-ready-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: "ready",
      summary: "Merchandising workflow queued",
      evidence: `${eventName} prepared with ${summary.gapCount} product gap signal${summary.gapCount === 1 ? "" : "s"} and ${summary.retailerCount} retailer reference${summary.retailerCount === 1 ? "" : "s"}. Set TRIGGERWARE_API_KEY to verify the TriggerWare trigger registry.`,
      createdAt,
    };
  }

  try {
    const response = await fetch(`${triggerwareBaseUrl.replace(/\/$/, "")}/triggers`, {
      method: "GET",
      headers: {
        "Api-Key": triggerKey,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      throw new Error(`TriggerWare returned ${response.status}`);
    }

    const triggers = await response.json().catch(() => []) as Array<{
      name?: string;
      status?: string;
      schedule?: number;
      query?: string;
    }>;
    const matchingTrigger = Array.isArray(triggers)
      ? triggers.find((trigger) => trigger.name === triggerName)
      : undefined;

    if (!matchingTrigger) {
      return {
        id: `triggerware-ready-${Date.now()}`,
        partner: "triggerware",
        label: "TriggerWare Workflow",
        status: "ready",
        summary: "TriggerWare is connected",
        evidence: `${eventName} is prepared for ${snapshot.query}. TriggerWare API is reachable; create or enable trigger "${triggerName}" to poll merchandising deltas.`,
        createdAt,
      };
    }

    return {
      id: `triggerware-sent-${Date.now()}`,
      partner: "triggerware",
      label: "TriggerWare Workflow",
      status: matchingTrigger.status === "disabled" ? "ready" : "sent",
      summary: matchingTrigger.status === "disabled"
        ? "TriggerWare workflow is configured but disabled"
        : "TriggerWare workflow is configured",
      evidence: `${eventName} prepared with ${snapshot.signals.length} live web signals. Trigger "${triggerName}" is ${matchingTrigger.status || "available"}${matchingTrigger.schedule ? ` on a ${matchingTrigger.schedule}s schedule` : ""}.`,
      externalId: matchingTrigger.name,
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

async function generateAimlMerchantBrief(
  snapshot: RetailSignalSnapshot,
  memory: RetailSignalMemory,
): Promise<MarketPartnerIntegration> {
  const createdAt = new Date().toISOString();
  const apiKey = process.env.AIML_API_KEY || process.env.AIMLAPI_API_KEY;
  const fallbackBrief = fallbackMerchantBrief(snapshot, memory);

  if (!apiKey) {
    return {
      id: `aimlapi-ready-${Date.now()}`,
      partner: "aimlapi",
      label: "AI/ML API Brief",
      status: "ready",
      summary: "Merchant intelligence brief prepared",
      evidence: `${fallbackBrief.summary} Add AIML_API_KEY to generate the brief through AI/ML API.`,
      createdAt,
    };
  }

  const prompt = `Return only valid JSON for a retail merchant brief.

Schema:
{
  "title": "short title",
  "summary": "2 sentence business summary",
  "recommendedCopy": "one concise curator or campaign action",
  "urgency": "low|medium|high"
}

Shopper intent: ${snapshot.query}
Memory: ${JSON.stringify(memory)}
Products: ${JSON.stringify(snapshot.products.slice(0, 4))}
Signals: ${JSON.stringify(snapshot.signals.slice(0, 8))}

Focus on GTM value: demand, gap, price positioning, competitor availability, and the next merchant action.`;

  try {
    const response = await fetch(`${AIML_API_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AIML_API_MODEL,
        messages: [
          {
            role: "system",
            content: "You transform live retail web evidence into concise, action-oriented GTM intelligence.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 350,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`AI/ML API returned ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "";
    const parsed = parseBriefJson(content) || fallbackBrief;

    return {
      id: `aimlapi-sent-${Date.now()}`,
      partner: "aimlapi",
      label: "AI/ML API Brief",
      status: "sent",
      summary: parsed.title || fallbackBrief.title,
      evidence: [
        parsed.summary || fallbackBrief.summary,
        parsed.recommendedCopy ? `Action: ${parsed.recommendedCopy}` : null,
        parsed.urgency ? `Urgency: ${parsed.urgency}` : null,
      ].filter(Boolean).join(" "),
      externalId: data.id,
      createdAt,
    };
  } catch (error) {
    logger.warn("AI/ML API merchant brief failed", { component: "market-intel" }, error);
    return {
      id: `aimlapi-failed-${Date.now()}`,
      partner: "aimlapi",
      label: "AI/ML API Brief",
      status: "failed",
      summary: "Merchant brief fallback used",
      evidence: `${fallbackBrief.summary} ${error instanceof Error ? error.message : "Unknown AI/ML API error"}`,
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
    generateAimlMerchantBrief(snapshot, memory),
    sendCogneeMemory(snapshot, memory),
    triggerMerchandisingWorkflow(snapshot),
  ]);

  return { partnerIntegrations, memory };
}
