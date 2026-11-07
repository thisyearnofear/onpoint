/**
 * Outfit Planner — deterministic, no-LLM outfit composition for the
 * agent /api/agent/outfit endpoint.
 *
 * Input: agent-purchasable listings annotated with garment attributes
 * (see lib/garment-attributes.js) and a styling brief (occasion, season,
 * weather, budget, preferred listing). Output: ranked looks that fit the
 * brief, or fewer/zero looks when inventory can't support good combos.
 */

const NEUTRALS = new Set([
  'black', 'white', 'grey', 'gray', 'beige', 'navy', 'cream', 'tan', 'brown',
]);

// Analogous color families (adjacent hues) + complementary pairs.
const ANALOGOUS = [
  new Set(['red', 'burgundy', 'maroon', 'pink']),
  new Set(['orange', 'gold', 'yellow']),
  new Set(['yellow', 'green', 'olive']),
  new Set(['green', 'teal', 'blue']),
  new Set(['blue', 'navy', 'teal']),
  new Set(['purple', 'pink', 'burgundy']),
];
// Stored as sorted pair keys (see pairKey).
const COMPLEMENTARY = new Set([
  'green|red', 'blue|orange', 'purple|yellow', 'gold|navy',
  'burgundy|olive', 'pink|teal', 'maroon|teal',
]);

const OCCASION_FORMALITY = {
  formal: ['formal', 'smart-casual'],
  event: ['formal', 'smart-casual'],
  'date-night': ['smart-casual', 'formal'],
  sport: ['sport'],
  outdoor: ['casual', 'sport'],
  travel: ['casual', 'smart-casual'],
};
const DEFAULT_FORMALITY = ['casual', 'smart-casual'];

const TYPE_TO_SLOT = {
  top: 'top', kit: 'top', bottom: 'bottom', dress: 'dress',
  outerwear: 'outerwear', footwear: 'footwear', accessory: 'accessory',
};

const MAX_ITEMS_PER_LOOK = 4;

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

/**
 * Color harmony score in [0, 1]. Neutrals pair with anything; two
 * non-neutral colors must match, be analogous, or be complementary.
 * @param {string[]} colors
 * @returns {number}
 */
function colorHarmony(colors) {
  const nonNeutral = [...new Set(
    (colors || [])
      .filter((c) => typeof c === 'string')
      .map((c) => c.trim().toLowerCase())
      .filter((c) => c && !NEUTRALS.has(c)),
  )];
  if (nonNeutral.length <= 1) return 1;

  let ok = 0;
  let total = 0;
  for (let i = 0; i < nonNeutral.length; i++) {
    for (let j = i + 1; j < nonNeutral.length; j++) {
      total++;
      const [a, b] = [nonNeutral[i], nonNeutral[j]];
      if (
        a === b
        || COMPLEMENTARY.has(pairKey(a, b))
        || ANALOGOUS.some((family) => family.has(a) && family.has(b))
      ) {
        ok++;
      }
    }
  }
  return total === 0 ? 1 : ok / total;
}

function slotOf(listing) {
  return TYPE_TO_SLOT[listing?.attributes?.type] || null;
}

function formalityTargets(occasion) {
  const key = String(occasion || '').trim().toLowerCase();
  return OCCASION_FORMALITY[key] || DEFAULT_FORMALITY;
}

/** 'cold' | 'hot' | null from weather/season. */
function climateOf(brief) {
  const tempC = Number(brief?.weather?.tempC);
  if (Number.isFinite(tempC)) {
    if (tempC < 12) return 'cold';
    if (tempC > 26) return 'hot';
    return null;
  }
  const season = String(brief?.season || '').trim().toLowerCase();
  if (season === 'winter' || season === 'fall') return 'cold';
  if (season === 'summer') return 'hot';
  return null;
}

function itemFormalScore(item, targets) {
  const formality = item?.attributes?.formality;
  if (!formality) return 0;
  if (formality === targets[0]) return 2;
  if (targets.includes(formality)) return 1.5;
  return 0;
}

function itemWarmthScore(item, climate) {
  const warmth = item?.attributes?.warmth;
  if (!climate || !warmth) return 0;
  if (climate === 'cold') return warmth === 'heavy' ? 2 : warmth === 'medium' ? 0.5 : -1;
  return warmth === 'light' ? 2 : warmth === 'medium' ? 0 : -2;
}

function comboScore(items, brief, targets, climate) {
  const why = [];
  let score = 0;

  const formalHits = items.filter((i) => itemFormalScore(i, targets) >= 1.5).length;
  score += items.reduce((s, i) => s + itemFormalScore(i, targets), 0);
  if (formalHits === items.length) {
    score += 1;
    why.push(`every piece fits the ${brief.occasion || 'casual'} occasion`);
  } else if (formalHits > 0) {
    why.push(`${formalHits} of ${items.length} pieces fit the occasion`);
  }

  score += items.reduce((s, i) => s + itemWarmthScore(i, climate), 0);
  if (climate === 'cold') {
    const outer = items.find((i) => slotOf(i) === 'outerwear');
    if (outer && (outer.attributes?.warmth === 'heavy' || outer.attributes?.warmth === 'medium')) {
      score += 2;
      why.push('includes a warm outer layer for cold weather');
    } else {
      score -= 4;
      why.push('no warm outer layer available for cold weather');
    }
  } else if (climate === 'hot') {
    const heavyItem = items.find((i) => i.attributes?.warmth === 'heavy');
    if (heavyItem) {
      score -= 3;
      why.push(`${heavyItem.title || 'an item'} is too heavy for hot weather`);
    } else {
      why.push('light enough for hot weather');
    }
  }

  const colors = items.flatMap((i) => i.attributes?.colors || []);
  const harmony = colorHarmony(colors);
  score += harmony * 2 - 1;
  if (harmony >= 1 && colors.length > 0) {
    why.push('colors work together');
  } else if (harmony < 0.5) {
    why.push('colors clash — lower ranked for that reason');
  }

  if (brief.preferredListingId && items.some((i) => i.listingId === brief.preferredListingId)) {
    score += 5;
    why.push('includes your preferred item');
  }

  return { score: Math.round(score * 100) / 100, why };
}

