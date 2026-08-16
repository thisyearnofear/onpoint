import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);
const router = require('./curator-admin');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/admin/curators', router);
  return app;
}

describe('curator-admin inventory verification', () => {
  const savedDbUrl = process.env.NEON_DATABASE_URL;

  beforeEach(() => {
    delete process.env.NEON_DATABASE_URL;
  });

  afterEach(() => {
    if (savedDbUrl === undefined) delete process.env.NEON_DATABASE_URL;
    else process.env.NEON_DATABASE_URL = savedDbUrl;
  });

  it('validates the curator slug before touching the database', async () => {
    const response = await supertest(makeApp())
      .post('/api/admin/curators/!/listings/12345678/verify')
      .expect(400);

    expect(response.body).toEqual({ error: 'Invalid curator slug' });
  });

  it('validates the listing id before touching the database', async () => {
    const response = await supertest(makeApp())
      .post('/api/admin/curators/wanja/listings/short/verify')
      .expect(400);

    expect(response.body).toEqual({ error: 'Invalid listing ID' });
  });

  it('fails closed when the database is not configured', async () => {
    const response = await supertest(makeApp())
      .post('/api/admin/curators/wanja/listings/12345678/verify')
      .expect(503);

    expect(response.body).toEqual({ error: 'Database not configured' });
  });
});
