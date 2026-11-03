import { describe, it, expect } from 'vitest';

const { STYLE_OUTFITS, pickStyleFix } = require('./style-board');

describe('pickStyleFix', () => {
  it('matches on theme tags', () => {
    const theme = { id: 'denim-on-denim', tags: ['casual', 'vintage', 'streetwear'] };
    const pick = pickStyleFix({ theme });
    expect(pick).toBeTruthy();
    const score = pick.tags.filter((t) => theme.tags.includes(t)).length;
    const best = Math.max(...STYLE_OUTFITS.map((o) => o.tags.filter((t) => theme.tags.includes(t)).length));
    expect(score).toBe(best);
  });

  it('considers fixTags too', () => {
    const theme = { id: 'freestyle', tags: [] };
    const pick = pickStyleFix({ theme, fixTags: ['party', 'formal'] });
    expect(pick.tags.some((t) => t === 'party' || t === 'formal')).toBe(true);
  });

  it('is deterministic for a given theme + day and returns an outfit for tagless themes', () => {
    const theme = { id: 'ankara-modern', tags: ['ankara', 'african', 'event'] };
    const day = Date.UTC(2026, 0, 15);
    const a = pickStyleFix({ theme, now: day });
    const b = pickStyleFix({ theme, now: day });
    expect(a.id).toBe(b.id);
    expect(a).toBeTruthy();
  });
});
