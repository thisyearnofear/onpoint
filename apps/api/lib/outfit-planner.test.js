import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { planOutfits, colorHarmony } = require('./outfit-planner');

function item(id, type, overrides = {}) {
  return {
    listingId: id,
    curatorSlug: overrides.curatorSlug || 'zara',
    title: overrides.title || id,
    imageUrl: `https://cdn.example.com/${id}.webp`,
    priceCusd: overrides.priceCusd ?? 5,
    attributes: {
      type,
      formality: overrides.formality ?? 'casual',
      warmth: overrides.warmth ?? null,
      fabric: null,
      pattern: null,
      fit: null,
      colors: overrides.colors ?? [],
      source: 'rules',
    },
  };
}

describe('colorHarmony', () => {
  it('scores neutrals with anything', () => {
    expect(colorHarmony(['black', 'red', 'white'])).toBe(1);
    expect(colorHarmony(['navy', 'grey'])).toBe(1);
    expect(colorHarmony([])).toBe(1);
  });

  it('scores matching, analogous, and complementary pairs well', () => {
    expect(colorHarmony(['red', 'red'])).toBe(1);
    expect(colorHarmony(['red', 'pink'])).toBe(1);       // analogous
    expect(colorHarmony(['red', 'green'])).toBe(1);      // complementary
    expect(colorHarmony(['blue', 'orange'])).toBe(1);    // complementary
  });

  it('penalizes clashing non-neutral pairs', () => {
    expect(colorHarmony(['red', 'purple'])).toBeLessThan(1);
    expect(colorHarmony(['green', 'purple'])).toBeLessThan(1);
    expect(colorHarmony(['red', 'purple', 'green'])).toBeLessThan(0.5);
  });
});

describe('planOutfits', () => {
  const casualTop = item('tee-1', 'top', { title: 'White Tee', colors: ['white'], warmth: 'light' });
  const casualBottom = item('jeans-1', 'bottom', { title: 'Blue Jeans', colors: ['blue'] });
  const formalTop = item('shirt-1', 'top', { title: 'Dress Shirt', formality: 'formal', colors: ['white'] });
  const formalBottom = item('trousers-1', 'bottom', { title: 'Wool Trousers', formality: 'formal', colors: ['grey'] });
  const heavyCoat = item('coat-1', 'outerwear', { title: 'Wool Coat', warmth: 'heavy', formality: 'formal' });
  const dress = item('dress-1', 'dress', { title: 'Floral Dress', formality: 'smart-casual', colors: ['pink'] });

  it('composes top+bottom and dress looks', () => {
    const { looks } = planOutfits({
      listings: [casualTop, casualBottom, dress],
      brief: { occasion: 'casual' },
    });
    expect(looks.length).toBeGreaterThan(0);
    const keys = looks.map((l) => l.items.map((i) => i.listingId).sort().join('+')).sort();
    expect(keys).toContain('dress-1');
    expect(keys).toContain('jeans-1+tee-1');
    // every item carries slot + order endpoint
    expect(looks[0].items[0]).toMatchObject({
      slot: expect.any(String),
      orderEndpoint: '/api/curator/zara/order',
    });
  });

  it('ranks formal pieces first for a formal occasion', () => {
    const { looks } = planOutfits({
      listings: [casualTop, casualBottom, formalTop, formalBottom],
      brief: { occasion: 'formal', maxLooks: 1 },
    });
    expect(looks[0].items.map((i) => i.listingId).sort())
      .toEqual(['shirt-1', 'trousers-1']);
  });

  it('requires a warm outer layer in cold weather when available', () => {
    const { looks } = planOutfits({
      listings: [formalTop, formalBottom, heavyCoat],
      brief: { weather: { tempC: 5 }, maxLooks: 1 },
    });
    expect(looks[0].items.some((i) => i.slot === 'outerwear')).toBe(true);
    expect(looks[0].why.some((w) => w.includes('outer layer'))).toBe(true);
  });

  it('penalizes heavy garments in hot weather', () => {
    const { looks } = planOutfits({
      listings: [heavyCoat, casualTop, casualBottom],
      brief: { weather: { tempC: 30 }, maxLooks: 1 },
    });
    // coat would be dead weight at 30°C — the top+bottom combo wins
    expect(looks[0].items.some((i) => i.listingId === 'coat-1')).toBe(false);
  });

  it('uses season when no weather is given', () => {
    const { looks } = planOutfits({
      listings: [formalTop, formalBottom, heavyCoat],
      brief: { season: 'winter', maxLooks: 1 },
    });
    expect(looks[0].items.some((i) => i.slot === 'outerwear')).toBe(true);
  });

  it('respects budgetCusd and returns fewer looks rather than padding', () => {
    const { looks } = planOutfits({
      listings: [
        item('cheap-top', 'top', { priceCusd: 3 }),
        item('cheap-bottom', 'bottom', { priceCusd: 4 }),
        item('pricey-top', 'top', { priceCusd: 40 }),
        item('pricey-bottom', 'bottom', { priceCusd: 40 }),
      ],
      brief: { budgetCusd: 10, maxLooks: 5 },
    });
    expect(looks).toHaveLength(1);
    expect(looks[0].totalCusd).toBeLessThanOrEqual(10);
  });

  it('returns zero looks when inventory cannot form a combo', () => {
    expect(planOutfits({ listings: [casualTop], brief: {} }).looks).toHaveLength(0);
    expect(planOutfits({ listings: [], brief: {} }).looks).toHaveLength(0);
  });

  it('does not reuse items across looks when inventory allows', () => {
    const tops = [item('t1', 'top'), item('t2', 'top'), item('t3', 'top')];
    const bottoms = [item('b1', 'bottom'), item('b2', 'bottom'), item('b3', 'bottom')];
    const { looks } = planOutfits({
      listings: [...tops, ...bottoms],
      brief: { maxLooks: 3 },
    });
    expect(looks).toHaveLength(3);
    const allIds = looks.flatMap((l) => l.items.map((i) => i.listingId));
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it('prefers preferredListingId and reports curator slugs', () => {
    const { looks } = planOutfits({
      listings: [casualTop, casualBottom, formalTop, formalBottom],
      brief: { preferredListingId: 'shirt-1', maxLooks: 1 },
    });
    expect(looks[0].items.map((i) => i.listingId)).toContain('shirt-1');
    expect(looks[0].items[0].curatorSlug).toBe('zara');
  });

  it('supports cross-curator combos', () => {
    const { looks } = planOutfits({
      listings: [
        item('top-a', 'top', { curatorSlug: 'nia' }),
        item('bottom-b', 'bottom', { curatorSlug: 'zara' }),
      ],
      brief: { maxLooks: 1 },
    });
    const slugs = looks[0].items.map((i) => i.curatorSlug);
    expect(slugs).toEqual(expect.arrayContaining(['nia', 'zara']));
    expect(looks[0].items.map((i) => i.orderEndpoint))
      .toEqual(expect.arrayContaining(['/api/curator/nia/order', '/api/curator/zara/order']));
  });

  it('skips listings without attributes or price', () => {
    const bare = { listingId: 'bare-1', curatorSlug: 'zara', title: 'Mystery', priceCusd: 5, attributes: null };
    const noPrice = item('np-1', 'top', { priceCusd: 0 });
    const { looks } = planOutfits({ listings: [bare, noPrice, casualTop, casualBottom], brief: {} });
    expect(looks).toHaveLength(1);
    expect(looks[0].items.map((i) => i.listingId)).toEqual(['tee-1', 'jeans-1']);
  });
});
