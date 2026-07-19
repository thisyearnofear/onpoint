/**
 * Look Classification — derives structured category/occasion/season
 * from look tags and item data using a rule-based system with
 * optional AI enhancement via Qwen Cloud vision.
 *
 * Fallback chain:
 *   Tier 1: Rule-based mapping from tags (always works, instant)
 *   Tier 2: Qwen Cloud vision analysis (if available and not kill-switched)
 *
 * The result is stored in agent_looks.metadata as:
 *   { category: "streetwear", occasion: "casual", season: "all-season" }
 */

const logger = require('./logger');

// ── Rule-based tag → category/occasion/season mapping ──

const TAG_TO_CATEGORY = {
  // Streetwear
  streetwear: 'streetwear', urban: 'streetwear', hype: 'streetwear',
  sneaker: 'streetwear', kicks: 'streetwear', street: 'streetwear',
  // Casual
  casual: 'casual', everyday: 'casual', relaxed: 'casual', weekend: 'casual',
  // Formal
  formal: 'formal', business: 'formal', office: 'formal', work: 'formal',
  suit: 'formal', blazer: 'formal',
  // Event
  event: 'event', party: 'event', occasion: 'event', wedding: 'event',
  // Sport
  sport: 'sport', athletic: 'sport', gym: 'sport', football: 'sport',
  kit: 'sport', soccer: 'sport', basketball: 'sport',
  // Vintage
  vintage: 'vintage', retro: 'vintage', thrift: 'vintage', classic: 'vintage',
  // Ankara / African
  ankara: 'ankara', african: 'ankara', kitenge: 'ankara', kente: 'ankara',
  // Sustainable
  sustainable: 'sustainable', eco: 'sustainable', thrifted: 'sustainable',
};

const TAG_TO_OCCASION = {
  casual: 'casual', everyday: 'casual', weekend: 'casual', relaxed: 'casual',
  streetwear: 'casual', urban: 'casual',
  formal: 'formal', business: 'formal', office: 'formal', work: 'formal',
  event: 'event', party: 'event', wedding: 'event', occasion: 'event',
  sport: 'sport', athletic: 'sport', gym: 'sport', football: 'sport',
  outdoor: 'outdoor', travel: 'travel', vacation: 'travel',
  date: 'date-night', dinner: 'date-night',
};

const TAG_TO_SEASON = {
  summer: 'summer', hot: 'summer', beach: 'summer', warm: 'summer',
  winter: 'winter', cold: 'winter', cozy: 'winter', layer: 'winter',
  spring: 'spring', floral: 'spring',
  fall: 'fall', autumn: 'fall', earth: 'fall',
  all: 'all-season', everyday: 'all-season',
};

/**
 * Classify a look from its tags using rule-based mapping.
 * @param {string[]} tags
 * @returns {{ category: string, occasion: string, season: string }}
 */
function classifyFromTags(tags) {
  if (!tags || tags.length === 0) {
    return { category: 'casual', occasion: 'casual', season: 'all-season' };
  }

  const lowerTags = tags.map((t) => t.toLowerCase());

  // Find first matching category
  let category = 'casual';
  for (const tag of lowerTags) {
    if (TAG_TO_CATEGORY[tag]) {
      category = TAG_TO_CATEGORY[tag];
      break;
    }
  }

  // Find first matching occasion
  let occasion = 'casual';
  for (const tag of lowerTags) {
    if (TAG_TO_OCCASION[tag]) {
      occasion = TAG_TO_OCCASION[tag];
      break;
    }
  }

  // Find first matching season
  let season = 'all-season';
  for (const tag of lowerTags) {
    if (TAG_TO_SEASON[tag]) {
      season = TAG_TO_SEASON[tag];
      break;
    }
  }

  return { category, occasion, season };
}

/**
 * Classify a look using AI vision (Qwen Cloud) if available.
 * Falls back to rule-based classification.
 *
 * @param {Object} opts
 * @param {string[]} opts.tags - look tags
 * @param {Array} opts.items - [{ imageUrl, title, isHero }]
 * @param {string} opts.lookTitle
 * @returns {Promise<{ category: string, occasion: string, season: string }>}
 */
async function classifyLook(opts) {
  const { tags, items, lookTitle } = opts;

  // Tier 1: Rule-based (always works)
  const ruleBased = classifyFromTags(tags);

  // Tier 2: AI vision (optional, best-effort)
  if (process.env.QWEN_CLOUD_KILL_SWITCH) {
    return ruleBased;
  }

  try {
    const { default: QwenCloudClient } = require('@repo/qwen-cloud');
    const client = new QwenCloudClient();

    if (!await client.isAvailable()) {
      return ruleBased;
    }

    // Use the hero item image for vision classification
    const heroItem = items?.find((i) => i.isHero) || items?.[0];
    if (!heroItem?.imageUrl) {
      return ruleBased;
    }

    const prompt = `Analyze this fashion look and classify it. Return ONLY a JSON object with these fields:
- category: one of [streetwear, casual, formal, event, sport, vintage, ankara, sustainable]
- occasion: one of [casual, formal, event, sport, outdoor, travel, date-night]
- season: one of [spring, summer, fall, winter, all-season]

Look title: "${lookTitle}"
Tags: ${tags?.join(', ') || 'none'}

Respond with only the JSON object, no other text.`;

    const result = await client.chatPersona(
      'You are a fashion classification AI. Respond only with JSON.',
      prompt,
      { model: 'qwen3-vl-flash', maxTokens: 100 },
    );

    // Parse the JSON from the response
    const jsonMatch = result?.content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        category: parsed.category || ruleBased.category,
        occasion: parsed.occasion || ruleBased.occasion,
        season: parsed.season || ruleBased.season,
      };
    }
  } catch (err) {
    logger.warn('AI look classification failed — using rule-based', {
      component: 'look-classify',
      error: err?.message,
    });
  }

  return ruleBased;
}

module.exports = { classifyLook, classifyFromTags };
