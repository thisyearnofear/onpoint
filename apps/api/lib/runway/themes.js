/**
 * Runway themes (ADR 0022). Each theme is a prompt the player dresses to,
 * plus tags used to match "the fix" against live OnPoint listings/looks.
 * Tags reuse the vocabulary in lib/look-classify.js where possible.
 */

const THEMES = [
  { id: 'brat-summer', name: 'Brat Summer', brief: 'lime-green attitude, messy-on-purpose, club-ready', tags: ['party', 'summer', 'streetwear'] },
  { id: 'quiet-luxury', name: 'Quiet Luxury', brief: 'no logos, expensive-looking neutrals, perfect fit', tags: ['luxury', 'elegant', 'formal'] },
  { id: 'off-duty-model', name: 'Off-Duty Model', brief: 'effortless, oversized, sunglasses energy', tags: ['casual', 'streetwear', 'weekend'] },
  { id: 'rooftop-brunch', name: 'Rooftop Brunch', brief: 'daylight polish, breathable, photo-ready', tags: ['casual', 'weekend', 'summer'] },
  { id: 'first-date', name: 'First Date', brief: 'confident but not trying too hard', tags: ['date', 'dinner', 'night-out'] },
  { id: 'job-interview-creative', name: 'Creative Job Interview', brief: 'professional with one memorable detail', tags: ['business', 'office', 'work'] },
  { id: 'y2k-revival', name: 'Y2K Revival', brief: 'low-rise, baby tees, chrome and shine', tags: ['vintage', 'retro', 'party'] },
  { id: 'dark-academia', name: 'Dark Academia', brief: 'tweed, knits, library at midnight', tags: ['vintage', 'classic', 'fall'] },
  { id: 'coastal-grandmother', name: 'Coastal Grandmother', brief: 'linen, cream, a beach house you own', tags: ['casual', 'summer', 'relaxed'] },
  { id: 'gorpcore', name: 'Gorpcore', brief: 'trail-ready tech layers worn to the city', tags: ['outdoor', 'streetwear', 'sport'] },
  { id: 'monochrome', name: 'Head-to-Toe Monochrome', brief: 'one colour, many textures', tags: ['elegant', 'classic'] },
  { id: 'clash-on-purpose', name: 'Clash on Purpose', brief: 'prints and colours that should not work — make them work', tags: ['party', 'ankara', 'streetwear'] },
  { id: 'ankara-modern', name: 'Ankara, Modern', brief: 'African print in a contemporary silhouette', tags: ['ankara', 'african', 'event'] },
  { id: 'nairobi-night-out', name: 'Nairobi Night Out', brief: 'Westlands after dark, dressed to be seen', tags: ['party', 'night-out', 'event'] },
  { id: 'wedding-guest', name: 'Wedding Guest (Not the Bride)', brief: 'celebratory, polished, never white', tags: ['wedding', 'event', 'formal'] },
  { id: 'festival', name: 'Festival Main Stage', brief: 'comfortable for 12 hours, unforgettable in photos', tags: ['party', 'summer', 'outdoor'] },
  { id: 'airport-fit', name: 'Airport Fit', brief: 'comfortable, layered, lounge-worthy', tags: ['travel', 'casual', 'relaxed'] },
  { id: 'villain-era', name: 'Villain Era', brief: 'all black, sharp shoulders, main-character menace', tags: ['night-out', 'elegant', 'party'] },
  { id: 'sports-luxe', name: 'Sports Luxe', brief: 'athletic pieces styled like they cost a fortune', tags: ['sport', 'athletic', 'streetwear'] },
  { id: 'jersey-styled', name: 'Matchday Jersey, Styled', brief: 'a football kit worn like fashion, not the stands', tags: ['football', 'kit', 'sport', 'streetwear'] },
  { id: 'thrift-flip', name: 'Thrift Flip', brief: 'secondhand pieces that look intentional', tags: ['thrift', 'vintage', 'sustainable'] },
  { id: 'one-colour-pop', name: 'Neutral + One Pop', brief: 'a calm base with exactly one loud accent', tags: ['casual', 'classic'] },
  { id: 'cozy-but-chic', name: 'Cozy but Chic', brief: 'knitwear and comfort that still reads styled', tags: ['winter', 'cozy', 'casual'] },
  { id: 'art-gallery-opening', name: 'Gallery Opening', brief: 'architectural, minimal, slightly odd', tags: ['event', 'elegant'] },
  { id: 'denim-on-denim', name: 'Denim on Denim', brief: 'the Canadian tuxedo, done right', tags: ['casual', 'vintage', 'streetwear'] },
  { id: 'old-money-weekend', name: 'Old Money Weekend', brief: 'country club, cable knit, loafers', tags: ['luxury', 'weekend', 'classic'] },
  { id: 'red-carpet-diy', name: 'Red Carpet from Your Closet', brief: 'black-tie drama with only what you own', tags: ['formal', 'event', 'elegant'] },
  { id: 'freestyle', name: 'Freestyle', brief: 'your best outfit, no rules', tags: ['casual', 'streetwear'] },
];

const FREESTYLE_ID = 'freestyle';
const BY_ID = new Map(THEMES.map((t) => [t.id, t]));

function getTheme(id) {
  return BY_ID.get(id) || BY_ID.get(FREESTYLE_ID);
}

/** Random theme, avoiding recently played ids and the freestyle fallback. */
function pickTheme(excludeIds = [], rand = Math.random) {
  const exclude = new Set([FREESTYLE_ID, ...excludeIds]);
  const pool = THEMES.filter((t) => !exclude.has(t.id));
  const choices = pool.length ? pool : THEMES.filter((t) => t.id !== FREESTYLE_ID);
  return choices[Math.floor(rand() * choices.length)];
}

/** Deterministic theme for a UTC date — same theme everywhere that day. */
function themeOfDay(now = Date.now()) {
  const pool = THEMES.filter((t) => t.id !== FREESTYLE_ID);
  const day = Math.floor(now / 86_400_000);
  return pool[((day % pool.length) + pool.length) % pool.length];
}

module.exports = { THEMES, FREESTYLE_ID, getTheme, pickTheme, themeOfDay };
