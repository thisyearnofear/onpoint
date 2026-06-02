/**
 * Market Intelligence — Product Search + Retail Signal Partners
 *
 * Searches external products via the Python bridge and processes
 * retail signals for competitive intelligence (Cognee, TriggerWare, AIML API).
 *
 * Ported from apps/web/app/api/market-intelligence/search/route.ts
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { searchViaBridge } = require('../lib/product-search');
const Redis = require('ioredis');

const MEMORY_TTL_SECONDS = 60 * 60 * 24 * 30;
const AIML_API_BASE_URL = process.env.AIML_API_BASE_URL || 'https://api.aimlapi.com/v1';
const AIML_API_MODEL = process.env.AIML_API_MODEL || 'gpt-4o-mini';

let redis = null;
function getRedis() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  }
  return redis;
}

// ── Retail Signal Helpers ──

function memoryKey(query) {
  const normalized = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `market:intel:memory:${normalized || 'unknown'}`;
}

function uniqueRetailers(products, signals) {
  return [...new Set([
    ...products.map((p) => p.source),
    ...signals.filter((s) => s.type === 'retailer_availability').map((s) => s.source),
  ].map((s) => s?.trim()).filter(Boolean))].slice(0, 8);
}

function buildSignalSummary(snapshot) {
  const gapCount = snapshot.signals.filter((s) => s.type === 'product_gap').length;
  const priceSignal = snapshot.signals.find((s) => s.type === 'competitor_price');
  const action = snapshot.signals.find((s) => s.type === 'recommended_action')?.action;
  return {
    gapCount,
    priceRange: priceSignal?.title?.replace(/^Comparable price range:\s*/i, '') || null,
    retailerCount: uniqueRetailers(snapshot.products, snapshot.signals).length,
    action: action || 'Review shopper intent and comparable products.',
  };
}

function fallbackMerchantBrief(snapshot, memory) {
  const summary = buildSignalSummary(snapshot);
  const topProduct = snapshot.products[0];
  const priceContext = summary.priceRange ? ` The comparable price range is ${summary.priceRange}.` : '';
  const productContext = topProduct ? ` Top comparable product: ${topProduct.name} from ${topProduct.source}.` : '';
  return {
    title: `Merchant brief for ${snapshot.query}`,
    summary: `${summary.gapCount || 'No'} product gap signal${summary.gapCount === 1 ? '' : 's'} found for ${snapshot.query}.${priceContext}${productContext}`,
    recommendedCopy: `Feature or source ${snapshot.query} while shopper intent is active.`,
    urgency: summary.gapCount > 0 || memory.repeatedIntentCount > 1 ? 'high' : 'medium',
  };
}

function parseBriefJson(text) {
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try { return JSON.parse(cleaned); } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start === -1 || end <= start) return null;
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch { return null; }
  }
}

async function updateLocalMemory(snapshot) {
  const r = getRedis();
  const key = memoryKey(snapshot.query);
  let previous = null;
  try {
    const raw = await r.get(key);
    if (raw) previous = JSON.parse(raw);
  } catch { /* ignore */ }

  const retailers = uniqueRetailers(snapshot.products, snapshot.signals);
  const gapCount = snapshot.signals.filter((s) => s.type === 'product_gap').length;

  const memory = {
    query: snapshot.query,
    repeatedIntentCount: (previous?.repeatedIntentCount || 0) + 1,
    knownGapCount: Math.max(previous?.knownGapCount || 0, gapCount),
    rememberedRetailers: [...new Set([...(previous?.rememberedRetailers || []), ...retailers])].slice(0, 8),
    lastSeenAt: snapshot.createdAt,
  };

  await r.set(key, JSON.stringify(memory), 'EX', MEMORY_TTL_SECONDS);
  return memory;
}

