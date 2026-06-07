/**
 * Agent Tasks Route — /api/agent/tasks
 *
 * Service-to-service endpoints for the onpoint-worker to execute
 * productive background tasks (Tier 1 + Tier 2).
 *
 * Auth: SERVICE_API_KEY (service-to-service, not user)
 * Mounted in server.js with serviceKeyAuth + rate limit.
 *
 * Redis keys:
 *   market:signals:recent        — LIST, capped 200, TTL 24h
 *   market:signals:matched:{uid} — LIST, capped 50,  TTL 7d
 *   market:prices:v2             — HASH, itemKey → JSON price record (Tier 3)
 *   market:drops:v2              — LIST, capped 500, TTL 7d (Tier 3)
 *   market:drops:{uid}           — LIST, capped 50,  TTL 7d (Tier 3)
 */

const express = require('express');
const router = express.Router();
const Redis = require('ioredis');
const agentCore = require('@repo/agent-core');
const logger = require('../lib/logger');

// ── Redis connection (lazy, shares the server's REDIS_URL) ──

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
let redisClient = null;

function getRedis() {
  if (!redisClient) {
    redisClient = new Redis(REDIS_URL);
    redisClient.on('error', (err) => {
      logger.warn('Tasks Redis error', { component: 'tasks' }, err);
    });
  }
  return redisClient;
}

// ── Constants ──

const DEFAULT_AGENT_ID = 'onpoint-stylist';
const DEFAULT_USER_ID = 'system-worker';

// Tier 3: Autonomous commerce — price tracking + drop detection
const PRICE_TRACK_KEY = 'market:prices:v2';                   // Hash: itemKey → { price, lastSeen, ... }
const DROPS_GLOBAL_KEY = 'market:drops:v2';                   // List: capped 500, TTL 7d
const USER_DROPS_PREFIX = 'market:drops:';                     // List: market:drops:{userId}, capped 50, TTL 7d
const PRICE_DROP_THRESHOLD = parseFloat(process.env.PRICE_DROP_THRESHOLD) || 0.10; // >=10%

const ACTIVE_USERS_KEY = 'agent:active-users';
const ACTIVE_USERS_TTL = 60 * 60 * 24 * 7; // 7d

const MARKET_SIGNALS_KEY = 'market:signals:recent';
const MARKET_SIGNALS_MAX = 200;
const MARKET_SIGNALS_TTL = 60 * 60 * 24; // 24h

const MATCHED_KEY_PREFIX = 'market:signals:matched:';
const MATCHED_MAX = 50;
const MATCHED_TTL = 60 * 60 * 24 * 7; // 7d

const TRENDING_QUERIES = [
  'trending fashion items 2026',
  'popular streetwear styles',
  'best selling accessories',
  'sustainable fashion brands',
  'sale luxury fashion',
];

// ── Tier 3: Price Tracking + Drop Detection ──

/**
 * Build a stable item key for price tracking.
 */
function itemKey(name, source, url) {
  return `${name || ''}|${source || ''}|${url || ''}`;
}

/**
 * Update price history for a batch of signals.
 * Returns previous prices so the caller can detect drops.
 */
async function updatePriceHistory(signals) {
  const redis = getRedis();
  if (!signals.length) return [];

  const pipeline = redis.pipeline();
  const prevPrices = [];

  for (const signal of signals) {
    const key = itemKey(signal.name, signal.source, signal.url);
    if (!key) continue;

    // Fetch existing
    const existingRaw = await redis.hget(PRICE_TRACK_KEY, key);
    const now = new Date().toISOString();

    let entry;
    if (existingRaw) {
      try {
        entry = JSON.parse(existingRaw);
        prevPrices.push({ signal, oldPrice: parseFloat(entry.price) });
      } catch {
        prevPrices.push({ signal, oldPrice: null });
      }
    } else {
      prevPrices.push({ signal, oldPrice: null });
    }

    const newEntry = {
      name: signal.name,
      source: signal.source,
      url: signal.url,
      image_url: signal.image_url,
      query: signal.query,
      currency: signal.currency || 'USD',
      price: signal.price,
      oldPrice: entry?.price || null,
      firstSeen: entry?.firstSeen || now,
      lastSeen: now,
      seenCount: (entry?.seenCount || 0) + 1,
    };

    pipeline.hset(PRICE_TRACK_KEY, key, JSON.stringify(newEntry));
  }

  await pipeline.exec();
  return prevPrices;
}

