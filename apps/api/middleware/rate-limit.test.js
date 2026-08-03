import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createRateLimiter } = require('./rate-limit');

function fakeRedis() {
  const counts = new Map();
  const expiries = [];
  return {
    counts,
    expiries,
    multi() {
      let key;
      return {
        incr(nextKey) {
          key = nextKey;
          return this;
        },
        expire(nextKey, seconds) {
          expiries.push({ key: nextKey, seconds });
          return this;
        },
        async exec() {
          const count = (counts.get(key) || 0) + 1;
          counts.set(key, count);
          return [
            [null, count],
            [null, 1],
          ];
        },
      };
    },
  };
}

function response() {
  const headers = new Map();
  return {
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), String(value));
    },
    getHeader(name) {
      return headers.get(name.toLowerCase());
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

async function invoke(middleware) {
  const req = { headers: {}, ip: '203.0.113.9' };
  const res = response();
  let passed = false;
  await middleware(req, res, () => {
    passed = true;
  });
  return { res, passed };
}

describe('API rate limiter', () => {
  afterEach(() => vi.restoreAllMocks());

  it('resets through a new fixed-window bucket under continuous traffic', async () => {
    const redis = fakeRedis();
    const limiter = createRateLimiter(redis, 'general', {
      maxRequests: 2,
      windowMs: 60_000,
      prefix: 'test-fixed-window',
    });

    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    expect((await invoke(limiter)).passed).toBe(true);
    expect((await invoke(limiter)).passed).toBe(true);
    const blocked = await invoke(limiter);
    expect(blocked.res.statusCode).toBe(429);
    expect(blocked.res.getHeader('retry-after')).toBe('50');

    nowSpy.mockReturnValue(60_001);
    const freshWindow = await invoke(limiter);
    expect(freshWindow.passed).toBe(true);
    expect(redis.counts.size).toBe(2);
  });
});