async function sendCogneeMemory(snapshot, memory) {
  const createdAt = new Date().toISOString();
  const summary = buildSignalSummary(snapshot);
  const cogneeBaseUrl = process.env.COGNEE_API_URL;
  const cogneeKey = process.env.COGNEE_API_KEY;
  const cogneeTenantId = process.env.COGNEE_TENANT_ID;

  if (!cogneeBaseUrl || !cogneeKey || !cogneeTenantId) {
    return {
      id: `cognee-ready-${Date.now()}`, partner: 'cognee', label: 'Cognee Memory',
      status: 'ready', summary: 'Retail signal memory prepared',
      evidence: `${memory.repeatedIntentCount} intent capture${memory.repeatedIntentCount === 1 ? '' : 's'} for ${snapshot.query}; ${memory.rememberedRetailers.length} retailer memories ready for Cognee.`,
      createdAt,
    };
  }

  try {
    const response = await fetch(`${cogneeBaseUrl.replace(/\/$/, '')}/api/v1/add`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': cogneeKey, 'X-Tenant-Id': cogneeTenantId },
      body: JSON.stringify({
        dataset_name: 'onpoint_retail_signals',
        data: JSON.stringify({ source: 'onpoint-market-intelligence', type: 'retail_signal_memory', query: snapshot.query, products: snapshot.products, signals: snapshot.signals, memory, summary, createdAt: snapshot.createdAt }),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Cognee returned ${response.status}`);
    const data = await response.json().catch(() => ({}));
    return {
      id: `cognee-sent-${Date.now()}`, partner: 'cognee', label: 'Cognee Memory',
      status: 'sent', summary: 'Retail signal stored in agent memory',
      evidence: `${snapshot.signals.length} signals saved with ${memory.rememberedRetailers.length} retailer references.`,
      externalId: data.id || data.memoryId || data.job_id, createdAt,
    };
  } catch (error) {
    logger.warn('Cognee memory write failed', { component: 'market-intel' }, error);
    return {
      id: `cognee-failed-${Date.now()}`, partner: 'cognee', label: 'Cognee Memory',
      status: 'failed', summary: 'Cognee memory write failed',
      evidence: error instanceof Error ? error.message : 'Unknown Cognee error', createdAt,
    };
  }
}

async function triggerMerchandisingWorkflow(snapshot) {
  const createdAt = new Date().toISOString();
  const summary = buildSignalSummary(snapshot);
  const triggerwareBaseUrl = process.env.TRIGGERWARE_API_URL || 'https://api.triggerware.com';
  const triggerKey = process.env.TRIGGERWARE_API_KEY;
  const triggerName = process.env.TRIGGERWARE_TRIGGER_NAME || 'onpoint_retail_product_gap';
  const shouldTrigger = summary.gapCount > 0 || snapshot.signals.some((s) => s.type === 'recommended_action');

  if (!shouldTrigger) {
    return {
      id: `triggerware-skipped-${Date.now()}`, partner: 'triggerware', label: 'TriggerWare Workflow',
      status: 'skipped', summary: 'No merchandising trigger needed',
      evidence: 'No product gap or recommended action was detected for this search.', createdAt,
    };
  }

  if (!triggerKey) {
    return {
      id: `triggerware-ready-${Date.now()}`, partner: 'triggerware', label: 'TriggerWare Workflow',
      status: 'ready', summary: 'Merchandising workflow queued',
      evidence: `retail.product_gap.detected prepared. Set TRIGGERWARE_API_KEY to verify the TriggerWare trigger registry.`, createdAt,
    };
  }

  try {
    const response = await fetch(`${triggerwareBaseUrl.replace(/\/$/, '')}/triggers`, {
      method: 'GET', headers: { 'Api-Key': triggerKey }, signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`TriggerWare returned ${response.status}`);
    const triggers = await response.json().catch(() => []);
    const match = Array.isArray(triggers) ? triggers.find((t) => t.name === triggerName) : undefined;

    if (!match) {
      return {
        id: `triggerware-ready-${Date.now()}`, partner: 'triggerware', label: 'TriggerWare Workflow',
        status: 'ready', summary: 'TriggerWare is connected',
        evidence: `Trigger "${triggerName}" not found in registry.`, createdAt,
      };
    }

    return {
      id: `triggerware-sent-${Date.now()}`, partner: 'triggerware', label: 'TriggerWare Workflow',
      status: match.status === 'disabled' ? 'ready' : 'sent',
      summary: match.status === 'disabled' ? 'TriggerWare workflow is configured but disabled' : 'TriggerWare workflow is configured',
      evidence: `${snapshot.signals.length} live web signals. Trigger "${triggerName}" is ${match.status || 'available'}.`,
      externalId: match.name, createdAt,
    };
  } catch (error) {
    logger.warn('TriggerWare workflow failed', { component: 'market-intel' }, error);
    return {
      id: `triggerware-failed-${Date.now()}`, partner: 'triggerware', label: 'TriggerWare Workflow',
      status: 'failed', summary: 'TriggerWare workflow failed',
      evidence: error instanceof Error ? error.message : 'Unknown TriggerWare error', createdAt,
    };
  }
}

async function generateAimlMerchantBrief(snapshot, memory) {
  const createdAt = new Date().toISOString();
  const apiKey = process.env.AIML_API_KEY || process.env.AIMLAPI_API_KEY;
  const fallbackBrief = fallbackMerchantBrief(snapshot, memory);

  if (!apiKey) {
    return {
      id: `aimlapi-ready-${Date.now()}`, partner: 'aimlapi', label: 'AI/ML API Brief',
      status: 'ready', summary: 'Merchant intelligence brief prepared',
      evidence: `${fallbackBrief.summary} Add AIML_API_KEY to generate the brief through AI/ML API.`, createdAt,
    };
  }

  try {
    const response = await fetch(`${AIML_API_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: AIML_API_MODEL,
        messages: [
          { role: 'system', content: 'You transform live retail web evidence into concise, action-oriented GTM intelligence.' },
          { role: 'user', content: `Return only valid JSON.\n\nSchema: {"title":"short title","summary":"2 sentence business summary","recommendedCopy":"one concise curator or campaign action","urgency":"low|medium|high"}\n\nShopper intent: ${snapshot.query}\nMemory: ${JSON.stringify(memory)}\nProducts: ${JSON.stringify(snapshot.products.slice(0, 4))}\nSignals: ${JSON.stringify(snapshot.signals.slice(0, 8))}` },
        ],
        temperature: 0.2, max_tokens: 350,
      }),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error(`AI/ML API returned ${response.status}`);
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const parsed = parseBriefJson(content) || fallbackBrief;
    return {
      id: `aimlapi-sent-${Date.now()}`, partner: 'aimlapi', label: 'AI/ML API Brief',
      status: 'sent', summary: parsed.title || fallbackBrief.title,
      evidence: [parsed.summary || fallbackBrief.summary, parsed.recommendedCopy ? `Action: ${parsed.recommendedCopy}` : null, parsed.urgency ? `Urgency: ${parsed.urgency}` : null].filter(Boolean).join(' '),
      externalId: data.id, createdAt,
    };
  } catch (error) {
    logger.warn('AI/ML API merchant brief failed', { component: 'market-intel' }, error);
    return {
      id: `aimlapi-failed-${Date.now()}`, partner: 'aimlapi', label: 'AI/ML API Brief',
      status: 'failed', summary: 'Merchant brief fallback used',
      evidence: `${fallbackBrief.summary} ${error instanceof Error ? error.message : 'Unknown error'}`, createdAt,
    };
  }
}

async function processRetailSignalPartners(query, products, signals) {
  const snapshot = { query, products, signals, createdAt: new Date().toISOString() };
  const memory = await updateLocalMemory(snapshot);
  const partnerIntegrations = await Promise.all([
    generateAimlMerchantBrief(snapshot, memory),
    sendCogneeMemory(snapshot, memory),
    triggerMerchandisingWorkflow(snapshot),
  ]);
  return { partnerIntegrations, memory };
}

// ── Route ──

router.post('/', async (req, res) => {
  try {
    const { query, limit = 4 } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length < 2) {
      return res.status(400).json({ error: 'Query parameter required (min 2 chars)' });
    }

    const safeLimit = Math.min(Math.max(parseInt(limit) || 4, 1), 8);

    // Search via bridge
    const bridgeResult = await searchViaBridge(query.trim(), safeLimit);

    const products = bridgeResult?.items || [];
    const signals = bridgeResult?.signals || [];

    // Process retail signal partners
    const partnerResult = await processRetailSignalPartners(query, products, signals);

    res.json({
      query,
      products,
      signals,
      source: bridgeResult ? 'bridge' : 'none',
      ...partnerResult,
    });
  } catch (error) {
    logger.error('Market intelligence search error', { component: 'market-intel' }, error);
    res.status(500).json({ error: 'Market intelligence search failed' });
  }
});

module.exports = router;