/**
 * Detect significant price drops from updated signals.
 * Returns array of drop objects: { signal, oldPrice, newPrice, dropPercent }
 */
function findPriceDrops(signals, prevPrices) {
  const drops = [];

  for (const { signal, oldPrice } of prevPrices) {
    if (oldPrice === null || oldPrice <= 0) continue;

    const newPrice = parseFloat(signal.price);
    if (newPrice <= 0 || newPrice >= oldPrice) continue;

    const dropPercent = (oldPrice - newPrice) / oldPrice;
    if (dropPercent >= PRICE_DROP_THRESHOLD) {
      drops.push({
        name: signal.name,
        source: signal.source,
        url: signal.url,
        image_url: signal.image_url,
        query: signal.query,
        currency: signal.currency,
        newPrice,
        oldPrice,
        dropPercent: Math.round(dropPercent * 100),
        discoveredAt: new Date().toISOString(),
      });
    }
  }

  return drops;
}

/**
 * Store price drops in Redis (global + per-user lists).
 */
async function storePriceDrops(drops, userIds = []) {
  if (!drops.length) return 0;

  const redis = getRedis();
  const pipeline = redis.pipeline();

  for (const drop of drops) {
    const dropJson = JSON.stringify(drop);
    pipeline.lpush(DROPS_GLOBAL_KEY, dropJson);

    // Per-user drops
    for (const userId of userIds) {
      const userKey = `${USER_DROPS_PREFIX}${userId}`;
      pipeline.lpush(userKey, dropJson);
      pipeline.ltrim(userKey, 0, 49);
      pipeline.expire(userKey, 60 * 60 * 24 * 7);
    }
  }

  pipeline.ltrim(DROPS_GLOBAL_KEY, 0, 499);
  pipeline.expire(DROPS_GLOBAL_KEY, 60 * 60 * 24 * 7);
  await pipeline.exec();

  return drops.length;
}

/**
 * Attempt an autonomous purchase for a matched price drop.
 * Checks budget, creates an external_purchase suggestion, and
 * auto-executes if within the user's autonomy threshold.
 */
async function autoBuy(userId, drop, agentId = DEFAULT_AGENT_ID) {
  try {
    await agentCore.AgentControls.initStore(agentId, userId);

    // Load user's auto-buy preferences
    const prefs = agentCore.AgentControls.getStylePreferences(userId);
    const autoBuyMax = prefs.autoBuyMaxPrice || 0;

    // Check if auto-buy is enabled and within the user's max price threshold
    if (autoBuyMax <= 0) {
      return {
        success: false,
        error: 'Auto-buy disabled for this user',
        skipped: true,
        reason: 'auto_buy_disabled',
      };
    }

    if (drop.newPrice > autoBuyMax) {
      logger.info(`Auto-buy skipped for ${userId}: $${drop.newPrice} > max $${autoBuyMax}`, {
        component: 'tasks',
        userId,
        newPrice: drop.newPrice,
        maxPrice: autoBuyMax,
      });
      return {
        success: false,
        error: `Price $${drop.newPrice} exceeds max auto-buy threshold of $${autoBuyMax}`,
        skipped: true,
        reason: 'price_exceeds_threshold',
        maxPrice: autoBuyMax,
      };
    }

    // Score the drop against user's style preferences for context
    const dropWithPrice = { ...drop, price: drop.newPrice }; // scoreSignal reads signal.price
    const scoreResult = scoreSignal(dropWithPrice, prefs);

    const amount = `$${drop.newPrice}`;
    const description = `Price drop! ${drop.name} — $${drop.oldPrice} → $${drop.newPrice} (${drop.dropPercent}% off)`;

    // Create the suggestion — AgentControls handles autonomy check internally
    const { suggestion, autoExecuted } = agentCore.AgentControls.suggestAction({
      agentId,
      userId,
      actionType: 'external_purchase',
      amount,
      description,
      recipient: userId,
      metadata: {
        source: 'price-drop',
        dropPercent: drop.dropPercent,
        oldPrice: drop.oldPrice,
        newPrice: drop.newPrice,
        productUrl: drop.url,
        productImage: drop.image_url,
        productName: drop.name,
        productSource: drop.source,
        matchScore: scoreResult.score,
        matchReasons: scoreResult.reasons,
        autoBuyMaxPrice: autoBuyMax,
      },
    });

    // Record verifiable receipt if auto-executed
    if (autoExecuted) {
      try {
        await agentCore.recordReceipt({
          action: 'propose_mint_nft',
          sessionId: suggestion.id,
          metadata: {
            type: 'auto_buy_price_drop',
            productName: drop.name,
            productUrl: drop.url,
            oldPrice: drop.oldPrice,
            newPrice: drop.newPrice,
            dropPercent: drop.dropPercent,
            userId,
          },
          chain: 'celo',
          onChain: false,
        });
        logger.info(`Auto-buy executed: ${drop.name} for ${userId}`, {
          component: 'tasks',
          userId,
          suggestionId: suggestion.id,
          dropPercent: drop.dropPercent,
        });
      } catch (receiptErr) {
        logger.warn(`Auto-buy receipt failed for ${userId}`, { component: 'tasks' }, receiptErr);
      }
    }

    return {
      success: true,
      suggestionId: suggestion.id,
      autoExecuted,
      description,
      requiresApproval: !autoExecuted,
    };
  } catch (err) {
    logger.error(`Auto-buy failed for ${userId}`, { component: 'tasks' }, err);
    return { success: false, error: err.message };
  }
}

