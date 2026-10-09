import { createRequire } from 'node:module';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);

// The router destructures its dependencies at load time, so stub the CommonJS
// modules in the native require cache before loading it.
const state = { inserted: [], insertResult: [], existing: [], funnel: [] };

function makeDb() {
  return {
    insert: () => ({
      values: (v) => {
        state.inserted.push(v);
        return { onConflictDoNothing: () => ({ returning: async () => state.insertResult }) };
      },
    }),
    select: () => ({ from: () => ({ where: () => ({ limit: async () => state.existing }) }) }),
  };
}

const stubbed = ['../lib/db', '../lib/funnel'];
const exportsFor = {
  '../lib/db': () => ({ getDb: () => makeDb() }),
  '../lib/funnel': () => ({ logFunnelEvent: (_db, event) => state.funnel.push(event) }),
};
let router;

beforeAll(() => {
  for (const rel of stubbed) {
    const id = require.resolve(rel);
    require.cache[id] = { id, filename: id, loaded: true, exports: exportsFor[rel]() };
  }
  delete require.cache[require.resolve('./fulfillment')];
  router = require('./fulfillment');
});

afterAll(() => {
  for (const rel of stubbed) delete require.cache[require.resolve(rel)];
  delete require.cache[require.resolve('./fulfillment')];
});

beforeEach(() => {
  state.inserted = [];
  state.insertResult = [{ id: 'order-1' }];
  state.existing = [{ id: 'order-0' }];
  state.funnel = [];
});

function app() {
  const a = express();
  a.use(express.json());
  a.use('/api/orders', router);
  return a;
}

const base = {
  curatorSlug: 'wanja',
  listingId: '29b45db3-9a81-4ede-aeb6-971796b7afc8',
  size: 'M',
  amountKes: 3000,
  mpesaReceipt: 'SGH61XXXXX',
};

async function post(body) {
  const { default: supertest } = await import('supertest');
  return supertest(app()).post('/api/orders/record').send(body);
}

describe('POST /api/orders/record attribution', () => {
  it('records one confirmed sale for a valid share, only on a fresh insert', async () => {
    const res = await post({ ...base, shareId: 'a1b2c3d4e5f6', lookSlug: 'weekend-fit-n19o' }).then((r) => r);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ success: true, orderId: 'order-1' });
    expect(state.funnel).toHaveLength(1);
    expect(state.funnel[0]).toMatchObject({
      eventType: 'look_storefront',
      metadata: { kind: 'sale', shareId: 'a1b2c3d4e5f6', lookSlug: 'weekend-fit-n19o', orderId: 'order-1', rail: 'mpesa' },
    });
  });

  it('does not double count a callback retry (receipt already ledgered)', async () => {
    state.insertResult = []; // onConflictDoNothing inserted nothing
    const res = await post({ ...base, shareId: 'a1b2c3d4e5f6', lookSlug: 'weekend-fit-n19o' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, idempotent: true, orderId: 'order-0' });
    expect(state.funnel).toHaveLength(0);
  });

  it('ignores an invalid share id or missing look slug without failing the order', async () => {
    expect((await post({ ...base, shareId: "x'; drop", lookSlug: 'weekend-fit-n19o' })).status).toBe(201);
    expect((await post({ ...base, mpesaReceipt: 'B', shareId: 'a1b2c3d4e5f6' })).status).toBe(201);
    expect(state.funnel).toHaveLength(0);
  });

  it('stores a valid referral code on the order for attribution', async () => {
    await post({ ...base, referralCode: 'ref_abcdef01' });
    expect(state.inserted[0].referralCode).toBe('ref_abcdef01');
  });

  it('drops a malformed referral code instead of storing it', async () => {
    await post({ ...base, referralCode: "ref_abc'; DROP TABLE orders;--" });
    expect(state.inserted[0].referralCode).toBeNull();
  });

  it('never creates a commission row (attribution only)', async () => {
    await post({ ...base, referralCode: 'ref_abcdef01' });
    // The stubbed db exposes only insert().values() for the order itself.
    expect(state.inserted).toHaveLength(1);
    expect(state.inserted[0]).not.toHaveProperty('commissionCusd');
  });
});
