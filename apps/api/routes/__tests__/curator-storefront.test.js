/**
 * Curator Storefront Route Tests
 *
 * Tests the exported utility functions and route-level error handling.
 *
 * Route-level tests (400 invalid slug, 503 no DB) work without a real
 * database by manipulating NEON_DATABASE_URL. Full integration tests
 * (404 unknown slug, 500 DB errors) require a real DB and are skipped
 * when the env var is not set.
 *
 * Utility function tests don't touch the database at all.
 */

import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);

// ── Route-Level Tests (env-based DB mocking) ──

describe('curator-storefront — route error handling', () => {
  let request;
  let savedDbUrl;

  beforeAll(() => {
    // Temporarily unset NEON_DATABASE_URL so getDb throws naturally
    savedDbUrl = process.env.NEON_DATABASE_URL;
    delete process.env.NEON_DATABASE_URL;

    delete require.cache[require.resolve('../curator-storefront')];
    const storefront = require('../curator-storefront');

    const app = express();
    app.use(express.json({ limit: '1kb' }));
    app.use('/api/curator', storefront);
    request = supertest(app);
  });

  afterAll(() => {
    if (savedDbUrl) process.env.NEON_DATABASE_URL = savedDbUrl;
  });

  it('returns 400 for invalid slug (validation before DB call)', async () => {
    const res = await request.get('/api/curator/!!invalid!!/storefront');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid curator slug');
  });

  it('returns 503 when DB is not configured', async () => {
    const res = await request.get('/api/curator/wanja/storefront');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('Database not configured');
  });

  it('returns 503 for directory endpoint when DB is not configured', async () => {
    const res = await request.get('/api/curator/directory');
    expect(res.status).toBe(503);
    expect(res.body.error).toContain('Database not configured');
  });

  it('returns 400 for invalid slug on earnings endpoint', async () => {
    const res = await request.get('/api/curator/!/earnings');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid curator slug');
  });

  it('returns 400 for missing listingId on order endpoint', async () => {
    const res = await request
      .post('/api/curator/wanja/order')
      .send({ size: 'M' }); // missing listingId
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('listingId is required');
  });

  it('returns 400 for invalid paymentTxHash on order endpoint', async () => {
    const res = await request
      .post('/api/curator/wanja/order')
      .send({
        listingId: 'abc-123',
        size: 'M',
        paymentTxHash: 'not-a-hash',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('paymentTxHash must be a 0x-prefixed');
  });
});

// ── Utility Function Tests ──

describe('curator-storefront — utility functions', () => {
  let storefront;

  beforeAll(() => {
    delete require.cache[require.resolve('../curator-storefront')];
    storefront = require('../curator-storefront');
  });

  afterAll(() => {
    if (storefront?.__test?.reset) storefront.__test.reset();
  });

  describe('firstAvailableSize', () => {
    it('returns the first size with stock > 0', () => {
      const sizes = [
        { size: 'S', stock: 0, price: 100 },
        { size: 'M', stock: 3, price: 150 },
        { size: 'L', stock: 1, price: 200 },
      ];
      expect(storefront.__test.firstAvailableSize(sizes)).toEqual({
        size: 'M',
        stock: 3,
        price: 150,
      });
    });

    it('falls back to the first size when none have stock', () => {
      const sizes = [
        { size: 'S', stock: 0, price: 100 },
        { size: 'M', stock: 0, price: 150 },
      ];
      expect(storefront.__test.firstAvailableSize(sizes)).toEqual({
        size: 'S',
        stock: 0,
        price: 100,
      });
    });

    it('returns null for empty array', () => {
      expect(storefront.__test.firstAvailableSize([])).toBeNull();
    });

    it('returns null for non-array input', () => {
      expect(storefront.__test.firstAvailableSize(null)).toBeNull();
      expect(storefront.__test.firstAvailableSize(undefined)).toBeNull();
    });
  });

  describe('isValidSlug', () => {
    it('accepts simple alphanumeric slugs', () => {
      expect(storefront.__test.isValidSlug('wanja')).toBe(true);
      expect(storefront.__test.isValidSlug('nia')).toBe(true);
      expect(storefront.__test.isValidSlug('amara-ankara')).toBe(true);
    });

    it('rejects empty slugs', () => {
      expect(storefront.__test.isValidSlug('')).toBe(false);
    });

    it('rejects slugs with special characters', () => {
      expect(storefront.__test.isValidSlug('wanja!')).toBe(false);
      expect(storefront.__test.isValidSlug('<script>')).toBe(false);
    });
  });

  describe('buildWhatsAppUrl', () => {
    const mockCurator = {
      name: 'Wanja',
      channels: { whatsapp: '+254712345678' },
      commerce: {},
    };

    it('returns null when curator has no whatsapp number', () => {
      expect(
        storefront.__test.buildWhatsAppUrl({ name: 'Test', channels: {} }, {}),
      ).toBeNull();
    });

    it('builds a wa.me deep link with order template', () => {
      const listing = {
        kit: { club: 'Arsenal', kitType: 'home' },
        sizes: [{ size: 'M', stock: 1, price: 2500 }],
      };
      const url = storefront.__test.buildWhatsAppUrl(mockCurator, listing);
      expect(url).toContain('wa.me/254712345678');
      expect(url).toContain(encodeURIComponent('Arsenal'));
      expect(url).toContain(encodeURIComponent('home'));
      expect(url).toContain(encodeURIComponent('M'));
      expect(url).toContain(encodeURIComponent('2500'));
    });

    it('uses curator-specific whatsappTemplate when available', () => {
      const curator = {
        ...mockCurator,
        commerce: {
          whatsappTemplate: 'Order: {club} {kit_type}',
        },
      };
      const listing = {
        kit: { club: 'Chelsea', kitType: 'away' },
        sizes: [{ size: 'L', stock: 1, price: 3000 }],
      };
      const url = storefront.__test.buildWhatsAppUrl(curator, listing);
      expect(url).toContain(encodeURIComponent('Order: Chelsea away'));
    });

    it('includes printing notice when printing is available', () => {
      const curator = { ...mockCurator };
      const listing = {
        kit: { club: 'Arsenal', kitType: 'home' },
        sizes: [
          {
            size: 'M',
            stock: 1,
            price: 2500,
            printingAvailable: true,
            printingPrice: 500,
          },
        ],
      };
      const url = storefront.__test.buildWhatsAppUrl(curator, listing);
      expect(url).toContain('printed%3F');
      expect(url).toContain('Plain');
      expect(url).toContain('Printing%20fee');
    });
  });

  describe('keyToUrl', () => {
    it('returns null for null or undefined keys', () => {
      expect(storefront.__test.keyToUrl(null)).toBeNull();
      expect(storefront.__test.keyToUrl(undefined)).toBeNull();
    });

    it('returns a URL string for a valid key when R2_PUBLIC_URL is set', () => {
      const url = storefront.__test.keyToUrl('listings/abc123/photo.jpg');
      if (process.env.R2_PUBLIC_URL) {
        expect(url).toContain('listings/abc123/photo.jpg');
      } else {
        expect(url).toBeNull();
      }
    });
  });
});
