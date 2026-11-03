import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);

const ROWS = [
  { eventType: 'runway_start', createdAt: new Date('2026-11-09T09:00:00Z'), metadata: { surface: 'web', roundId: 'r1', playerHash: 'p1' } },
  { eventType: 'runway_submit', createdAt: new Date('2026-11-09T09:01:00Z'), metadata: { surface: 'web', roundId: 'r1', playerHash: 'p1' } },
  { eventType: 'runway_verdict', createdAt: new Date('2026-11-09T09:02:00Z'), metadata: { surface: 'web', roundId: 'r1', playerHash: 'p1' } },
  { eventType: 'runway_share', createdAt: new Date('2026-11-09T09:03:00Z'), metadata: { surface: 'web', roundId: 'r1', channel: 'instagram', playerHash: 'p1' } },
  { eventType: 'runway_start', createdAt: new Date('2026-11-09T09:00:00Z'), metadata: { surface: 'imessage', roundId: 'rX', playerHash: 'pX' } },
];

const chain = {
  select: () => ({ from: () => ({ where: () => ({ limit: async () => ROWS }) }) }),
};

let dbImpl = chain;
const dbLib = require('../lib/db');
const origGetDb = dbLib.getDb;
dbLib.getDb = () => dbImpl;
const router = require('./runway-metrics');

describe('runway metrics route', () => {
  let request;
  beforeAll(() => {
    const app = express();
    app.use('/api/runway/metrics', router);
    request = supertest(app);
  });

  it('returns computed metrics filtered to the web surface', async () => {
    const res = await request.get('/api/runway/metrics?days=14');
    expect(res.status).toBe(200);
    expect(res.body.startedRounds).toBe(1); // imessage row filtered out
    expect(res.body.submittedRounds).toBe(1);
    expect(res.body.shares).toBe(1);
    expect(res.body.shareChannels).toEqual({ instagram: 1 });
    expect(res.body.players).toBe(1);
    expect(res.body.window.days).toBe(14);
  });

  it('clamps days to 1..60 and defaults to 14', async () => {
    expect((await request.get('/api/runway/metrics')).body.window.days).toBe(14);
    expect((await request.get('/api/runway/metrics?days=0')).body.window.days).toBe(14);
    expect((await request.get('/api/runway/metrics?days=-5')).body.window.days).toBe(1);
    expect((await request.get('/api/runway/metrics?days=999')).body.window.days).toBe(60);
  });

  it('500s when the db is unavailable', async () => {
    dbImpl = null;
    const res = await request.get('/api/runway/metrics');
    expect(res.status).toBe(500);
    dbImpl = chain;
  });
});
