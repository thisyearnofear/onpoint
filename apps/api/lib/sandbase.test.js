import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const sandbase = require('./sandbase');

const KEY_ENVS = [
  'SANDBASE_API_KEY',
  'SANDBASE_BASE_URL',
  'SANDBASE_CHAT_MODEL',
  'SANDBASE_VISION_MODEL',
  'VISION_SANDBASE_MODEL',
  'SANDBASE_KILL_SWITCH',
  'SANDBASE_TIMEOUT_MS',
];
const saved = {};

beforeEach(() => {
  for (const k of KEY_ENVS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  sandbase._resetPriceCache();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  sandbase._resetPriceCache();
});

function modelCard(promptPrice, completionPrice) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      model_card: {
        prompt_token_price: promptPrice,
        completion_token_price: completionPrice,
      },
    }),
  };
}

describe('sandbase gateway', () => {
  it('is inert without a key, and killed by SANDBASE_KILL_SWITCH', () => {
    expect(sandbase.configured()).toBe(false);
    expect(sandbase.apiKey()).toBeNull();

    process.env.SANDBASE_API_KEY = 'sk-test';
    expect(sandbase.configured()).toBe(true);

    process.env.SANDBASE_KILL_SWITCH = '1';
    expect(sandbase.configured()).toBe(false);
  });

  it('refuses placeholder keys', () => {
    process.env.SANDBASE_API_KEY = 'your_sandbase_api_key_here';
    expect(sandbase.apiKey()).toBeNull();
    expect(sandbase.configured()).toBe(false);
  });

  it('only builds a client when the call-type model is set', () => {
    process.env.SANDBASE_API_KEY = 'sk-test';
    expect(sandbase.client('vision')).toBeNull();
    expect(sandbase.client('chat')).toBeNull();

    process.env.SANDBASE_VISION_MODEL = 'vendor/vl';
    expect(sandbase.visionModel()).toBe('vendor/vl');
    expect(sandbase.client('vision')).toBeTruthy();
    expect(sandbase.client('chat')).toBeNull();
  });

  it('prefers the chain-scoped VISION_SANDBASE_MODEL override', () => {
    process.env.SANDBASE_VISION_MODEL = 'vendor/a';
    process.env.VISION_SANDBASE_MODEL = 'vendor/b';
    expect(sandbase.visionModel()).toBe('vendor/b');
  });

  it('computes USD from the model card token prices', async () => {
    process.env.SANDBASE_API_KEY = 'sk-test';
    fetch.mockResolvedValue(modelCard('0.30', '1.20'));

    const cost = await sandbase.costUsd('vendor/vl', {
      prompt_tokens: 1_000_000,
      completion_tokens: 500_000,
    });
    expect(cost).toBeCloseTo(0.3 + 0.6, 10);
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.sandbase.ai/v1/models/vendor%2Fvl');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
  });

  it('caches the price read across calls', async () => {
    process.env.SANDBASE_API_KEY = 'sk-test';
    fetch.mockResolvedValue(modelCard('0.30', '1.20'));
    const usage = { prompt_tokens: 10, completion_tokens: 5 };
    await sandbase.costUsd('vendor/vl', usage);
    await sandbase.costUsd('vendor/vl', usage);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reports no cost rather than a guess when prices are unreadable', async () => {
    process.env.SANDBASE_API_KEY = 'sk-test';
    fetch.mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    expect(await sandbase.costUsd('vendor/vl', { prompt_tokens: 10 })).toBeNull();
    // failure is cached too — no repeated hits for a model with no card
    await sandbase.costUsd('vendor/vl', { prompt_tokens: 10 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('returns null without a model or usage', async () => {
    process.env.SANDBASE_API_KEY = 'sk-test';
    expect(await sandbase.costUsd('', { prompt_tokens: 1 })).toBeNull();
    expect(await sandbase.costUsd('vendor/vl', undefined)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});
