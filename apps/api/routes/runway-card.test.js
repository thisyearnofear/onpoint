import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import express from 'express';
import supertest from 'supertest';

const require = createRequire(import.meta.url);

const savedRedisUrl = process.env.REDIS_URL;
const savedLinqMock = process.env.LINQ_MOCK;
delete process.env.REDIS_URL;
process.env.LINQ_MOCK = '1';
afterAll(() => {
  if (savedRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = savedRedisUrl;
  if (savedLinqMock === undefined) delete process.env.LINQ_MOCK;
  else process.env.LINQ_MOCK = savedLinqMock;
});

const state = require('../lib/runway/state');
const router = require('./runway-card');

const RESULT = {
  roundId: 'a1b2c3d4e5f6',
  themeId: 'villain-era',
  themeName: 'Villain Era',
  persona: 'miranda',
  scores: { theme: 8, cohesion: 7, styling: 6 },
  total: 7.0,
  verdict: 'Sharp shoulders. Finally, intent.',
  fixHint: 'a long wool coat',
  fix: { title: 'Night Edit', url: 'https://onpoint.trustfall.xyz/look/night-edit?sid=abc123def456&utm_source=imessage' },
  late: false,
  provider: 'venice',
  createdAt: Date.now(),
};

describe('runway card routes', () => {
  let request;
  beforeAll(async () => {
    await state.saveResult(RESULT.roundId, RESULT);
    const app = express();
    app.use('/runway/card', router);
    request = supertest(app);
  });

  it('renders a PNG for a stored result', async () => {
    const res = await request.get(`/runway/card/${RESULT.roundId}.png`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['cache-control']).toContain('max-age=3600');
    expect(res.body.length).toBeGreaterThan(1000);
  });

  it('404s for an unknown round and malformed png id', async () => {
    expect((await request.get('/runway/card/f6e5d4c3b2a1.png')).status).toBe(404);
    expect((await request.get('/runway/card/nothex!.png')).status).toBe(400);
  });

  it('redirects the HTML route to the web share page', async () => {
    const res = await request.get(`/runway/card/${RESULT.roundId}`);
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(`/runway/r/${RESULT.roundId}`);
  });

  it('404s for malformed html id', async () => {
    expect((await request.get('/runway/card/zzz')).status).toBe(404);
  });
});