/**
 * Run the full Tier 3 commerce pipeline for a set of users:
 * 1. Update price history 2. Detect drops 3. Store drops 4. Auto-buy
 */
async function runCommercePipeline(signals, userIds) {
  const startTime = Date.now();

  // Step 1: Update price history, get previous prices
  const prevPrices = await updatePriceHistory(signals);

  // Step 2: Detect drops
  const drops = findPriceDrops(signals, prevPrices);

  if (!drops.length) {
    return { dropsFound: 0, autoBuyResults: [], elapsedMs: Date.now() - startTime };
  }

  logger.info(`Commerce: ${drops.length} price drop(s) detected`, {
    component: 'tasks',
    dropCount: drops.length,
  });

  // Step 3: Store drops globally
  await storePriceDrops(drops, userIds);

  // Step 4: Auto-buy for active users
  const autoBuyResults = [];
  for (const userId of userIds) {
    // Load user's style prefs to see if they'd be interested
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);
    const prefs = agentCore.AgentControls.getStylePreferences(userId);

    for (const drop of drops) {
      const score = scoreSignal(drop, prefs);
      if (!score.matched) continue;

      const result = await autoBuy(userId, drop);
      autoBuyResults.push({ userId, dropName: drop.name, ...result });
    }
  }

  return {
    dropsFound: drops.length,
    drops,
    autoBuyResults,
    elapsedMs: Date.now() - startTime,
  };
}

// ── Helpers ──

/**
 * Normalize a signal's name for matching — lowercase, strip common noise words.
 */
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(the|a|an|for|in|on|with|and|of|by|new|best|top|sale|save|now)\b/g, '')
    .trim();
}

/**
 * Score a signal against a user's style preferences.
 * Returns { matched: boolean, score: number, reasons: string[] }
 */
