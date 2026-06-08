import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import supertest from 'supertest';

const require = createRequire(import.meta.url);

// ── Auth Middleware Tests ──

describe('signer — auth middleware', () => {
  let request;
  let signer;
  const TEST_KEY = 'test-signer-key-abc123';

  beforeAll(async () => {
    process.env.SIGNER_API_KEY = TEST_KEY;
    process.env.AGENT_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    // Re-require with fresh env
    delete require.cache[require.resolve('./signer')];
    signer = require('./signer');
    await signer.initialize();
    request = supertest(signer.app);
  });

  afterAll(() => {
    delete process.env.SIGNER_API_KEY;
    delete process.env.AGENT_PRIVATE_KEY;
  });

  it('rejects requests without x-signer-key', async () => {
    const res = await request.get('/health');
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('MISSING_SIGNER_KEY');
  });

  it('rejects requests with wrong x-signer-key', async () => {
    const res = await request.get('/health').set('x-signer-key', 'wrong-key');
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('INVALID_SIGNER_KEY');
  });

  it('accepts requests with correct x-signer-key', async () => {
    const res = await request.get('/health').set('x-signer-key', TEST_KEY);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('running');
  });
});

describe('signer — health endpoint', () => {
  let request;
  let signer;
  const TEST_KEY = 'test-signer-key-abc123';

  beforeAll(async () => {
    process.env.SIGNER_API_KEY = TEST_KEY;
    process.env.AGENT_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    delete require.cache[require.resolve('./signer')];
    signer = require('./signer');
    await signer.initialize();
    request = supertest(signer.app);
  });

  afterAll(() => {
    delete process.env.SIGNER_API_KEY;
    delete process.env.AGENT_PRIVATE_KEY;
  });

  it('returns signer health shape', async () => {
    const res = await request.get('/health').set('x-signer-key', TEST_KEY);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: 'running',
      process: 'onpoint-signer',
    });
    expect(res.body.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });
});

describe('signer — helper functions', () => {
  beforeAll(() => {
    process.env.AGENT_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  });

  afterAll(() => {
    delete process.env.AGENT_PRIVATE_KEY;
  });

  it('getChainModule returns a chain object for known chains', () => {
    delete require.cache[require.resolve('./signer')];
    const signer = require('./signer');
    const celo = signer.getChainModule('celo');
    expect(celo).toBeDefined();
    expect(celo.id).toBe(42220);
  });

  it('getChainModule returns celo for unknown chain', () => {
    const signer = require('./signer');
    const chain = signer.getChainModule('unknown');
    expect(chain.id).toBe(42220);
  });

  it('getRpcUrl returns celo for unknown chain', () => {
    const signer = require('./signer');
    expect(signer.getRpcUrl('unknown')).toBe('https://forno.celo.org');
  });

  it('getExplorerUrlForChain returns celoscan for unknown chain', () => {
    const signer = require('./signer');
    expect(signer.getExplorerUrlForChain('unknown', '0xabc')).toContain('celoscan.io');
  });

  it('getExplorerUrlForChain returns basescan for base', () => {
    const signer = require('./signer');
    expect(signer.getExplorerUrlForChain('base', '0xdef')).toContain('basescan.org');
  });

  it('ERC20_ABI has transfer function', () => {
    const signer = require('./signer');
    const transfer = signer.ERC20_ABI.find((f) => f.name === 'transfer');
    expect(transfer).toBeDefined();
  });
});

describe('signer — mint field validation', () => {
  let request;
  const TEST_KEY = 'test-signer-key-abc123';

  beforeAll(async () => {
    process.env.SIGNER_API_KEY = TEST_KEY;
    process.env.AGENT_PRIVATE_KEY = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    delete require.cache[require.resolve('./signer')];
    const signer = require('./signer');
    await signer.initialize();
    request = supertest(signer.app);
  });

  afterAll(() => {
    delete process.env.SIGNER_API_KEY;
    delete process.env.AGENT_PRIVATE_KEY;
  });

  it('rejects /sign/mint with missing fields', async () => {
    const res = await request
      .post('/sign/mint')
      .set('x-signer-key', TEST_KEY)
      .send({ chain: 'celo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('rejects /sign/transfer with missing fields', async () => {
    const res = await request
      .post('/sign/transfer')
      .set('x-signer-key', TEST_KEY)
      .send({ chain: 'celo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });

  it('rejects /sign/contract with missing fields', async () => {
    const res = await request
      .post('/sign/contract')
      .set('x-signer-key', TEST_KEY)
      .send({ chain: 'celo' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('MISSING_FIELDS');
  });
});
