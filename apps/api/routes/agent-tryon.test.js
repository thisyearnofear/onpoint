import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./agent-tryon');
const { isValidPhotoData, recommendSize, inferGarmentCategory, ensureDataUri, getRenderCacheKey } = router.__test;

const PHOTO = `data:image/jpeg;base64,${'a'.repeat(100)}`;

describe('agent-tryon helpers', () => {
  describe('isValidPhotoData', () => {
    it('accepts png/jpeg/webp data URIs', () => {
      expect(isValidPhotoData('data:image/png;base64,abc')).toBe(true);
      expect(isValidPhotoData('data:image/jpeg;base64,abc')).toBe(true);
      expect(isValidPhotoData('data:image/jpg;base64,abc')).toBe(true);
      expect(isValidPhotoData('data:image/webp;base64,abc')).toBe(true);
    });

    it('rejects URLs, raw base64, other types, and oversized payloads', () => {
      expect(isValidPhotoData('https://example.com/photo.jpg')).toBe(false);
      expect(isValidPhotoData('iVBORw0KGgo=')).toBe(false);
      expect(isValidPhotoData('data:image/gif;base64,abc')).toBe(false);
      expect(isValidPhotoData(`data:image/png;base64,${'a'.repeat(8_000_001)}`)).toBe(false);
      expect(isValidPhotoData(null)).toBe(false);
    });
  });

  describe('recommendSize', () => {
    const sizes = [
      { size: 'S', stock: 2, price: 3000 },
      { size: 'M', stock: 0, price: 3000 },
      { size: 'L', stock: 5, price: 3000 },
    ];

    it('maps chest reading to a stocked size', () => {
      expect(recommendSize({ measurements: { chest: 'small' } }, sizes)).toBe('S');
      expect(recommendSize({ measurements: { chest: 'large' } }, sizes)).toBe('L');
    });

    it('falls to the nearest stocked size when the ideal is out of stock', () => {
      // chest medium → ideal M (stock 0) → nearest stocked is S or L (dist 1 each, S wins sort)
      const rec = recommendSize({ measurements: { chest: 'medium' } }, sizes);
      expect(['S', 'L']).toContain(rec);
    });

    it('uses bodyType when chest is missing', () => {
      expect(recommendSize({ bodyType: 'slim' }, sizes)).toBe('S');
      expect(recommendSize({ bodyType: 'plus-size' }, sizes)).toBe('L'); // XL not stocked → nearest
    });

    it('returns null with no signal or no stock', () => {
      expect(recommendSize({}, sizes)).toBeNull();
      expect(recommendSize({ measurements: { chest: 'medium' } }, [])).toBeNull();
      expect(recommendSize(null, sizes)).toBeNull();
    });
  });

  describe('inferGarmentCategory', () => {
    it('classifies sports kits as upper_body', () => {
      expect(inferGarmentCategory({ title: 'Arsenal Home Kit' }, { kitType: 'home' })).toBe('upper_body');
    });

    it('maps title keywords with full-body priority', () => {
      expect(inferGarmentCategory({ title: 'Jersey Dress — Nairobi Sunrise' }, null)).toBe('full_body');
      expect(inferGarmentCategory({ title: 'Ankara Shirt' }, null)).toBe('upper_body');
      expect(inferGarmentCategory({ title: 'Slim Jeans' }, null)).toBe('lower_body');
      expect(inferGarmentCategory({ title: 'Leather Boots' }, null)).toBe('shoes');
      expect(inferGarmentCategory({ title: 'Winter Jacket' }, null)).toBe('outer');
    });

    it('falls back to tags when the title has no hint', () => {
      expect(inferGarmentCategory({ title: 'Sunset Vibes', tags: ['dress', 'summer'] }, null)).toBe('full_body');
    });

    it('returns auto when nothing matches', () => {
      expect(inferGarmentCategory({ title: 'Mystery Item' }, null)).toBe('auto');
      expect(inferGarmentCategory({}, null)).toBe('auto');
    });

    it('does not match substrings inside unrelated words', () => {
      expect(inferGarmentCategory({ title: 'Guarantee' }, null)).toBe('auto');
    });
  });

  describe('ensureDataUri', () => {
    it('passes data URIs through unchanged', async () => {
      await expect(ensureDataUri('data:image/png;base64,AAA')).resolves.toBe('data:image/png;base64,AAA');
    });

    it('wraps raw base64 as a JPEG data URI', async () => {
      await expect(ensureDataUri('AAA')).resolves.toBe('data:image/jpeg;base64,AAA');
    });

    it('fetches URLs and converts them to data URIs', async () => {
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
      }));
      try {
        await expect(ensureDataUri('https://example.com/render.png'))
          .resolves.toBe('data:image/png;base64,AQID');
      } finally {
        globalThis.fetch = originalFetch;
      }
    });

    it('throws on empty input and failed fetches', async () => {
      await expect(ensureDataUri('')).rejects.toThrow();
      const originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404 }));
      try {
        await expect(ensureDataUri('https://example.com/missing.png')).rejects.toThrow(/404/);
      } finally {
        globalThis.fetch = originalFetch;
      }
    });
  });

  describe('getRenderCacheKey', () => {
    it('is stable for identical inputs', () => {
      expect(getRenderCacheKey(PHOTO, 'listing-1')).toBe(getRenderCacheKey(PHOTO, 'listing-1'));
    });

    it('distinguishes photos that share their first 1000 characters', () => {
      const prefix = 'data:image/jpeg;base64,' + 'a'.repeat(1000);
      const keyA = getRenderCacheKey(prefix + 'AAA', 'listing-1');
      const keyB = getRenderCacheKey(prefix + 'BBB', 'listing-1');
      expect(keyA).not.toBe(keyB);
    });

    it('changes when the provider chain changes', () => {
      const savedReplicate = process.env.REPLICATE_API_TOKEN;
      const savedYoucam = process.env.YOUCAM_API_KEY;
      try {
        delete process.env.YOUCAM_API_KEY;
        delete process.env.REPLICATE_API_TOKEN;
        const bareKey = getRenderCacheKey(PHOTO, 'listing-1');
        process.env.REPLICATE_API_TOKEN = 'test-token';
        expect(getRenderCacheKey(PHOTO, 'listing-1')).not.toBe(bareKey);
        process.env.YOUCAM_API_KEY = 'test-key';
        expect(getRenderCacheKey(PHOTO, 'listing-1')).not.toBe(bareKey);
      } finally {
        if (savedReplicate === undefined) delete process.env.REPLICATE_API_TOKEN;
        else process.env.REPLICATE_API_TOKEN = savedReplicate;
        if (savedYoucam === undefined) delete process.env.YOUCAM_API_KEY;
        else process.env.YOUCAM_API_KEY = savedYoucam;
      }
    });
  });
});

describe('POST /api/agent/try-on validation', () => {
  function makeApp() {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/agent/try-on', router);
    return app;
  }

  it('requires a valid curatorSlug', async () => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp())
      .post('/api/agent/try-on')
      .send({ curatorSlug: 'X', listingId: 'abc', photoData: PHOTO })
      .expect(400);
    expect(res.body.error).toMatch(/curatorSlug/);
  });

  it('requires listingId', async () => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp())
      .post('/api/agent/try-on')
      .send({ curatorSlug: 'wanja', photoData: PHOTO })
      .expect(400);
    expect(res.body.error).toMatch(/listingId/);
  });

  it('requires a data-URI photo', async () => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp())
      .post('/api/agent/try-on')
      .send({ curatorSlug: 'wanja', listingId: 'abc', photoData: 'https://x.com/p.jpg' })
      .expect(400);
    expect(res.body.error).toMatch(/photoData/);
  });

  it('rejects a malformed paymentTxHash', async () => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp())
      .post('/api/agent/try-on')
      .send({ curatorSlug: 'wanja', listingId: 'abc', photoData: PHOTO, paymentTxHash: '0xnope' })
      .expect(400);
    expect(res.body.error).toMatch(/paymentTxHash/);
  });
});
