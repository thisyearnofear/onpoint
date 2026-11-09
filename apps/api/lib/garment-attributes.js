/**
 * Garment Attribute Extraction — derives machine-readable garment
 * attributes (type, formality, warmth, fabric, pattern, fit, colors)
 * that agents can filter storefront listings on.
 *
 * Fallback chain:
 *   Tier 1: Rule-based keyword mapping from title + tags (always works)
 *   Tier 2: Qwen Cloud vision analysis of the listing image (best-effort)
 *
 * Stored in listings.attributes as:
 *   { type, formality, warmth, fabric, pattern, fit, colors, source }
 */

const logger = require('./logger');

const TYPES = ['top', 'bottom', 'dress', 'outerwear', 'footwear', 'accessory', 'kit', 'other'];
const FORMALITY = ['casual', 'smart-casual', 'formal', 'sport'];
const WARMTH = ['light', 'medium', 'heavy'];
const PATTERN = ['solid', 'striped', 'checked', 'graphic', 'floral', 'print', 'other'];
const FIT = ['slim', 'regular', 'relaxed', 'oversized'];

const KNOWN_COLORS = [
  'black', 'white', 'grey', 'gray', 'navy', 'blue', 'red', 'green', 'yellow',
  'orange', 'pink', 'purple', 'beige', 'cream', 'tan', 'brown', 'gold',
  'silver', 'burgundy', 'olive', 'teal', 'maroon',
];

const TYPE_KEYWORDS = [
  ['kit', ['kit', 'jersey', 'football shirt', 'soccer shirt']],
  ['dress', ['dress', 'gown', 'sundress', 'maxi']],
  ['outerwear', ['jacket', 'coat', 'hoodie', 'blazer', 'parka', 'puffer', 'windbreaker', 'cardigan']],
  ['footwear', ['shoes', 'sneakers', 'sneaker', 'boots', 'boot', 'trainers', 'sandals', 'heels', 'loafers', 'cleats']],
  ['accessory', ['bag', 'hat', 'cap', 'belt', 'scarf', 'watch', 'sunglasses', 'beanie', 'socks', 'accessory', 'jewelry', 'necklace']],
  ['bottom', ['jeans', 'trousers', 'pants', 'shorts', 'skirt', 'chinos', 'joggers', 'leggings', 'cargo']],
  ['top', ['shirt', 'tee', 't-shirt', 'tshirt', 'top', 'blouse', 'polo', 'sweater', 'jumper', 'sweatshirt', 'vest', 'tank']],
];

const FORMALITY_KEYWORDS = [
  ['formal', ['formal', 'suit', 'tuxedo', 'blazer', 'business', 'office', 'dress shirt', 'gala']],
  ['sport', ['sport', 'athletic', 'gym', 'football', 'soccer', 'basketball', 'kit', 'jersey', 'training', 'workout', 'running']],
  ['smart-casual', ['smart-casual', 'smart', 'chino', 'chinos', 'polo', 'button-down', 'business casual', 'date']],
];

const WARMTH_KEYWORDS = [
  ['heavy', ['heavy', 'winter', 'coat', 'parka', 'puffer', 'wool', 'fleece', 'down', 'thermal', 'chunky']],
  ['light', ['light', 'summer', 'linen', 'tank', 'tee', 't-shirt', 'shorts', 'breathable', 'beach', 'sleeveless']],
];

const FABRIC_KEYWORDS = [
  ['denim', ['denim', 'jeans']],
  ['leather', ['leather']],
  ['linen', ['linen']],
  ['silk', ['silk', 'satin']],
  ['wool', ['wool', 'knit', 'cashmere']],
  ['ankara', ['ankara', 'kitenge', 'kente', 'wax print']],
  ['cotton', ['cotton', 'tee', 'jersey']],
  ['polyester', ['polyester', 'nylon', 'synthetic', 'dri-fit']],
];

const PATTERN_KEYWORDS = [
  ['striped', ['striped', 'stripe', 'pinstripe']],
  ['checked', ['checked', 'check', 'plaid', 'gingham', 'tartan']],
  ['graphic', ['graphic', 'logo', 'slogan', 'printed tee', 'crest']],
  ['floral', ['floral', 'flower']],
  ['print', ['print', 'ankara', 'kente', 'kitenge', 'tie-dye', 'camo', 'camouflage', 'animal']],
  ['solid', ['solid', 'plain', 'block']],
];

const FIT_KEYWORDS = [
  ['slim', ['slim', 'skinny', 'fitted', 'tapered']],
  ['oversized', ['oversized', 'baggy', 'boxy', 'loose-fit']],
  ['relaxed', ['relaxed', 'loose', 'comfort']],
  ['regular', ['regular', 'classic', 'straight', 'standard']],
];

