import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  newShareId,
  sanitizeShareId,
  sanitizeChannel,
  sanitizeCtaKind,
  hashVisitor,
  isSelfReferral,
  computeKFactor,
  MIN_SHARES_FOR_K,
} = require('./share-attribution');

describe('share id', () => {
  it('generates ids that pass sanitization', () => {
    const id = newShareId();
    expect(sanitizeShareId(id)).toBe(id);
  });
  it('rejects malformed input', () => {
    expect(sanitizeShareId('x')).toBeNull();
    expect(sanitizeShareId("'; drop table")).toBeNull();
    expect(sanitizeShareId(42)).toBeNull();
    expect(sanitizeShareId('ABCDEF123')).toBe('abcdef123');
  });
});

describe('channel / cta', () => {
  it('maps to the closed set', () => {
    expect(sanitizeChannel('WhatsApp')).toBe('whatsapp');
    expect(sanitizeChannel('x')).toBe('twitter');
    expect(sanitizeChannel('tiktok')).toBe('other');
    expect(sanitizeChannel(undefined)).toBe('direct');
  });
  it('validates cta kind', () => {
    expect(sanitizeCtaKind('tryon')).toBe('tryon');
    expect(sanitizeCtaKind('nope')).toBeNull();
  });
});

describe('hashVisitor', () => {
  const day1 = new Date('2026-10-08T10:00:00Z');
  const day2 = new Date('2026-10-09T10:00:00Z');
  it('is stable within a day and hides raw input', () => {
    const a = hashVisitor('1.2.3.4', 'UA', day1);
    expect(a).toBe(hashVisitor('1.2.3.4', 'UA', day1));
    expect(a).not.toContain('1.2.3.4');
  });
  it('does not link across days or visitors', () => {
    expect(hashVisitor('1.2.3.4', 'UA', day1)).not.toBe(hashVisitor('1.2.3.4', 'UA', day2));
    expect(hashVisitor('1.2.3.4', 'UA', day1)).not.toBe(hashVisitor('5.6.7.8', 'UA', day1));
  });
});

describe('isSelfReferral', () => {
  const addr = '0xAbCdEf0123456789aBcDeF0123456789abcdef01';
  it('detects code derived from the payer address', () => {
    expect(isSelfReferral({ referralCode: 'ref_abcdef01', payerAddress: addr })).toBe(true);
  });
  it('detects resolved agent address equal to payer', () => {
    expect(isSelfReferral({ referralCode: 'ref_zzz', agentAddress: addr.toLowerCase(), payerAddress: addr })).toBe(true);
  });
  it('allows genuine referrals and missing payer', () => {
    expect(isSelfReferral({ referralCode: 'ref_11111111', payerAddress: addr })).toBe(false);
    expect(isSelfReferral({ referralCode: 'ref_abcdef01' })).toBe(false);
  });
});

describe('computeKFactor', () => {
  it('reports insufficient data below the threshold', () => {
    const r = computeKFactor({ shares: 5, sharers: 2, activatedShares: 3, visitedShares: 4 });
    expect(r.status).toBe('insufficient_data');
    expect(r.k).toBeNull();
    expect(r.invitesPerSharer).toBe(2.5);
  });
  it('computes k = invites per sharer x activation', () => {
    const r = computeKFactor({ shares: 60, sharers: 20, activatedShares: 12, visitedShares: 30 });
    expect(r.status).toBe('measured');
    expect(r.invitesPerSharer).toBe(3);
    expect(r.conversion).toBe(0.2);
    expect(r.visitRate).toBe(0.5);
    expect(r.k).toBe(0.6);
  });
  it('handles zeros', () => {
    const r = computeKFactor({});
    expect(r.k).toBeNull();
    expect(MIN_SHARES_FOR_K).toBe(30);
  });
});

