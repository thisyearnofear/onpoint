/**
 * Agent Outfit Planner — POST /api/agent/outfit
 *
 * Free endpoint: an agent sends a styling brief (occasion, season, weather,
 * budget, optional preferred listing) and gets back executable looks —
 * combos of live, agent-purchasable listings scored deterministically by
 * lib/outfit-planner.js (no LLM).
 *
 * Body: { occasion?, season?, weather?: {tempC?, rain?}, budgetCusd?,
 *         preferredListingId?, maxLooks? (default 3, cap 5), curatorSlug?,
 *         closetItems?: [{title, type, formality?, warmth?, colors?}] (max 3,
 *           metadata only — mixed in as free, non-orderable candidates) }
 */

const express = require('express');
const { eq, desc } = require('drizzle-orm');
const { curators, listings, kitSkus } = require('@repo/db');
const logger = require('../lib/logger');
const { getDb } = require('../lib/db');
const { keyToUrl } = require('../lib/r2');
const { isValidSlug } = require('../lib/slugs');
const { buildListingAgentCommerce } = require('../lib/agent-commerce');
const { planOutfits } = require('../lib/outfit-planner');

const router = express.Router();

const MAX_LOOKS_CAP = 5;
const MAX_CLOSET_ITEMS = 3;
const CLOSET_TYPES = new Set(['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory']);

function validateBrief(body) {
  const errors = [];
  if (body == null || typeof body !== 'object' || Array.isArray(body)) {
    return { errors: ['Body must be a JSON object'] };
  }
  const { occasion, season, weather, budgetCusd, preferredListingId, maxLooks, curatorSlug, closetItems } = body;

  if (occasion !== undefined && typeof occasion !== 'string') errors.push('occasion must be a string');
  if (season !== undefined && typeof season !== 'string') errors.push('season must be a string');
  if (weather !== undefined) {
    if (typeof weather !== 'object' || weather === null || Array.isArray(weather)) {
      errors.push('weather must be an object');
    } else {
      if (weather.tempC !== undefined && !Number.isFinite(Number(weather.tempC))) {
        errors.push('weather.tempC must be a number');
      }
      if (weather.rain !== undefined && typeof weather.rain !== 'boolean') {
        errors.push('weather.rain must be a boolean');
      }
    }
  }
  if (budgetCusd !== undefined && (!Number.isFinite(Number(budgetCusd)) || Number(budgetCusd) <= 0)) {
    errors.push('budgetCusd must be a positive number');
  }
  if (preferredListingId !== undefined && typeof preferredListingId !== 'string') {
    errors.push('preferredListingId must be a string');
  }
  if (maxLooks !== undefined && (!Number.isInteger(Number(maxLooks)) || Number(maxLooks) < 1 || Number(maxLooks) > MAX_LOOKS_CAP)) {
    errors.push(`maxLooks must be an integer between 1 and ${MAX_LOOKS_CAP}`);
  }
  if (curatorSlug !== undefined && (typeof curatorSlug !== 'string' || !isValidSlug(curatorSlug))) {
    errors.push('curatorSlug must be a valid slug');
  }
  // On-device closet metadata (no photo bytes — images never leave the device).
  // Each item: { title?, type (required), formality?, warmth?, colors? }.
  if (closetItems !== undefined) {
    if (!Array.isArray(closetItems)) {
      errors.push('closetItems must be an array');
    } else {
      if (closetItems.length > MAX_CLOSET_ITEMS) {
        errors.push(`closetItems accepts at most ${MAX_CLOSET_ITEMS} items`);
      }
      closetItems.forEach((item, i) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) {
          errors.push(`closetItems[${i}] must be an object`);
          return;
        }
        if (item.title !== undefined && typeof item.title !== 'string') {
          errors.push(`closetItems[${i}].title must be a string`);
        }
        if (typeof item.type !== 'string' || !CLOSET_TYPES.has(item.type.trim().toLowerCase())) {
          errors.push(`closetItems[${i}].type must be one of ${[...CLOSET_TYPES].join(', ')}`);
        }
        for (const field of ['formality', 'warmth']) {
          if (item[field] !== undefined && typeof item[field] !== 'string') {
            errors.push(`closetItems[${i}].${field} must be a string`);
          }
        }
        if (item.colors !== undefined) {
          if (!Array.isArray(item.colors) || !item.colors.every((c) => typeof c === 'string')) {
            errors.push(`closetItems[${i}].colors must be an array of strings`);
          }
        }
      });
    }
  }
  return { errors };
}

