import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import crypto from 'node:crypto';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);

const savedRedisUrl = process.env.REDIS_URL;
const savedDbUrl = process.env.NEON_DATABASE_URL;
const savedLinqMock = process.env.LINQ_MOCK;
delete process.env.REDIS_URL;
delete process.env.NEON_DATABASE_URL;
process.env.LINQ_MOCK = '1';
afterAll(() => {
  for (const [k, v] of [['REDIS_URL', savedRedisUrl], ['NEON_DATABASE_URL', savedDbUrl], ['LINQ_MOCK', savedLinqMock]]) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

const judge = require('../lib/runway/judge');
const photo = require('../lib/runway/photo');
const fix = require('../lib/runway/fix');
const router = require('./runway-api');

const origJudge = judge.judgeOutfit;
const origNormalise = photo.normaliseDataUrl;
const origFix = fix.findFix;

const OK_VERDICT = {
  ok: true,
  scores: { theme: 8, cohesion: 7, styling: 6 },
  total: 7.0,
  verdict: 'Sharp. Finally, intent.',
  fixHint: 'a long wool coat',
  fixTags: ['formal'],
  provider: 'venice',
  model: 'm',
};

const PID = crypto.randomUUID();
const PID2 = crypto.randomUUID();
const IMG = 'data:image/jpeg;base64,AAAA';

describe('runway web api', () => {
  let request;
  beforeAll(() => {
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/runway', router);
    request = supertest(app);
  });
  afterEach(() => {
    judge.judgeOutfit = origJudge;
    photo.normaliseDataUrl = origNormalise;
    fix.findFix = origFix;
  });

  it('GET /today returns theme, judges and the line number', async () => {
    const res = await request.get('/api/runway/today');
    expect(res.headers['cache-control']).toContain('max-age=300');
    expect(res.status).toBe(200);
    expect(res.body.theme.id).toBeTruthy();
    expect(res.body.judges.map((j) => j.key)).toEqual(['miranda', 'edina', 'shaft']);
    expect(res.body.phoneNumber).toMatch(/^\+/);
  });

  it('POST /rounds validates playerId is a UUID v4', async () => {
    expect((await request.post('/api/runway/rounds').send({ playerId: 'nope' })).status).toBe(400);
    expect((await request.post('/api/runway/rounds').send({})).status).toBe(400);
  });

  it('POST /rounds starts a round and POST photo judges it', async () => {
    judge.judgeOutfit = async () => ({ ...OK_VERDICT });
    photo.normaliseDataUrl = async (u) => u;
    fix.findFix = async () => ({ kind: 'look', title: 'Night Edit', imageUrl: null, url: 'https://web/look/n?sid=abc123&utm_source=direct', shareId: 'abc123' });

    const start = await request.post('/api/runway/rounds').send({ playerId: PID, judge: 'edina', themeId: 'villain-era' });
    expect(start.status).toBe(201);
    expect(start.body.theme.id).toBe('villain-era');
    expect(start.body.persona.key).toBe('edina');
    expect(start.body.messages).toHaveLength(2);
    expect(start.body.deadline).toBeGreaterThan(Date.now());

    const roundId = start.body.roundId;
    // wrong player / wrong round → 409
    expect((await request.post(`/api/runway/rounds/${roundId}/photo`).send({ playerId: PID2, photoData: IMG })).status).toBe(409);
    expect((await request.post('/api/runway/rounds/ffffffffffff/photo').send({ playerId: PID, photoData: IMG })).status).toBe(409);

    const judged = await request.post(`/api/runway/rounds/${roundId}/photo`).send({ playerId: PID, photoData: IMG });
    expect(judged.status).toBe(200);
    expect(judged.body.status).toBe('ok');
    expect(judged.body.result.total).toBe(7.0);
    expect(judged.body.fix.url).toContain('utm_source=direct');

    const result = await request.get(`/api/runway/results/${roundId}`);
    expect(result.headers['cache-control']).toContain('max-age=3600');
    expect(result.status).toBe(200);
    expect(result.body.total).toBe(7.0);
    expect(result.body.themeName).toBe('Villain Era');
    // no chat id leakage
    expect(JSON.stringify(result.body)).not.toContain('web:');
    expect(JSON.stringify(result.body)).not.toContain(PID);
  });

  it('refused photo returns 200 with persona message and keeps the round awaiting', async () => {
    judge.judgeOutfit = async () => ({ ok: false, reason: 'refused' });
    photo.normaliseDataUrl = async (u) => u;
    fix.findFix = async () => null;
    const start = await request.post('/api/runway/rounds').send({ playerId: PID2 });
    const res = await request.post(`/api/runway/rounds/${start.body.roundId}/photo`).send({ playerId: PID2, photoData: IMG });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('refused');
    expect(res.body.messages[0]).toBeTruthy();
    // same round can be retried
    expect((await request.post(`/api/runway/rounds/${start.body.roundId}/photo`).send({ playerId: PID2, photoData: IMG })).status).toBe(200);
  });

  it('GET /results 404s for unknown and malformed ids', async () => {
    expect((await request.get('/api/runway/results/abcdef012345')).status).toBe(404);
    expect((await request.get('/api/runway/results/nope')).status).toBe(404);
  });
});