function matchKeyword(haystack, table) {
  for (const [value, keywords] of table) {
    if (keywords.some((k) => haystack.includes(k))) return value;
  }
  return null;
}

function clampEnum(value, allowed) {
  return allowed.includes(value) ? value : null;
}

function normalizeColors(value) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((c) => typeof c === 'string' && c.trim())
    .map((c) => c.trim().toLowerCase())
    .slice(0, 3);
}

/**
 * Rule-based attribute extraction from listing title + tags.
 * Always works — no network, no AI.
 *
 * @param {string[]} [tags]
 * @param {string} [title]
 * @returns {{type:string|null,formality:string|null,warmth:string|null,
 *   fabric:string|null,pattern:string|null,fit:string|null,
 *   colors:string[],source:'rules'}}
 */
function attributesFromTags(tags, title) {
  const haystack = [title || '', ...(tags || [])]
    .join(' ')
    .toLowerCase();

  const colors = KNOWN_COLORS.filter((c) => {
    // word-boundary match so "tan" doesn't hit "tangent"
    return new RegExp(`\\b${c}\\b`).test(haystack);
  }).slice(0, 3);

  return {
    type: matchKeyword(haystack, TYPE_KEYWORDS) || 'other',
    formality: matchKeyword(haystack, FORMALITY_KEYWORDS) || 'casual',
    warmth: matchKeyword(haystack, WARMTH_KEYWORDS),
    fabric: matchKeyword(haystack, FABRIC_KEYWORDS),
    pattern: matchKeyword(haystack, PATTERN_KEYWORDS),
    fit: matchKeyword(haystack, FIT_KEYWORDS),
    colors,
    source: 'rules',
  };
}

/** Validate a raw parsed object against the attribute contract. */
function normalizeAttributes(raw, fallback) {
  const base = fallback || attributesFromTags();
  return {
    type: clampEnum(raw?.type, TYPES) ?? base.type,
    formality: clampEnum(raw?.formality, FORMALITY) ?? base.formality,
    warmth: clampEnum(raw?.warmth, WARMTH) ?? base.warmth,
    fabric: typeof raw?.fabric === 'string' && raw.fabric.trim()
      ? raw.fabric.trim().toLowerCase()
      : base.fabric,
    pattern: clampEnum(raw?.pattern, PATTERN) ?? base.pattern,
    fit: clampEnum(raw?.fit, FIT) ?? base.fit,
    colors: normalizeColors(raw?.colors).length > 0
      ? normalizeColors(raw.colors)
      : base.colors,
    source: 'vision',
  };
}

/**
 * Extract garment attributes, preferring Qwen Cloud vision on the
 * listing image and falling back to rule-based extraction on any failure.
 *
 * @param {Object} opts
 * @param {string} [opts.imageUrl] — public listing image URL or data URI
 * @param {string} [opts.title]
 * @param {string[]} [opts.tags]
 * @param {Object} [opts.client] — optional Qwen Cloud client (tests)
 * @returns {Promise<Object>} attribute object with `source` field
 */
async function extractGarmentAttributes({ imageUrl, title, tags, client: injectedClient } = {}) {
  const ruleBased = attributesFromTags(tags, title);

  if (process.env.QWEN_CLOUD_KILL_SWITCH || !imageUrl) {
    return ruleBased;
  }

  try {
    const client = injectedClient || require('@repo/qwen-cloud').getPrimaryAiClient();

    if (!client || !await client.isAvailable()) {
      return ruleBased;
    }

    const prompt = `Extract garment attributes from this product image. Return ONLY a JSON object with these fields:
- type: one of [${TYPES.join(', ')}]
- formality: one of [${FORMALITY.join(', ')}]
- warmth: one of [${WARMTH.join(', ')}]
- fabric: short lowercase string (e.g. "cotton", "denim", "ankara")
- pattern: one of [${PATTERN.join(', ')}]
- fit: one of [${FIT.join(', ')}]
- colors: array of up to 3 dominant lowercase color names

Listing title: "${title || ''}"
Tags: ${(tags || []).join(', ') || 'none'}

Use null for any field you cannot determine. Respond with only the JSON object, no other text.`;

    const result = await client.analyzeOutfit(imageUrl, prompt, {
      model: 'qwen3-vl-flash',
      maxTokens: 200,
    });

    const jsonMatch = result?.content?.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return normalizeAttributes(JSON.parse(jsonMatch[0]), ruleBased);
    }
  } catch (err) {
    logger.warn('Vision garment attribute extraction failed — using rules', {
      component: 'garment-attributes',
      error: err?.message,
    });
  }

  return ruleBased;
}

module.exports = { extractGarmentAttributes, attributesFromTags };