function scoreSignal(signal, prefs) {
  const reasons = [];
  let score = 0;

  const name = normalize(signal.name);
  const price = parseFloat(signal.price) || 0;

  // Category match — signal name contains any user category
  for (const cat of (prefs.categories || [])) {
    if (name.includes(cat.toLowerCase())) {
      reasons.push(`category:${cat}`);
      score += 30;
      break;
    }
  }

  // Brand match — signal name or source contains any user brand
  const source = normalize(signal.source || '');
  for (const brand of (prefs.brands || [])) {
    const b = brand.toLowerCase();
    if (name.includes(b) || source.includes(b)) {
      reasons.push(`brand:${brand}`);
      score += 40;
      break;
    }
  }

  // Color match — signal name contains any user color
  for (const color of (prefs.colors || [])) {
    if (name.includes(color.toLowerCase())) {
      reasons.push(`color:${color}`);
      score += 15;
      break;
    }
  }

  // Price range match
  const range = prefs.priceRange || { min: 0, max: 500 };
  if (price > 0 && price >= range.min && price <= range.max) {
    reasons.push(`price:$${price}`);
    score += 20;
  }

  // Style aesthetic match
  for (const aesthetic of (prefs.styleAesthetics || [])) {
    if (name.includes(aesthetic.toLowerCase())) {
      reasons.push(`aesthetic:${aesthetic}`);
      score += 25;
      break;
    }
  }

  return {
    matched: score >= 30, // At least a category or brand match
    score,
    reasons,
  };
}

/**
 * Store signals in Redis (capped list with TTL).
 */
async function storeSignals(signals) {
  const redis = getRedis();
  if (!signals.length) return 0;

  try {
    // LPUSH all signals as JSON strings
    const pipeline = redis.pipeline();
    for (const signal of signals) {
      pipeline.lpush(MARKET_SIGNALS_KEY, JSON.stringify(signal));
    }
    pipeline.ltrim(MARKET_SIGNALS_KEY, 0, MARKET_SIGNALS_MAX - 1);
    pipeline.expire(MARKET_SIGNALS_KEY, MARKET_SIGNALS_TTL);
    await pipeline.exec();

    return signals.length;
  } catch (err) {
    logger.error('Failed to store market signals in Redis', { component: 'tasks' }, err);
    return 0;
  }
}

/**
 * Load recent signals from Redis.
 */
async function loadSignals(limit = 50) {
  const redis = getRedis();
  try {
    const raw = await redis.lrange(MARKET_SIGNALS_KEY, 0, limit - 1);
    return raw
      .map((s) => {
        try { return JSON.parse(s); } catch { return null; }
      })
      .filter(Boolean);
  } catch (err) {
    logger.error('Failed to load market signals from Redis', { component: 'tasks' }, err);
    return [];
  }
}

/**
 * Run matching for a single user. Compares recent signals against their
 * style preferences and creates agent suggestions for strong matches.
 */
async function matchForUser(userId) {
  const redis = getRedis();
  const matchedKey = `${MATCHED_KEY_PREFIX}${userId}`;

  try {
    // Load user's style preferences
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);
    const prefs = agentCore.AgentControls.getStylePreferences(userId);

    // Skip if user has no preferences set
    if (!prefs.categories.length && !prefs.brands.length && !prefs.colors.length) {
      return { userId, matched: 0, total: 0, skipped: true, reason: 'no preferences' };
    }

    // Load recent signals
    const signals = await loadSignals(100);

    // Get already-seen signal IDs to avoid duplicates
    const seenIds = new Set();
    const existingRaw = await redis.lrange(matchedKey, 0, -1);
    for (const raw of existingRaw) {
      try {
        const existing = JSON.parse(raw);
        if (existing.signalId) seenIds.add(existing.signalId);
      } catch {}
    }

    const pipeline = redis.pipeline();
    let matched = 0;

    for (const signal of signals) {
      // Generate a stable ID for this signal to avoid duplicate matches
      const signalId = `${signal.query}|${signal.name}|${signal.price}|${signal.url || ''}`;
      if (seenIds.has(signalId)) continue;

      const result = scoreSignal(signal, prefs);
      if (!result.matched) continue;

      // Build a match record
      const match = {
        signalId,
        score: result.score,
        reasons: result.reasons,
        signal,
        matchedAt: new Date().toISOString(),
      };

      pipeline.lpush(matchedKey, JSON.stringify(match));
      seenIds.add(signalId);
      matched++;

      // Create an agent suggestion so it shows up in the user's feed
      try {
        agentCore.AgentControls.suggestAction({
          agentId: DEFAULT_AGENT_ID,
          userId,
          actionType: 'external_search',
          amount: `$${signal.price || 0}`,
          description: `Agent found: ${signal.name} — ${result.reasons.join(', ')}`,
          recipient: userId,
          metadata: {
            source: 'market-signal',
            signalQuery: signal.query,
            signalUrl: signal.url,
            signalImage: signal.image_url,
            matchScore: result.score,
            matchReasons: result.reasons,
          },
        });
      } catch (sugErr) {
        logger.warn(`Failed to create suggestion for ${userId}`, { component: 'tasks' }, sugErr);
      }
    }

    if (matched > 0) {
      pipeline.ltrim(matchedKey, 0, MATCHED_MAX - 1);
      pipeline.expire(matchedKey, MATCHED_TTL);
      await pipeline.exec();

      logger.info(`Matched ${matched} signal(s) for user ${userId}`, {
        component: 'tasks',
        userId,
        matched,
        totalSignals: signals.length,
      });
    }

    return { userId, matched, total: signals.length, skipped: false };
  } catch (err) {
    logger.error(`Matching failed for user ${userId}`, { component: 'tasks' }, err);
    return { userId, matched: 0, total: 0, error: err.message };
  }
}