function totalCusd(items) {
  const sum = items.reduce((s, i) => s + (Number(i.priceCusd) || 0), 0);
  return Math.round(sum * 100) / 100;
}

function comboKey(items) {
  return items.map((i) => i.listingId).sort().join('+');
}

/** Pick the best-scoring extra item for a base combo (deterministic). */
function bestExtra(base, candidates, brief, targets, climate) {
  let best = null;
  let bestScore = -Infinity;
  for (const item of candidates) {
    if (base.some((b) => b.listingId === item.listingId)) continue;
    const { score } = comboScore([...base, item], brief, targets, climate);
    // Tie-break: cheaper, then stable id order
    const tiebreak = score === bestScore
      && best
      && (item.priceCusd < best.priceCusd
        || (item.priceCusd === best.priceCusd && item.listingId < best.listingId));
    if (score > bestScore || tiebreak) {
      best = item;
      bestScore = score;
    }
  }
  return { item: best, score: bestScore };
}

function buildLook(items, brief, targets, climate) {
  const { score, why } = comboScore(items, brief, targets, climate);
  const occasion = String(brief.occasion || 'casual').trim().toLowerCase();
  const hero = items[0];
  return {
    title: `${occasion.charAt(0).toUpperCase() + occasion.slice(1)} look — ${hero.title || 'untitled'}`,
    items: items.map((item) => ({
      listingId: item.listingId,
      curatorSlug: item.curatorSlug,
      title: item.title || null,
      slot: slotOf(item),
      attributes: item.attributes || null,
      imageUrl: item.imageUrl || null,
      priceCusd: item.priceCusd ?? null,
      orderEndpoint: item.source === 'closet' ? null : (item.orderEndpoint || `/api/curator/${item.curatorSlug}/order`),
      source: item.source || 'listing',
    })),
    totalCusd: totalCusd(items),
    score,
    why,
  };
}

/**
 * Plan outfit looks from purchasable listings.
 *
 * @param {Object} opts
 * @param {Array} opts.listings — {listingId, curatorSlug, title, attributes,
 *   imageUrl, priceCusd} (cheapest in-stock size price)
 * @param {Object} opts.brief — {occasion, season, weather:{tempC,rain},
 *   budgetCusd, preferredListingId, maxLooks}
 * @returns {{looks: Array}}
 */
function planOutfits({ listings = [], brief = {} } = {}) {
  const maxLooks = Math.min(Math.max(Number(brief.maxLooks) || 3, 1), 5);
  const targets = formalityTargets(brief.occasion);
  const climate = climateOf(brief);
  const budget = Number(brief.budgetCusd);

  const bySlot = { top: [], bottom: [], dress: [], outerwear: [], footwear: [], accessory: [] };
  for (const listing of listings) {
    const slot = slotOf(listing);
    // Closet items are free (price 0) and stay on-device; only their metadata
    // reaches the planner. Live listings must still be positively priced.
    const isCloset = listing?.source === 'closet';
    const price = Number(listing.priceCusd);
    if (slot && (price > 0 || (isCloset && price >= 0))) bySlot[slot].push(listing);
  }
  // Deterministic candidate ordering
  for (const list of Object.values(bySlot)) {
    list.sort((a, b) => a.priceCusd - b.priceCusd || String(a.listingId).localeCompare(String(b.listingId)));
  }

  // Base combos: a dress alone, or top + bottom
  const bases = [
    ...bySlot.dress.map((d) => [d]),
    ...bySlot.top.flatMap((t) => bySlot.bottom.map((b) => [t, b])),
  ];

  const seen = new Set();
  const looks = [];
  for (const base of bases) {
    let items = base;

    // Optionally extend with outerwear / footwear — only when it raises the score
    for (const slot of ['outerwear', 'footwear']) {
      if (items.length >= MAX_ITEMS_PER_LOOK) break;
      if (bySlot[slot].length === 0) continue;
      const { item, score } = bestExtra(items, bySlot[slot], brief, targets, climate);
      const current = comboScore(items, brief, targets, climate).score;
      const mustHave = slot === 'outerwear' && climate === 'cold';
      if (item && (score >= current || mustHave)) {
        items = [...items, item];
      }
    }

    const key = comboKey(items);
    if (seen.has(key)) continue;
    seen.add(key);

    const total = totalCusd(items);
    if (Number.isFinite(budget) && budget > 0 && total > budget) continue;

    looks.push(buildLook(items, brief, targets, climate));
  }

  looks.sort((a, b) =>
    b.score - a.score
    || a.totalCusd - b.totalCusd
    || a.title.localeCompare(b.title));

  // Variety pass 1: no item reused across looks
  const used = new Set();
  const selected = [];
  for (const look of looks) {
    if (selected.length >= maxLooks) break;
    if (look.items.some((i) => used.has(i.listingId))) continue;
    selected.push(look);
    look.items.forEach((i) => used.add(i.listingId));
  }
  // Pass 2: allow reuse only when inventory is too thin to fill maxLooks
  for (const look of looks) {
    if (selected.length >= maxLooks) break;
    if (!selected.includes(look)) selected.push(look);
  }

  return { looks: selected.slice(0, maxLooks) };
}

module.exports = { planOutfits, colorHarmony };
