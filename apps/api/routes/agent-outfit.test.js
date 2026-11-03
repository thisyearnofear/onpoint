import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import express from 'express';

const require = createRequire(import.meta.url);
const router = require('./agent-outfit');
const { validateBrief } = router.__test;

const app = express();
app.use(express.json());
app.use('/api/agent/outfit', router);

async function post(body) {
  const server = app.listen(0);
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/outfit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { status: res.status, json: await res.json() };
  } finally {
    server.close();
  }
}

describe('validateBrief', () => {
  it('accepts an empty or well-formed brief', () => {
    expect(validateBrief({}).errors).toEqual([]);
    expect(validateBrief({
      occasion: 'formal',
      season: 'winter',
      weather: { tempC: 5, rain: true },
      budgetCusd: 25,
      preferredListingId: 'abc',
      maxLooks: 2,
      curatorSlug: 'nia',
    }).errors).toEqual([]);
  });

  it('rejects malformed fields', () => {
    expect(validateBrief(null).errors.length).toBeGreaterThan(0);
    expect(validateBrief([]).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ maxLooks: 0 }).errors).toContain('maxLooks must be an integer between 1 and 5');
    expect(validateBrief({ maxLooks: 9 }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ maxLooks: 1.5 }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ budgetCusd: -3 }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ budgetCusd: 'loads' }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ weather: 'sunny' }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ weather: { tempC: 'hot' } }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ weather: { rain: 'yes' } }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ curatorSlug: 'BAD SLUG!' }).errors.length).toBeGreaterThan(0);
    expect(validateBrief({ occasion: 42 }).errors.length).toBeGreaterThan(0);
  });
});

describe('POST /api/agent/outfit', () => {
  it('returns 400 on invalid input', async () => {
    const res = await post({ maxLooks: 99 });
    expect(res.status).toBe(400);
    expect(res.json.error).toBe('Invalid brief');
    expect(res.json.details.length).toBeGreaterThan(0);
  });

  it('returns 400 on a non-object body', async () => {
    const server = app.listen(0);
    try {
      const res = await fetch(`http://127.0.0.1:${server.address().port}/api/agent/outfit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([1, 2, 3]),
      });
      expect(res.status).toBe(400);
    } finally {
      server.close();
    }
  });
});