// ── POST /api/agent/tasks/execute — Process pending external_search suggestions ──

router.post('/execute', async (req, res) => {
  const startTime = Date.now();
  const agentId = req.body.agentId || DEFAULT_AGENT_ID;

  try {
    await agentCore.AgentControls.initStore(agentId, DEFAULT_USER_ID);

    const pending = agentCore.AgentControls.getPendingSuggestions(agentId);
    const externalSearches = pending.filter(
      (s) => s.actionType === 'external_search' && (s.isSearching || s.status === 'pending'),
    );

    if (externalSearches.length === 0) {
      return res.json({
        success: true,
        processed: 0,
        pendingCount: pending.length,
        results: [],
        elapsedMs: Date.now() - startTime,
      });
    }

    logger.info(`Tasks: processing ${externalSearches.length} external_search suggestion(s)`, {
      component: 'tasks',
      agentId,
    });

    const results = [];

    for (const suggestion of externalSearches) {
      try {
        const query = suggestion.description || '';
        if (!query) {
          results.push({ suggestionId: suggestion.id, success: false, error: 'No search query' });
          continue;
        }

        suggestion.isSearching = true;

        const bridgeResult = await agentCore.AgentControls.dispatchExternalAction(
          DEFAULT_USER_ID,
          { type: 'search', payload: { query } },
        );

        if (bridgeResult.success && bridgeResult.data?.items?.length > 0) {
          const items = bridgeResult.data.items;
          const topItem = items[0];

          suggestion.description = `Found ${items.length} result${items.length > 1 ? 's' : ''}: ${topItem.name}`;
          suggestion.source = topItem.source;
          suggestion.externalUrl = topItem.url;
          suggestion.isSearching = false;
          suggestion.liveUrl = bridgeResult.data.live_url;
          suggestion.amount = `$${topItem.price} cUSD`;
          suggestion.products = items.map((item) => ({
            name: item.name,
            price: item.price,
            source: item.source,
            url: item.url,
            image_url: item.image_url,
            currency: item.currency,
          }));

          agentCore.AgentControls.createSuggestion({ ...suggestion, userId: DEFAULT_USER_ID });

          results.push({ suggestionId: suggestion.id, success: true, itemCount: items.length, topItem: topItem.name });

          logger.info(`Tasks: processed suggestion ${suggestion.id} — ${items.length} item(s) found`, {
            component: 'tasks',
            query,
            itemCount: items.length,
          });
        } else {
          suggestion.isSearching = false;
          agentCore.AgentControls.createSuggestion({ ...suggestion, userId: DEFAULT_USER_ID });

          results.push({ suggestionId: suggestion.id, success: false, error: bridgeResult.error || 'No results' });

          logger.warn(`Tasks: no results for suggestion ${suggestion.id}`, { component: 'tasks', query });
        }
      } catch (err) {
        logger.error(`Tasks: failed to process suggestion ${suggestion.id}`, { component: 'tasks' }, err);
        results.push({ suggestionId: suggestion.id, success: false, error: err.message || 'Unknown error' });
      }
    }

    res.json({
      success: true,
      processed: results.length,
      succeeded: results.filter((r) => r.success).length,
      failed: results.filter((r) => !r.success).length,
      pendingCount: pending.length,
      results,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Tasks execute error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to process pending tasks', elapsedMs: Date.now() - startTime });
  }
});

// ── POST /api/agent/tasks/market-signals — Proactive market signal polling ──

router.post('/market-signals', async (req, res) => {
  const startTime = Date.now();
  const queries = req.body.queries || TRENDING_QUERIES;
  const maxResults = req.body.maxResults || 3;
  const matchUserIds = req.body.matchUserIds || [];

  try {
    const signals = [];

    for (const query of queries) {
      try {
        const result = await agentCore.AgentControls.dispatchExternalAction(
          DEFAULT_USER_ID,
          { type: 'search', payload: { query } },
        );

        if (result.success && result.data?.items?.length > 0) {
          for (const item of result.data.items) {
            signals.push({
              query,
              source: item.source || 'web-bridge',
              name: item.name,
              price: item.price,
              currency: item.currency || 'USD',
              url: item.url,
              image_url: item.image_url,
              discoveredAt: new Date().toISOString(),
            });
          }

          logger.info(`Tasks: market signal "${query}" — ${result.data.items.length} item(s)`, {
            component: 'tasks',
            query,
            itemCount: result.data.items.length,
          });
        }
      } catch (err) {
        logger.warn(`Tasks: market signal failed for "${query}"`, { component: 'tasks', query }, err);
      }
    }

    // Store all signals in Redis
    const stored = await storeSignals(signals);

    // Run matching for specified user IDs (the worker sends active users)
    const matchResults = [];
    for (const userId of matchUserIds) {
      const result = await matchForUser(userId);
      matchResults.push(result);
    }

    // Tier 3: Autonomous commerce — price tracking, drop detection, auto-buy
    const commerceResult = await runCommercePipeline(signals, matchUserIds);

    res.json({
      success: true,
      queriesProcessed: queries.length,
      totalSignals: signals.length,
      stored,
      matchedUsers: matchResults.length,
      matchResults,
      dropsFound: commerceResult.dropsFound,
      drops: commerceResult.drops,
      autoBuyResults: commerceResult.autoBuyResults,
      commerceElapsedMs: commerceResult.elapsedMs,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Tasks market-signals error', { component: 'tasks' }, error);
    res.status(500).json({
      success: false,
      error: 'Failed to poll market signals',
      elapsedMs: Date.now() - startTime,
    });
  }
});

// ── GET /api/agent/tasks/matches?userId=X — Get matched signals for a user ──

router.get('/matches', async (req, res) => {
  const startTime = Date.now();
  const userId = req.query.userId;
  const limit = parseInt(req.query.limit) || 20;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    const redis = getRedis();
    const matchedKey = `${MATCHED_KEY_PREFIX}${userId}`;

    const raw = await redis.lrange(matchedKey, 0, limit - 1);
    const matches = raw
      .map((s) => {
        try { return JSON.parse(s); } catch { return null; }
      })
      .filter(Boolean);

    // Record this user as active (for the worker's next market signal cycle)
    await redis.sadd(ACTIVE_USERS_KEY, userId);
    await redis.expire(ACTIVE_USERS_KEY, ACTIVE_USERS_TTL);

    // Also get the user's style preferences for context
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);
    const prefs = agentCore.AgentControls.getStylePreferences(userId);

    // Get pending market-signal suggestions for this user
    const pending = agentCore.AgentControls.getPendingSuggestions(DEFAULT_AGENT_ID);
    const signalSuggestions = pending.filter(
      (s) => s.metadata?.source === 'market-signal' && !s.autoApprovable,
    );

    res.json({
      success: true,
      userId,
      totalMatches: matches.length,
      matches,
      userPreferences: {
        categories: prefs.categories,
        brands: prefs.brands,
        colors: prefs.colors,
        priceRange: prefs.priceRange,
        styleAesthetics: prefs.styleAesthetics,
      },
      pendingSignalSuggestions: signalSuggestions.length,
      elapsedMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error('Tasks matches error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to get matches' });
  }
});

// ── POST /api/agent/tasks/match-user — Run matching for a specific user ──

router.post('/match-user', async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: 'userId is required' });
  }

  const result = await matchForUser(userId);
  res.json({ success: true, ...result });
});

