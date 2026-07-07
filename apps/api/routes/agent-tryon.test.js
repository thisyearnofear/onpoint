import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./agent-tryon');
const { isValidPhotoData, recommendSize } = router.__test;

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
