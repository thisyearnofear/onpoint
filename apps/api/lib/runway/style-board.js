/**
 * Style board — curated AI-generated outfit references served by the web app
 * (public/demo/outfits/*). Used by Runway's "the fix" as a theme-matched
 * fallback when no live look or listing matches. These are inspiration, not
 * purchasable inventory. Mirrored in apps/web/lib/style-board.ts.
 */

const STYLE_OUTFITS = [
  { id: 'spr-0001', title: 'Frill knit + denim mini', tags: ['spring', 'casual', 'weekend'] },
  { id: 'spr-0002', title: 'Floral cami + pink pleats', tags: ['spring', 'summer', 'casual', 'date'] },
  { id: 'spr-0161', title: 'Navy cardigan + jeans', tags: ['casual', 'weekend', 'classic', 'relaxed'] },
  { id: 'spr-0166', title: 'Asymmetric top + grey cargos', tags: ['casual', 'streetwear', 'weekend'] },
  { id: 'spr-0199', title: 'Grey hoodie + jeans', tags: ['streetwear', 'casual', 'sport', 'travel', 'weekend'] },
  { id: 'spr-0217', title: 'Crisp shirt + beige trousers', tags: ['business', 'office', 'work', 'elegant', 'classic'] },
  { id: 'spr-0232', title: 'Blue shirt + black jeans', tags: ['casual', 'weekend', 'date', 'streetwear'] },
  { id: 'spr-0248', title: 'Layered hoodie + jacket', tags: ['streetwear', 'casual', 'travel', 'fall'] },
  { id: 'sum-0001', title: 'Orange top + yellow pop', tags: ['summer', 'casual', 'party', 'streetwear'] },
  { id: 'sum-0014', title: 'Orange puff-sleeve top + pink trousers', tags: ['summer', 'casual', 'date', 'party'] },
  { id: 'sum-0209', title: 'White tee + cargo khakis', tags: ['summer', 'casual', 'streetwear', 'outdoor', 'travel'] },
  { id: 'sum-0213', title: 'Black blouse + grey trousers', tags: ['summer', 'business', 'work', 'elegant'] },
  { id: 'sum-0241', title: 'Green shirt + white linen', tags: ['summer', 'casual', 'relaxed', 'weekend'] },
  { id: 'aut-0001', title: 'Burgundy blouse + brown flares', tags: ['fall', 'casual', 'vintage', 'weekend'] },
  { id: 'aut-0010', title: 'Beige coat + navy shorts', tags: ['fall', 'elegant', 'classic', 'vintage', 'date'] },
  { id: 'aut-0039', title: 'Long cardigan + ivory trousers', tags: ['fall', 'cozy', 'casual', 'vintage', 'classic'] },
  { id: 'aut-0091', title: 'Mustard cardigan + dark jeans', tags: ['fall', 'date', 'dinner', 'elegant'] },
  { id: 'aut-0169', title: 'Field jacket + hoodie', tags: ['fall', 'streetwear', 'casual', 'outdoor', 'travel'] },
  { id: 'aut-0217', title: 'Grey cardigan + black trousers', tags: ['fall', 'business', 'office', 'work', 'classic'] },
  { id: 'aut-0240', title: 'Denim on denim', tags: ['fall', 'streetwear', 'casual', 'vintage', 'weekend'] },
  { id: 'win-0037', title: 'Black knit + tan trousers', tags: ['winter', 'cozy', 'casual'] },
  { id: 'win-0079', title: 'Beige knit + ivory trousers', tags: ['winter', 'cozy', 'elegant', 'relaxed', 'luxury'] },
  { id: 'win-0104', title: 'Green knit + long coat', tags: ['winter', 'cozy', 'elegant', 'classic'] },
  { id: 'win-0163', title: 'Black coat + dark denim', tags: ['winter', 'elegant', 'classic', 'night-out'] },
  { id: 'win-0182', title: 'Plaid shacket + hoodie + cargos', tags: ['winter', 'streetwear', 'casual', 'travel'] },
  { id: 'win-0194', title: 'Red plaid jacket + hoodie', tags: ['winter', 'streetwear', 'casual', 'vintage'] },
  { id: 'win-0203', title: 'Floral cardigan + jeans', tags: ['winter', 'casual', 'streetwear'] },
  { id: 'win-0240', title: 'Black jacket + beige trousers', tags: ['winter', 'business', 'work', 'elegant', 'night-out'] },
  { id: 'win-0260', title: 'Vest + hoodie', tags: ['winter', 'streetwear', 'casual', 'outdoor'] },
  { id: 'pty-0013', title: 'Chiffon midi', tags: ['party', 'event', 'wedding', 'elegant', 'formal', 'date'] },
  { id: 'pty-0016', title: 'Red lace midi', tags: ['party', 'event', 'formal', 'date', 'night-out', 'wedding'] },
  { id: 'pty-0023', title: 'Blue satin + fur', tags: ['party', 'event', 'elegant', 'formal', 'night-out', 'luxury'] },
  { id: 'pty-0031', title: 'Black sequin mini', tags: ['party', 'night-out', 'event'] },
  { id: 'pty-0043', title: 'Navy lace midi', tags: ['party', 'event', 'formal', 'elegant', 'dinner', 'wedding'] },
];

function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Best tag-overlap outfit for a theme + judge fixTags. Rotates among tied
 * top matches by day so repeat players see variety. Never returns null.
 */
function pickStyleFix({ theme, fixTags, now = Date.now() } = {}) {
  const want = new Set([...(theme?.tags || []), ...(fixTags || [])]);
  const scored = STYLE_OUTFITS.map((o) => ({
    o,
    score: o.tags.reduce((n, t) => n + (want.has(t) ? 1 : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score === scored[0].score);
  const day = Math.floor(now / 86_400_000);
  const idx = hashStr(`${theme?.id || 'freestyle'}:${day}`) % top.length;
  return top[idx].o;
}

module.exports = { STYLE_OUTFITS, pickStyleFix };