// ── GET /api/agent/tasks/active-users — Get active user IDs for the worker ──

router.get('/active-users', async (req, res) => {
  try {
    const redis = getRedis();
    const userIds = await redis.smembers(ACTIVE_USERS_KEY);
    res.json({ success: true, userIds, count: userIds.length });
  } catch (error) {
    logger.error('Tasks active-users error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to get active users' });
  }
});

// ── POST /api/agent/tasks/auto-buy — Autonomous purchase for a price drop ──
// Body: { userId, drop: { name, source, url, newPrice, ... } }

router.post('/auto-buy', async (req, res) => {
  const startTime = Date.now();
  const { userId, drop } = req.body;

  if (!userId || !drop) {
    return res.status(400).json({ success: false, error: 'userId and drop are required' });
  }

  const result = await autoBuy(userId, drop);

  res.json({
    success: result.success,
    ...result,
    elapsedMs: Date.now() - startTime,
  });
});

// ── GET /api/agent/tasks/drops?userId=X — Get price drops for a user ──

router.get('/drops', async (req, res) => {
  const startTime = Date.now();
  const userId = req.query.userId;
  const limit = parseInt(req.query.limit) || 20;

  try {
    const redis = getRedis();

    if (userId) {
      // User-specific drops
      const userKey = `${USER_DROPS_PREFIX}${userId}`;
      const raw = await redis.lrange(userKey, 0, limit - 1);
      const drops = raw
        .map((d) => { try { return JSON.parse(d); } catch { return null; } })
        .filter(Boolean);
      return res.json({ success: true, userId, drops, count: drops.length, elapsedMs: Date.now() - startTime });
    }

    // Global drops
    const raw = await redis.lrange(DROPS_GLOBAL_KEY, 0, limit - 1);
    const drops = raw
      .map((d) => { try { return JSON.parse(d); } catch { return null; } })
      .filter(Boolean);
    res.json({ success: true, drops, count: drops.length, elapsedMs: Date.now() - startTime });
  } catch (error) {
    logger.error('Tasks drops error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to get price drops' });
  }
});

