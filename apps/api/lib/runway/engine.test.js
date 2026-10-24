import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const savedRedisUrl = process.env.REDIS_URL;
const savedDbUrl = process.env.NEON_DATABASE_URL;
delete process.env.REDIS_URL;
delete process.env.NEON_DATABASE_URL;

const state = require('./state');
const judge = require('./judge');
const photo = require('./photo');
const fix = require('./fix');
const engine = require('./engine');

const origJudge = judge.judgeOutfit;
const origFetch = photo.fetchAsDataUrl;
const origNormalise = photo.normaliseDataUrl;
const origFix = fix.findFix;
const origRounds = state.incrChatRounds;

let seq = 0;
const chatId = () => `chat_test_${++seq}`;

const OK_VERDICT = {
  ok: true,
  scores: { theme: 7, cohesion: 6, styling: 5 },
  total: 6.0,
  verdict: 'Passable. The belt saves it.',
  fixHint: 'a structured black blazer',
  fixTags: ['formal'],
  provider: 'venice',
  model: 'm',
};

beforeEach(() => {
  judge.judgeOutfit = async () => ({ ...OK_VERDICT });
  photo.fetchAsDataUrl = async () => 'data:image/jpeg;base64,AAAA';
  photo.normaliseDataUrl = async (u) => u;
  fix.findFix = async () => ({
    kind: 'look',
    title: 'Night Edit',
    url: 'https://onpoint.trustfall.xyz/look/night-edit?sid=abc123def456&utm_source=imessage',
    shareId: 'abc123def456',
  });
});