describe('summarizeShareFunnel', () => {
  const { summarizeShareFunnel } = require('./share-attribution');
  const row = (event_type, share_id, actor, extra = {}) => ({
    event_type, share_id, actor, look_slug: 'look-a', channel: 'whatsapp', ...extra,
  });

  it('builds stages, ignores self-activity and unknown share ids', () => {
    const rows = [
      row('look_share', 'aaaaaa', 'sharer1'),
      row('look_share', 'bbbbbb', 'sharer1', { channel: 'twitter' }),
      row('look_share', 'cccccc', 'sharer2'),
      row('look_visit', 'aaaaaa', 'v1'),
      row('look_visit', 'bbbbbb', 'sharer1'), // self visit -> ignored
      row('look_cta', 'aaaaaa', 'v1'),
      row('tryon_complete', 'cccccc', '0xbuyer'),
      row('purchase', 'cccccc', '0xbuyer'),
      row('look_cta', 'zzzzzz', 'v9'), // unknown share
      { event_type: 'look_cta', share_id: null, actor: 'v2' },
    ];
    const s = summarizeShareFunnel(rows);
    expect(s.overall).toMatchObject({
      shares: 3, sharers: 2, visits: 1, ctaClicks: 1, tryOns: 1, purchases: 1, activated: 2,
    });
    expect(s.overall.k.status).toBe('insufficient_data');
    const wa = s.byChannel.find((c) => c.key === 'whatsapp');
    expect(wa.shares).toBe(2);
    expect(s.byLook[0].key).toBe('look-a');
  });

  it('handles empty input', () => {
    const s = summarizeShareFunnel([]);
    expect(s.overall.shares).toBe(0);
    expect(s.byChannel).toEqual([]);
  });
});

describe('storefront stages', () => {
  const { summarizeShareFunnel, sanitizeStorefrontKind } = require('./share-attribution');
  const sf = (kind, share_id, actor) => ({
    event_type: 'look_storefront', kind, share_id, actor, look_slug: 'look-a', channel: 'twitter',
  });

  it('validates storefront kinds', () => {
    expect(sanitizeStorefrontKind('order')).toBe('order');
    expect(sanitizeStorefrontKind('hack')).toBeNull();
  });

  it('counts intent stages as activation but arrival alone is not', () => {
    const rows = [
      { event_type: 'look_share', share_id: 'aaaaaa', actor: 's1', look_slug: 'look-a', channel: 'twitter' },
      { event_type: 'look_share', share_id: 'bbbbbb', actor: 's1', look_slug: 'look-a', channel: 'twitter' },
      { event_type: 'look_share', share_id: 'cccccc', actor: 's2', look_slug: 'look-a', channel: 'twitter' },
      sf('arrive', 'aaaaaa', 'v1'),
      sf('arrive', 'bbbbbb', 'v2'),
      sf('tryon', 'bbbbbb', 'v2'),
      sf('order', 'cccccc', 'v3'),
      sf('buy', 'cccccc', 's2'), // self -> ignored
    ];
    const o = summarizeShareFunnel(rows).overall;
    expect(o).toMatchObject({
      shares: 3, storefrontArrivals: 2, storefrontTryOns: 1, storefrontBuys: 0, storefrontOrders: 1, activated: 2,
    });
  });
});

describe('confirmed sales and web try-ons', () => {
  const { summarizeShareFunnel, sanitizeLookSlug } = require('./share-attribution');
  it('validates look slugs', () => {
    expect(sanitizeLookSlug('Weekend-Street-Fit-n19o')).toBe('weekend-street-fit-n19o');
    expect(sanitizeLookSlug('a b')).toBeNull();
    expect(sanitizeLookSlug(5)).toBeNull();
  });

  it('counts server-recorded sales and web try-ons as activation', () => {
    const share = (id, actor) => ({ event_type: 'look_share', share_id: id, actor, look_slug: 'look-a', channel: 'whatsapp' });
    const rows = [
      share('aaaaaa', 's1'),
      share('bbbbbb', 's2'),
      share('cccccc', 's3'),
      { event_type: 'look_storefront', kind: 'sale', share_id: 'aaaaaa', actor: null, look_slug: 'look-a' },
      { event_type: 'tryon_complete', share_id: 'bbbbbb', actor: 'web-visitor', look_slug: 'look-a' },
      { event_type: 'tryon_complete', share_id: 'cccccc', actor: 's3' }, // sharer tried it themselves
    ];
    const o = summarizeShareFunnel(rows).overall;
    expect(o).toMatchObject({ shares: 3, confirmedSales: 1, tryOns: 1, activated: 2 });
  });
});