// ── POST /api/agent/tasks/preferences — Update user auto-buy preferences ──
// Body: { userId, autoBuyMaxPrice: number (0 = disabled) }

router.post('/preferences', async (req, res) => {
  const { userId, autoBuyMaxPrice } = req.body;

  if (!userId) {
    return res.status(400).json({ success: false, error: 'userId is required' });
  }

  if (autoBuyMaxPrice === undefined || autoBuyMaxPrice < 0) {
    return res.status(400).json({ success: false, error: 'autoBuyMaxPrice must be a non-negative number' });
  }

  try {
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);

    const updated = agentCore.AgentControls.updateStylePreferences(userId, {
      autoBuyMaxPrice,
    });

    logger.info(`Auto-buy preference updated for ${userId}: max price = $${autoBuyMaxPrice}`, {
      component: 'tasks',
      userId,
      autoBuyMaxPrice,
    });

    res.json({
      success: true,
      userId,
      autoBuyMaxPrice: updated.autoBuyMaxPrice,
      autoBuyEnabled: (updated.autoBuyMaxPrice || 0) > 0,
    });
  } catch (error) {
    logger.error('Tasks preferences error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

// ── GET /api/agent/tasks/preferences?userId=X — Get user auto-buy preferences ──

router.get('/preferences', async (req, res) => {
  const userId = req.query.userId;

  if (!userId) {
    return res.status(400).json({ error: 'userId query parameter is required' });
  }

  try {
    await agentCore.AgentControls.initStore(DEFAULT_AGENT_ID, userId);
    const prefs = agentCore.AgentControls.getStylePreferences(userId);

    res.json({
      success: true,
      userId,
      autoBuyMaxPrice: prefs.autoBuyMaxPrice || 0,
      autoBuyEnabled: (prefs.autoBuyMaxPrice || 0) > 0,
    });
  } catch (error) {
    logger.error('Tasks preferences error', { component: 'tasks' }, error);
    res.status(500).json({ success: false, error: 'Failed to get preferences' });
  }
});

module.exports = router;
