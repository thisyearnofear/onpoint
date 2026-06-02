/**
 * Curated Shop Route — Hetzner port
 *
 * Generates curated product picks from the Python bridge (Purch / TinyFish)
 * with local CANVAS_ITEMS fallback and Venice AI synthetic fallback.
 *
 * Browser requests are proxied via Next.js rewrites:
 *   /api/agent/curated-shop → Hetzner /api/agent/curated-shop
 *
 * Frontend sends: { score, takeaways, topics, persona?, sessionGoal? }
 * Returns: { picks, queries, source, cached }
 */

const express = require('express');
const router = express.Router();
const logger = require('../lib/logger');
const { searchViaBridge, searchViaVenice } = require('../lib/product-search');

let CANVAS_ITEMS;
try {
  CANVAS_ITEMS = require('@onpoint/shared-types').CANVAS_ITEMS || [];
} catch {
  CANVAS_ITEMS = [];
  logger.warn('CANVAS_ITEMS unavailable — @onpoint/shared-types not built', {
    component: 'curated-shop',
  });
}

// ── Curation constants (ported from apps/web/lib/utils/curated-picks.ts) ──

const PERSONA_QUERY_MODIFIERS = {
  luxury: 'designer luxury',
  streetwear: 'streetwear urban',
  sustainable: 'sustainable ethical',
  miranda: 'professional polished',
  edina: 'bold statement',
  shaft: 'classic versatile',
};

const TOPIC_CATEGORY_MAP = {
  'Color Harmony': ['shirts', 'dresses', 'accessories'],
  'Fit & Proportion': ['pants', 'shirts', 'dresses'],
  'Accessories': ['accessories', 'shoes'],
  'Layering': ['outerwear', 'shirts'],
  'Footwear': ['shoes'],
  'Silhouette': ['dresses', 'pants', 'outerwear'],
  'Texture & Fabric': ['shirts', 'outerwear', 'dresses'],
  'Pattern Mixing': ['shirts', 'dresses', 'accessories'],
};

const GOAL_MODIFIERS = {
  event: 'for a special event',
  daily: 'for everyday wear',
  critique: 'to elevate my wardrobe',
};

const PERSONA_LABELS = {
  luxury: 'Luxury',
  streetwear: 'Streetwear',
  sustainable: 'Sustainable',
  miranda: 'Professional',
  edina: 'Bold',
  shaft: 'Classic',
};

const GOAL_LABELS = {
  event: 'Special Event',
  daily: 'Everyday',
  critique: 'Wardrobe Refresh',
};

const STOP_WORDS = new Set([
  'about', 'after', 'again', 'against', 'because', 'being', 'below',
  'between', 'could', 'during', 'every', 'first', 'found', 'from',
  'great', 'having', 'here', 'into', 'just', 'like', 'look',
  'make', 'many', 'might', 'more', 'much', 'next', 'only', 'other',
  'overall', 'really', 'right', 'said', 'same', 'seem', 'should',
  'since', 'some', 'still', 'such', 'than', 'that', 'their', 'them',
  'then', 'there', 'these', 'they', 'this', 'those', 'through',
  'today', 'together', 'toward', 'under', 'upon', 'very', 'want',
  'wear', 'well', 'were', 'what', 'when', 'where', 'which', 'while',
  'will', 'with', 'within', 'would', 'your', 'yours',
]);

const CLOTHING_TERMS = [
  'jacket', 'blazer', 'coat', 'shirt', 'blouse', 'top', 'tee',
  'pants', 'trousers', 'jeans', 'denim', 'dress', 'skirt',
  'shoes', 'sneakers', 'boots', 'heels', 'loafers', 'sandals',
  'bag', 'purse', 'tote', 'accessories', 'watch', 'jewelry',
  'sweater', 'hoodie', 'cardigan', 'scarf', 'belt', 'hat',
  'outerwear', 'knitwear', 'suit', 'shorts',
];

// ── Curation helpers ──

function extractItemKeywords(takeaways) {
  const text = takeaways.join(' ').toLowerCase();
  const found = [];

  for (const term of CLOTHING_TERMS) {
    if (text.includes(term) && !found.includes(term)) {
      found.push(term);
    }
  }

  if (found.length === 0) {
    const words = text
      .split(/\s+/)
      .filter((w) => w.length > 4 && !STOP_WORDS.has(w));
    return words.slice(0, 3);
  }

  return found.slice(0, 3);
}

function buildSearchQueries(ctx, max = 3) {
  const queries = [];
  const itemKeywords = extractItemKeywords(ctx.takeaways);
  const personaMod = ctx.persona ? PERSONA_QUERY_MODIFIERS[ctx.persona] || '' : '';
  const goalMod = ctx.sessionGoal ? GOAL_MODIFIERS[ctx.sessionGoal] || '' : '';

  for (const keyword of itemKeywords) {
    if (queries.length >= max) break;
    const parts = [personaMod, keyword, goalMod].filter(Boolean);
    queries.push(parts.join(' ').trim());
  }

  if (queries.length === 0 && ctx.topics.length > 0) {
    const firstTopic = ctx.topics[0];
    const topicQuery = [personaMod, firstTopic.toLowerCase(), goalMod]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (topicQuery) queries.push(topicQuery);
  }

  return queries.slice(0, max);
}