afterEach(() => {
  judge.judgeOutfit = origJudge;
  photo.fetchAsDataUrl = origFetch;
  photo.normaliseDataUrl = origNormalise;
  fix.findFix = origFix;
  state.incrChatRounds = origRounds;
  if (savedRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = savedRedisUrl;
  if (savedDbUrl === undefined) delete process.env.NEON_DATABASE_URL;
  else process.env.NEON_DATABASE_URL = savedDbUrl;
});

describe('runway engine', () => {
  it("'play' starts a round with two text-only intents", async () => {
    const id = chatId();
    const intents = await engine.handleInbound({ chatId: id, text: 'play' });
    expect(intents).toHaveLength(2);
    expect(intents.every((i) => i.type === 'text')).toBe(true);
    expect(JSON.stringify(intents)).not.toContain('http');
    const round = await state.getRound(id);
    expect(round.status).toBe('awaiting_photo');
    expect(round.persona).toBe('miranda');
  });

  it('nudges when text arrives while a photo is awaited', async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play', now: Date.now() });
    const intents = await engine.handleInbound({ chatId: id, text: 'wait what?', now: Date.now() + 30_000 });
    expect(intents).toHaveLength(1);
    expect(intents[0].type).toBe('text');
    const round = await state.getRound(id);
    expect(round.status).toBe('awaiting_photo');
  });

  it('judges a photo: verdict + card + fix link + again hint', async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play' });
    const intents = await engine.handleInbound({ chatId: id, photoUrl: 'https://x/p.jpg' });
    expect(intents[0].type).toBe('text');
    expect(intents[0].text).toContain("Miranda's score: 6.0/10");
    const card = intents.find((i) => i.type === 'card');
    const round = await state.getRound(id);
    expect(card.cardUrl).toContain(`/runway/r/${round.roundId}`);
    expect(card.cardImageUrl).toContain(`${round.roundId}.png`);
    const link = intents.find((i) => i.type === 'link');
    expect(link.url).toContain('sid=');
    expect(link.url).toContain('utm_source=imessage');
    expect(intents.at(-1).text).toContain('again');
    expect((await state.getRound(id)).status).toBe('judged');
    const result = await state.getResult(round.roundId);
    expect(result.total).toBe(6.0);
    expect(result.fix.url).toContain('sid=');
  });

  it('judges an image data URL through the same intent path', async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play' });
    let seen;
    photo.normaliseDataUrl = async (u) => { seen = u; return 'data:image/jpeg;base64,AAAA'; };
    const intents = await engine.handleInbound({
      chatId: id,
      imageDataUrl: 'data:image/jpeg;base64,RAW',
    });
    expect(seen).toBe('data:image/jpeg;base64,RAW');
    const card = intents.find((i) => i.type === 'card');
    const round = await state.getRound(id);
    expect(card.cardUrl).toContain(`/runway/r/${round.roundId}`);
    expect(intents.at(-1).text).toContain('again');
    expect((await state.getRound(id)).status).toBe('judged');
  });

  it("'judge edina' switches persona and starts a round", async () => {
    const id = chatId();
    const intents = await engine.handleInbound({ chatId: id, text: 'judge edina' });
    expect(intents).toHaveLength(2);
    const round = await state.getRound(id);
    expect(round.persona).toBe('edina');
    expect(intents[1].text).toMatch(/darling|sweetie/i);
  });

  it("'again' does not repeat the just-played theme", async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play' });
    const first = await state.getRound(id);
    await engine.handleInbound({ chatId: id, text: 'again' });
    const second = await state.getRound(id);
    expect(second.themeId).not.toBe(first.themeId);
  });

  it('answers with the persona cap line over the daily round cap', async () => {
    const id = chatId();
    state.incrChatRounds = async () => state.ROUNDS_PER_CHAT_DAY + 1;
    const intents = await engine.handleInbound({ chatId: id, text: 'play' });
    expect(intents).toHaveLength(1);
    expect(intents[0].text.toLowerCase()).toContain('enough for today');
    expect(await state.getRound(id)).toBeNull();
  });

  it('judges a freestyle round when a photo arrives with no round', async () => {
    const id = chatId();
    let seenTheme;
    judge.judgeOutfit = async (args) => { seenTheme = args.theme.id; return { ...OK_VERDICT }; };
    const intents = await engine.handleInbound({ chatId: id, photoUrl: 'https://x/p.jpg' });
    expect(seenTheme).toBe('freestyle');
    expect(intents.some((i) => i.type === 'card')).toBe(true);
  });

  it('keeps the round awaiting on refused and unavailable', async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play' });
    judge.judgeOutfit = async () => ({ ok: false, reason: 'refused' });
    let intents = await engine.handleInbound({ chatId: id, photoUrl: 'https://x/p.jpg' });
    expect((await state.getRound(id)).status).toBe('awaiting_photo');
    judge.judgeOutfit = async () => ({ ok: false, reason: 'unavailable' });
    intents = await engine.handleInbound({ chatId: id, photoUrl: 'https://x/p.jpg' });
    expect((await state.getRound(id)).status).toBe('awaiting_photo');
    expect(intents[0].type).toBe('text');
  });

  it('treats a photo fetch failure as unavailable', async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play' });
    photo.fetchAsDataUrl = async () => { throw new Error('http 500'); };
    const intents = await engine.handleInbound({ chatId: id, photoUrl: 'https://x/p.jpg' });
    expect(intents[0].type).toBe('text');
    expect((await state.getRound(id)).status).toBe('awaiting_photo');
  });

  it("'play <theme-id>' starts that theme; unknown id falls back to random", async () => {
    const id = chatId();
    await engine.handleInbound({ chatId: id, text: 'play quiet-luxury' });
    expect((await state.getRound(id)).themeId).toBe('quiet-luxury');
    await engine.handleInbound({ chatId: id, text: 'play not-a-theme' });
    const r2 = await state.getRound(id);
    expect(r2.themeId).toBeTruthy();
    expect(r2.themeId).not.toBe('quiet-luxury');
  });

  it('startRound returns structured started/capped results', async () => {
    const id = chatId();
    const out = await engine.startRound(id, { personaKey: 'shaft', themeId: 'gorpcore', surface: 'web' });
    expect(out.status).toBe('started');
    expect(out.theme.id).toBe('gorpcore');
    expect(out.persona).toEqual({ key: 'shaft', name: 'Shaft' });
    expect(out.messages).toHaveLength(2);
    state.incrChatRounds = async () => state.ROUNDS_PER_CHAT_DAY + 1;
    const capped = await engine.startRound(id, { personaKey: 'shaft' });
    expect(capped.status).toBe('capped');
    expect(capped.messages[0]).toBeTruthy();
  });

  it('submitPhoto on web surface returns structured result and direct-channel fix', async () => {
    const id = chatId();
    const started = await engine.startRound(id, { personaKey: 'miranda', surface: 'web' });
    let fixArgs;
    fix.findFix = async (args) => { fixArgs = args; return { kind: 'look', title: 'T', imageUrl: null, url: 'https://web/look/t?sid=abc123&utm_source=direct', shareId: 'abc123' }; };
    const out = await engine.submitPhoto(id, { imageDataUrl: 'data:image/jpeg;base64,AAAA', surface: 'web' });
    expect(out.status).toBe('ok');
    expect(out.result.total).toBe(6.0);
    expect(out.result.fix.url).toContain('utm_source=direct');
    expect(fixArgs.channel).toBe('direct');
    expect(fixArgs.personaKey).toBe('miranda');
  });

  it('submitPhoto maps refused and unavailable to persona messages', async () => {
    const id = chatId();
    await engine.startRound(id, { personaKey: 'edina', surface: 'web' });
    judge.judgeOutfit = async () => ({ ok: false, reason: 'refused' });
    let out = await engine.submitPhoto(id, { imageDataUrl: 'data:image/jpeg;base64,AAAA', surface: 'web' });
    expect(out.status).toBe('refused');
    expect(out.messages[0]).toBeTruthy();
    judge.judgeOutfit = async () => ({ ok: false, reason: 'unavailable' });
    out = await engine.submitPhoto(id, { imageDataUrl: 'data:image/jpeg;base64,AAAA', surface: 'web' });
    expect(out.status).toBe('unavailable');
  });

  it('returns help text', async () => {
    const intents = await engine.handleInbound({ chatId: chatId(), text: 'HELP' });
    expect(intents).toHaveLength(1);
    expect(intents[0].text).toContain('judge');
  });
});