/** Load live, agent-purchasable listings (physical only) for planning. */
async function loadPurchasableListings(db, curatorSlug) {
  const rows = await db
    .select({ listing: listings, kit: kitSkus, curator: curators })
    .from(listings)
    .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .innerJoin(curators, eq(listings.curatorSlug, curators.slug))
    .where(eq(listings.status, 'live'))
    .orderBy(desc(listings.updatedAt))
    .limit(500);

  const candidates = [];
  for (const { listing, kit, curator } of rows) {
    if (curatorSlug && listing.curatorSlug !== curatorSlug) continue;
    const offerListing = { ...listing, kit };
    // Non-null agentCommerce ⇒ live + in-stock + priced + curator wallet + fresh
    const commerce = buildListingAgentCommerce(curator, offerListing);
    if (!commerce?.available) continue;
    const prices = commerce.offers.map((o) => o.priceCusd).filter((p) => Number(p) > 0);
    if (prices.length === 0) continue;
    const imageKey = listing.attributes?.cutoutKey
      || listing.photoKeys?.[0]
      || kit?.officialImageKey
      || null;
    candidates.push({
      listingId: listing.id,
      curatorSlug: listing.curatorSlug,
      title: listing.title
        || (kit ? `${kit.club || ''} ${kit.kitType || ''} kit`.replace(/\s+/g, ' ').trim() : null),
      attributes: listing.attributes || null,
      imageUrl: keyToUrl(imageKey),
      priceCusd: Math.min(...prices),
      orderEndpoint: `/api/curator/${listing.curatorSlug}/order`,
    });
  }
  return candidates;
}

/** Client-supplied closet metadata → planner candidates (free, not orderable). */
function closetToCandidates(closetItems) {
  if (!Array.isArray(closetItems)) return [];
  return closetItems.slice(0, MAX_CLOSET_ITEMS).map((item, i) => ({
    listingId: `closet-${i}`,
    curatorSlug: 'closet',
    title: (typeof item.title === 'string' && item.title.trim()) || `My piece ${i + 1}`,
    attributes: {
      type: String(item.type).trim().toLowerCase(),
      formality: typeof item.formality === 'string' && item.formality.trim() ? item.formality.trim().toLowerCase() : null,
      warmth: typeof item.warmth === 'string' && item.warmth.trim() ? item.warmth.trim().toLowerCase() : null,
      colors: Array.isArray(item.colors) ? item.colors.filter((c) => typeof c === 'string').map((c) => c.trim().toLowerCase()).filter(Boolean).slice(0, 3) : [],
    },
    imageUrl: null,
    priceCusd: 0,
    orderEndpoint: null,
    source: 'closet',
  }));
}

router.post('/', async (req, res) => {
  const { errors } = validateBrief(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid brief', details: errors });
  }

  const brief = {
    occasion: req.body?.occasion,
    season: req.body?.season,
    weather: req.body?.weather,
    budgetCusd: req.body?.budgetCusd,
    preferredListingId: req.body?.preferredListingId,
    maxLooks: req.body?.maxLooks,
    curatorSlug: req.body?.curatorSlug,
  };
  const closetCandidates = closetToCandidates(req.body?.closetItems);

  let db;
  try {
    db = getDb({ curators, listings, kitSkus });
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'agent-outfit' });
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const live = await loadPurchasableListings(db, brief.curatorSlug);
    // Closet first: deterministic ordering prefers free, already-owned pieces.
    const candidates = [...closetCandidates, ...live];
    const { looks } = planOutfits({ listings: candidates, brief });

    res.json({
      looks,
      meta: {
        candidateCount: live.length,
        closetCount: closetCandidates.length,
        generatedAt: new Date().toISOString(),
      },
      nextSteps: {
        tryOn: '/api/agent/try-on',
        createLook: '/api/looks',
        order: '/api/curator/{slug}/order',
      },
    });
  } catch (err) {
    logger.error('Outfit planning failed', { component: 'agent-outfit' }, err);
    res.status(500).json({ error: 'Failed to plan outfits' });
  }
});

module.exports = router;
module.exports.__test = { validateBrief, loadPurchasableListings, closetToCandidates };