function scoreLocalPicks(ctx, limit = 5) {
  const takeawayKeywords = ctx.takeaways
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const topicCategories = ctx.topics.flatMap(
    (topic) => TOPIC_CATEGORY_MAP[topic] || [],
  );

  const scored = CANVAS_ITEMS.map((item) => {
    let score = 0;
    let triggeredBy = '';

    const itemText = `${item.name} ${item.description} ${item.category}`.toLowerCase();

    for (const kw of takeawayKeywords) {
      if (itemText.includes(kw)) {
        score += 8;
        if (!triggeredBy) triggeredBy = kw;
      }
    }

    if (topicCategories.includes(item.category)) {
      score += 6;
      if (!triggeredBy) {
        triggeredBy = ctx.topics.find(
          (t) => (TOPIC_CATEGORY_MAP[t] || []).includes(item.category),
        ) || '';
      }
    }

    score += item.averageRating || 0;
    score += Math.random() * 0.5;

    const reason = triggeredBy
      ? `Matches your ${triggeredBy} feedback`
      : `Complements your ${item.category} style`;

    return { item, score, triggeredBy, reason };
  })
    .filter((s) => s.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((s) => ({
    source: 'local',
    item: s.item,
    reason: s.reason,
    triggeredBy: s.triggeredBy,
  }));
}

// ── Search orchestration ──

function normalizeProduct(item) {
  return {
    ...item,
    imageUrl: item.imageUrl || item.image_url || '',
    currency: item.currency || 'USD',
  };
}

async function searchQuery(query, limit) {
  let result = await searchViaBridge(query, limit);
  if (result) return { result, source: 'bridge' };

  result = await searchViaVenice(query, limit);
  if (result) return { result, source: 'venice-ai' };

  return { result: null, source: 'none' };
}

// POST /api/agent/curated-shop
router.post('/', async (req, res) => {
  try {
    const { score, takeaways, topics, persona, sessionGoal } = req.body;

    if (!takeaways || !Array.isArray(takeaways) || takeaways.length === 0) {
      return res.status(400).json({ error: 'takeaways array required' });
    }
    if (!topics || !Array.isArray(topics) || topics.length === 0) {
      return res.status(400).json({ error: 'topics array required' });
    }

    const ctx = {
      score: score || 5,
      takeaways: takeaways.slice(0, 10),
      topics: topics.slice(0, 6),
      persona: persona || undefined,
      sessionGoal: sessionGoal || undefined,
    };

    const queries = buildSearchQueries(ctx, 3);
    const personaLabel = ctx.persona ? PERSONA_LABELS[ctx.persona] : undefined;
    const goalLabel = ctx.sessionGoal ? GOAL_LABELS[ctx.sessionGoal] : undefined;

    // Search for each query in parallel
    const searchOutcomes = await Promise.all(
      queries.map((query) => searchQuery(query, 3)),
    );

    const seenNames = new Set();
    const picks = [];
    let anyBridge = false;
    let anyVenice = false;

    for (let i = 0; i < searchOutcomes.length; i++) {
      const { result, source } = searchOutcomes[i];
      if (source === 'bridge') anyBridge = true;
      if (source === 'venice-ai') anyVenice = true;
      if (!result || !result.items) continue;

      for (const rawItem of result.items) {
        const item = normalizeProduct(rawItem);
        const name = (item.name || '').toLowerCase();
        if (seenNames.has(name)) continue;
        seenNames.add(name);

        const isExternal = 'url' in item && 'source' in item;
        const takeaway = ctx.takeaways[i] || ctx.takeaways[0] || '';
        const price = item.price;

        picks.push({
          source: isExternal ? 'external' : 'local',
          item,
          reason: `Found based on: "${takeaway.slice(0, 60)}"`,
          triggeredBy: queries[i] || '',
          provenance: {
            personaLabel,
            goalLabel,
            priceRange: price != null ? `$${price}` : undefined,
            matchedTakeaway: takeaway.slice(0, 40) || undefined,
          },
        });
      }
    }

    // Backfill with local picks if we don't have enough
    if (picks.length < 3) {
      const localPicks = scoreLocalPicks(ctx, 5 - picks.length);
      for (const pick of localPicks) {
        if (!seenNames.has(pick.item.name.toLowerCase())) {
          seenNames.add(pick.item.name.toLowerCase());
          picks.push({
            ...pick,
            provenance: {
              ...pick.provenance,
              personaLabel,
              goalLabel,
            },
          });
        }
      }
    }

    const source = anyBridge ? 'bridge' : anyVenice ? 'venice-ai' : 'local';

    res.json({
      picks: picks.slice(0, 5),
      queries,
      source,
      cached: false,
    });
  } catch (error) {
    logger.error('Curated shop error', { component: 'curated-shop' }, error);
    res.status(500).json({ error: 'Failed to generate curated picks' });
  }
});

module.exports = router;
