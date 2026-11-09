/**
 * Pair Card Route Tests
 *
 * Unit-tests the exported validators and route-level input handling.
 * Render/DB paths need a real database + provider keys and are not covered.
 */

import { describe, expect, it, beforeAll } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);
const pair = require('../pair');

let request;

beforeAll(() => {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/pair', pair);
  request = supertest(app);
});

describe('pair — input validation', () => {
  it('rejects a create without personPhotoData', async () => {
    const res = await request.post('/api/pair').send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/personPhotoData/);
  });

  it('rejects a create with a non-image personPhotoData', async () => {
    const res = await request.post('/api/pair').send({ personPhotoData: 'not-an-image' });
    expect(res.status).toBe(400);
  });

  it('rejects join on a malformed pair id', async () => {
    const res = await request.post('/api/pair/not-a-uuid/join').send({ personPhotoData: 'data:image/png;base64,AA==' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid pair id/);
  });

  it('rejects read on a malformed pair id', async () => {
    const res = await request.get('/api/pair/not-a-uuid');
    expect(res.status).toBe(400);
  });
});

describe('pair — isPhotoData', () => {
  const { isPhotoData, ID_RE } = pair.__test;

  it('accepts data:image URIs under the size cap', () => {
    expect(isPhotoData('data:image/jpeg;base64,AAAA')).toBe(true);
    expect(isPhotoData('data:image/png;base64,AAAA')).toBe(true);
    expect(isPhotoData('data:image/webp;base64,AAAA')).toBe(true);
  });

  it('rejects non-data-URI and oversized payloads', () => {
    expect(isPhotoData('https://example.com/x.jpg')).toBe(false);
    expect(isPhotoData('data:application/pdf;base64,AAAA')).toBe(false);
    expect(isPhotoData(null)).toBe(false);
    expect(isPhotoData(`data:image/jpeg;base64,${'A'.repeat(8_000_001)}`)).toBe(false);
  });

  it('validates uuid-shaped pair ids', () => {
    expect(ID_RE.test('123e4567-e89b-42d3-a456-426614174000')).toBe(true);
    expect(ID_RE.test('')).toBe(false);
    expect(ID_RE.test("'; DROP TABLE")).toBe(false);
  });
});
