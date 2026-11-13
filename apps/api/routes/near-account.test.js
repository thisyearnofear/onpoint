import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);

const dbModule = require('../lib/db');
let currentDb = null;
dbModule.getDb = () => {
  if (!currentDb) throw new Error('db not set');
  return currentDb;
};

const { issueSessionToken } = require('../lib/agent-session');
const negotiateRouter = require('./agent-negotiate');

function q(result) {
  const node = {
    then: (res, rej) => Promise.resolve(result).then(res, rej),
    limit: () => q(result),
    returning: () => q(result),
    set: () => q(result),
  };
  for (const m of ['from', 'where', 'values']) node[m] = () => q(result);
  return node;
}

const OWNER = '0xabc0000000000000000000000000000000000001';
const CURATOR = {
  slug: 'meridian',
  name: 'Meridian Goods',
  type: 'human',
  commerce: { walletAddress: OWNER },
};

const app = express();
app.use(express.json());
app.use('/api/curator', negotiateRouter);

const realFetch = globalThis.fetch;
const NEAR_RPC = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';
let rpcHandler = () => ({ result: { amount: '1', block_hash: 'x', block_height: 1 } });

vi.stubGlobal('fetch', (url, init) =>
  url === NEAR_RPC
    ? Promise.resolve(new Response(JSON.stringify({ jsonrpc: '2.0', id: 'x', ...rpcHandler() })))
    : realFetch(url, init),
);

async function post(path, body, headers = {}) {
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const res = await realFetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
}

const ownerHeaders = () => ({ authorization: `Bearer ${issueSessionToken(OWNER).token}` });

describe('POST /api/curator/:slug/near-account', () => {
  beforeEach(() => {
    currentDb = { select: () => q([CURATOR]), update: () => q([{ slug: 'meridian' }]) };
    delete process.env.SERVICE_API_KEY;
    rpcHandler = () => ({ result: { amount: '1' } });
  });

  it('binds a sovereign account for the owner wallet session', async () => {
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'meridian-goods.testnet' }, ownerHeaders());
    expect(r.status).toBe(200);
    expect(r.body.nearAccountId).toBe('meridian-goods.testnet');
    expect(r.body.sovereign).toBe(true);
    expect(r.body.auth).toBe('curator-wallet');
  });

  it('rejects onpoint.* accounts for session auth — hosted payee is provably non-sovereign', async () => {
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'store.onpoint.testnet' }, ownerHeaders());
    expect(r.status).toBe(403);
  });

  it('rejects a wallet that does not own the storefront', async () => {
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'meridian-goods.testnet' },
      { authorization: `Bearer ${issueSessionToken('0x9999999999999999999999999999999999999999').token}` });
    expect(r.status).toBe(403);
  });

  it('requires auth', async () => {
    const r = await post('/api/curator/meridian/near-account', { nearAccountId: 'meridian-goods.testnet' });
    expect(r.status).toBe(401);
  });

  it('service key may bind a hosted onpoint.* account (ops seeding)', async () => {
    process.env.SERVICE_API_KEY = 'svc-test-key';
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'store.onpoint.testnet' }, { 'x-service-key': 'svc-test-key' });
    expect(r.status).toBe(200);
    expect(r.body.sovereign).toBe(false);
    expect(r.body.auth).toBe('service');
  });

  it('404s when the account does not exist on-chain', async () => {
    rpcHandler = () => ({ error: { cause: { name: 'UNKNOWN_ACCOUNT' }, data: 'does not exist' } });
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'ghost-merchant.testnet' }, ownerHeaders());
    expect(r.status).toBe(404);
  });

  it('rejects malformed account ids', async () => {
    const r = await post('/api/curator/meridian/near-account',
      { nearAccountId: 'Bad Account!' }, ownerHeaders());
    expect(r.status).toBe(400);
  });
});
