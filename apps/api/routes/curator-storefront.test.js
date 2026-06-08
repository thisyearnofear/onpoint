import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./curator-storefront');
const { isValidSlug, firstAvailableSize, buildWhatsAppUrl, keyToUrl } = router.__test;

describe('curator-storefront helpers', () => {
  describe('isValidSlug', () => {
    it('accepts valid slugs', () => {
      expect(isValidSlug('wanja')).toBe(true);
      expect(isValidSlug('mo-jerseys')).toBe(true);
      expect(isValidSlug('abc123')).toBe(true);
      expect(isValidSlug('a'.repeat(48))).toBe(true);
    });

    it('rejects invalid slugs', () => {
      expect(isValidSlug('')).toBe(false);
      expect(isValidSlug('AB')).toBe(false);
      expect(isValidSlug('a b')).toBe(false);
      expect(isValidSlug('a'.repeat(49))).toBe(false);
      expect(isValidSlug('slug_123')).toBe(false);
    });
  });

  describe('firstAvailableSize', () => {
    it('returns first in-stock size', () => {
      const sizes = [
        { size: 'S', stock: 0, price: 100 },
        { size: 'M', stock: 5, price: 100 },
        { size: 'L', stock: 3, price: 100 },
      ];
      expect(firstAvailableSize(sizes)).toEqual(sizes[1]);
    });

    it('returns first size when none in stock', () => {
      const sizes = [
        { size: 'S', stock: 0, price: 100 },
        { size: 'M', stock: 0, price: 100 },
      ];
      expect(firstAvailableSize(sizes)).toEqual(sizes[0]);
    });

    it('returns null for empty or non-array input', () => {
      expect(firstAvailableSize([])).toBeNull();
      expect(firstAvailableSize(null)).toBeNull();
      expect(firstAvailableSize(undefined)).toBeNull();
    });
  });

  describe('keyToUrl', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      process.env = { ...OLD_ENV, R2_PUBLIC_URL: 'https://cdn.example.com' };
    });

    afterEach(() => {
      process.env = OLD_ENV;
    });

    it('converts a key to a full URL', () => {
      expect(keyToUrl('kits/arsenal-home.jpg')).toBe('https://cdn.example.com/kits/arsenal-home.jpg');
    });

    it('strips leading slashes from the key', () => {
      expect(keyToUrl('/kits/chelsea-away.jpg')).toBe('https://cdn.example.com/kits/chelsea-away.jpg');
    });

    it('returns null for null key', () => {
      expect(keyToUrl(null)).toBeNull();
    });
  });

  describe('buildWhatsAppUrl', () => {
    it('builds a deep link with default template', () => {
      const curator = {
        name: 'Wanja',
        channels: { whatsapp: '+254712345678' },
        commerce: {},
      };
      const listing = {
        kit: { club: 'Arsenal', kitType: 'home' },
        sizes: [{ size: 'M', stock: 3, price: 2500 }],
      };

      const url = buildWhatsAppUrl(curator, listing);
      expect(url).toContain('wa.me/254712345678');
      expect(url).toContain(encodeURIComponent('Arsenal'));
      expect(url).toContain(encodeURIComponent('home'));
      expect(url).toContain(encodeURIComponent('M'));
      expect(url).toContain(encodeURIComponent('2500'));
    });

    it('uses custom template when provided', () => {
      const curator = {
        name: 'Mo',
        channels: { whatsapp: '+254700000000' },
        commerce: { whatsappTemplate: 'Hey {curator}, want {club} {kit_type} size {size} KES {price}' },
      };
      const listing = {
        kit: { club: 'Chelsea', kitType: 'away' },
        sizes: [{ size: 'L', stock: 1, price: 3000 }],
      };

      const url = buildWhatsAppUrl(curator, listing);
      expect(url).toContain(encodeURIComponent('Hey Mo'));
      expect(url).toContain(encodeURIComponent('Chelsea'));
    });

    it('includes printing note when printing is available', () => {
      const curator = {
        name: 'Test',
        channels: { whatsapp: '+254700000000' },
        commerce: {},
      };
      const listing = {
        kit: { club: 'Test FC', kitType: 'home' },
        sizes: [{ size: 'M', stock: 1, price: 2500, printingAvailable: true, printingPrice: 500 }],
      };

      const url = buildWhatsAppUrl(curator, listing);
      expect(url).toContain(encodeURIComponent('Plain or printed?'));
      expect(url).toContain(encodeURIComponent('500'));
    });

    it('returns null when no WhatsApp number', () => {
      const curator = { name: 'Test', channels: {}, commerce: {} };
      const listing = {
        kit: { club: 'Test', kitType: 'home' },
        sizes: [{ size: 'M', stock: 1, price: 100 }],
      };

      expect(buildWhatsAppUrl(curator, listing)).toBeNull();
    });
  });
});

describe('curator-storefront HTTP endpoint', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    router.__test.reset();
  });

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('returns 400 for invalid slug (too short)', async () => {
    const app = express();
    app.use('/api/curator', router);

    const { default: supertest } = await import('supertest');
    const res = await supertest(app)
      .get('/api/curator/x/storefront')
      .expect(400);
    expect(res.body).toHaveProperty('error', 'Invalid curator slug');
  });

  it('returns 503 when NEON_DATABASE_URL is not set', async () => {
    delete process.env.NEON_DATABASE_URL;

    const app = express();
    app.use('/api/curator', router);

    const { default: supertest } = await import('supertest');
    const res = await supertest(app)
      .get('/api/curator/wanja/storefront')
      .expect(503);
    expect(res.body).toHaveProperty('error', 'Database not configured');
  });

  it('returns 500 when database query fails', async () => {
    process.env.NEON_DATABASE_URL = 'postgres://test:test@localhost:5432/test';

    const app = express();
    app.use('/api/curator', router);

    const { default: supertest } = await import('supertest');
    const res = await supertest(app)
      .get('/api/curator/nonexistent/storefront')
      .expect(500);
    expect(res.body).toHaveProperty('error', 'Failed to load storefront');
  });
});
