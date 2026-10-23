import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const vision = require('../vision');
const state = require('./state');
const judge = require('./judge');
const { getPersona } = require('./prompts');
const { getTheme } = require('./themes');

const originalComplete = vision.completeVision;
const originalIncr = state.incrVisionCalls;

const theme = getTheme('brat-summer');
const persona = getPersona('miranda');

afterEach(() => {
  vision.completeVision = originalComplete;
  state.incrVisionCalls = originalIncr;
});

describe('runway judgeOutfit', () => {
  it('clamps scores, computes total, truncates strings', async () => {
    vision.completeVision = async () => ({
      provider: 'venice',
      model: 'm',
      text: '',
      json: {
        refused: false,
        scores: { theme: 11, cohesion: 0, styling: 7.6 },
        verdict: 'x'.repeat(300),
        fixHint: 'y'.repeat(120),
        fixTags: ['STREET', 'bad tag!', 'ok-tag', 'extra', 'more'],
      },
    });
    const r = await judge.judgeOutfit({ imageDataUrl: 'data:image/jpeg;base64,A', theme, persona, late: false });
    expect(r.ok).toBe(true);
    expect(r.scores).toEqual({ theme: 10, cohesion: 1, styling: 8 });
    expect(r.total).toBe(6.3);
    expect(r.verdict.length).toBeLessThanOrEqual(240);
    expect(r.fixHint.length).toBeLessThanOrEqual(80);
    expect(r.fixTags).toEqual(['street', 'ok-tag', 'extra']);
    expect(r.provider).toBe('venice');
  });

  it('maps refused=true to reason refused', async () => {
    vision.completeVision = async () => ({
      provider: 'venice', model: 'm', text: '',
      json: { refused: true },
    });
    const r = await judge.judgeOutfit({ imageDataUrl: 'x', theme, persona, late: false });
    expect(r).toEqual({ ok: false, reason: 'refused' });
  });

  it('maps all-provider failure to unavailable', async () => {
    const err = new Error('all failed');
    err.code = 'VISION_UNAVAILABLE';
    vision.completeVision = async () => { throw err; };
    const r = await judge.judgeOutfit({ imageDataUrl: 'x', theme, persona, late: false });
    expect(r).toEqual({ ok: false, reason: 'unavailable' });
  });

  it('returns unavailable at the global cap without calling vision', async () => {
    state.incrVisionCalls = async () => state.DAILY_VISION_CAP + 1;
    let called = false;
    vision.completeVision = async () => { called = true; return {}; };
    const r = await judge.judgeOutfit({ imageDataUrl: 'x', theme, persona, late: false });
    expect(r).toEqual({ ok: false, reason: 'unavailable' });
    expect(called).toBe(false);
  });
});
