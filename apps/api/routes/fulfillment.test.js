import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./fulfillment');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/orders', router);
  return app;
}

describe('POST /api/orders/record validation', () => {
  const valid = {
    curatorSlug: 'wanja',
    listingId: '29b45db3-9a81-4ede-aeb6-971796b7afc8',
    size: 'M',
    amountKes: 3000,
    mpesaReceipt: 'SGH61XXXXX',
  };

  it.each([
    [{ ...valid, curatorSlug: undefined }, /curatorSlug/],
    [{ ...valid, listingId: undefined }, /listingId/],
    [{ ...valid, size: undefined }, /size/],
    [{ ...valid, mpesaReceipt: undefined }, /mpesaReceipt/],
    [{ ...valid, amountKes: 0 }, /amountKes/],
    [{ ...valid, amountKes: 'free' }, /amountKes/],
    [{ ...valid, source: 'agent' }, /source/],
    [{ ...valid, quantity: 0 }, /quantity/],
    [{ ...valid, quantity: 99 }, /quantity/],
  ])('rejects invalid body %#', async (body, pattern) => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp()).post('/api/orders/record').send(body).expect(400);
    expect(res.body.error).toMatch(pattern);
  });

  it('rejects an overlong mpesaReceipt', async () => {
    const { default: supertest } = await import('supertest');
    const res = await supertest(makeApp())
      .post('/api/orders/record')
      .send({ ...valid, mpesaReceipt: 'X'.repeat(41) })
      .expect(400);
    expect(res.body.error).toMatch(/mpesaReceipt/);
  });
});
