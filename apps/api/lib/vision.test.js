import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vision = require('./vision');

const KEY_ENVS = [
  'VENICE_API_KEY',
  'GEMINI_API_KEY',
  'OPENROUTER_API_KEY',
  'DASHSCOPE_API_KEY',
  'OPENAI_API_KEY',
  'MODAL_API_KEY',
  'MODAL_BASE_URL',
  'VISION_MODAL_BASE_URL',
  'VISION_MODAL_MODEL',
];
const saved = {};

function stubClient(behaviour) {
  // behaviour: (name) => ({ create }) — name determined per client construction order
  const calls = [];
  vision._setClientFactory((opts) => {
    const idx = calls.length;
    calls.push(opts);
    return { chat: { completions: { create: (...a) => behaviour(idx, opts, ...a) } } };
  });
  return calls;
}

beforeEach(() => {
  for (const k of [...KEY_ENVS, 'VISION_PROVIDERS']) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
});

afterEach(() => {
  for (const k of Object.keys(saved)) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  vision._setClientFactory(null);
});

const IMG = 'data:image/jpeg;base64,AAAA';
const okJson = JSON.stringify({ refused: false, scores: { theme: 7, cohesion: 6, styling: 5 }, verdict: 'ok' });

describe('vision provider chain', () => {
  it('skips providers without keys and keeps default order', async () => {
    process.env.GEMINI_API_KEY = 'g';
    process.env.OPENAI_API_KEY = 'o';
    const calls = stubClient(() => Promise.resolve({ choices: [{ message: { content: okJson } }] }));
    const out = await vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG });
    expect(out.provider).toBe('gemini');
    expect(calls.length).toBe(1);
    expect(vision.configuredProviders().map((p) => p.name)).toEqual(['gemini', 'openai']);
  });

  it('honours VISION_PROVIDERS order override', async () => {
    process.env.OPENAI_API_KEY = 'o';
    process.env.VENICE_API_KEY = 'v';
    process.env.VISION_PROVIDERS = 'openai,venice';
    const calls = stubClient(() => Promise.resolve({ choices: [{ message: { content: okJson } }] }));
    const out = await vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG });
    expect(out.provider).toBe('openai');
    expect(vision.configuredProviders().map((p) => p.name)).toEqual(['openai', 'venice']);
  });

  it('ignores the placeholder openai key', () => {
    process.env.OPENAI_API_KEY = 'your_openai_api_key_here';
    expect(vision.configuredProviders()).toEqual([]);
  });

  it('never exposes keys in configuredProviders', () => {
    process.env.VENICE_API_KEY = 'super-secret';
    const providers = vision.configuredProviders();
    expect(JSON.stringify(providers)).not.toContain('super-secret');
    expect(providers[0]).toEqual({ name: 'venice', model: 'qwen3-vl-235b-a22b' });
  });

  it('falls through on throw, unparseable JSON, and validate=false', async () => {
    process.env.VENICE_API_KEY = 'v';
    process.env.GEMINI_API_KEY = 'g';
    process.env.OPENAI_API_KEY = 'o';
    const responses = [
      () => Promise.reject(new Error('boom')),
      () => Promise.resolve({ choices: [{ message: { content: 'not json' } }] }),
      () => Promise.resolve({ choices: [{ message: { content: okJson } }] }),
    ];
    let i = 0;
    stubClient(() => responses[i++ % responses.length]());
    // validate=false on everything → all three tried then fail
    await expect(
      vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG, validate: () => false }),
    ).rejects.toMatchObject({ code: 'VISION_UNAVAILABLE' });

    // now validate passes on the third
    i = 0;
    const out = await vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG });
    expect(out.provider).toBe('openai');
    expect(out.json.scores.theme).toBe(7);
  });

  it('throws VISION_UNAVAILABLE when nothing is configured', async () => {
    await expect(
      vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG }),
    ).rejects.toMatchObject({ code: 'VISION_UNAVAILABLE' });
  });

  it('expectJson:false returns free text without requiring parseable JSON', async () => {
    process.env.OPENROUTER_API_KEY = 'k';
    stubClient(() => Promise.resolve({ choices: [{ message: { content: 'Nice jacket — no JSON here.' } }] }));
    const out = await vision.completeVision({
      system: 's', prompt: 'p', imageDataUrl: IMG, expectJson: false,
    });
    expect(out.provider).toBe('openrouter');
    expect(out.text).toContain('Nice jacket');
    expect(out.json).toBeNull();
  });

  it('expectJson:false still rejects empty responses and falls through', async () => {
    process.env.VENICE_API_KEY = 'v';
    process.env.OPENROUTER_API_KEY = 'k';
    const responses = [
      () => Promise.resolve({ choices: [{ message: { content: '' } }] }),
      () => Promise.resolve({ choices: [{ message: { content: 'ok text' } }] }),
    ];
    let i = 0;
    stubClient(() => responses[i++ % responses.length]());
    const out = await vision.completeVision({
      system: 's', prompt: 'p', imageDataUrl: IMG, expectJson: false,
    });
    expect(out.provider).toBe('openrouter');
    expect(out.text).toBe('ok text');
  });

  it('modal provider is enabled by MODAL_BASE_URL alone (key optional)', async () => {
    process.env.MODAL_BASE_URL = 'https://x--vllm.modal.run/v1';
    process.env.VISION_PROVIDERS = 'modal';
    const calls = stubClient(() => Promise.resolve({ choices: [{ message: { content: okJson } }] }));
    const out = await vision.completeVision({ system: 's', prompt: 'p', imageDataUrl: IMG });
    expect(out.provider).toBe('modal');
    expect(calls[0].apiKey).toBe('unused');
    expect(calls[0].baseURL).toBe('https://x--vllm.modal.run/v1');
    expect(vision.configuredProviders()).toEqual([
      { name: 'modal', model: 'Qwen/Qwen2.5-VL-7B-Instruct' },
    ]);
  });

  it('modal provider is skipped without baseURL or key', () => {
    process.env.VISION_PROVIDERS = 'modal';
    expect(vision.configuredProviders()).toEqual([]);
  });

  it('omits the system message when system is not provided', async () => {
    process.env.OPENROUTER_API_KEY = 'k';
    const calls = stubClient(() => Promise.resolve({ choices: [{ message: { content: okJson } }] }));
    await vision.completeVision({ prompt: 'p', imageDataUrl: IMG });
    expect(calls).toHaveLength(1);
  });

  it('parseJsonLoose strips fences and takes the first object', () => {
    expect(vision.parseJsonLoose('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(vision.parseJsonLoose('prefix {"b":2} suffix')).toEqual({ b: 2 });
    expect(vision.parseJsonLoose('no json')).toBeNull();
  });
});
