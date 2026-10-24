import { beforeEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

delete process.env.REDIS_URL;

const worker = require('./spectrum-runway');
const engine = require('./lib/runway/engine');

const origHandle = engine.handleInbound;

const sdk = {
  attachment: (u) => ({ type: 'attachment', url: String(u) }),
  richlink: (u) => ({ type: 'richlink', url: String(u) }),
};

const fakeSpace = (id = 'space1') => {
  const sent = [];
  return {
    id,
    sent,
    send: async (c) => sent.push(c),
    responding: async (fn) => fn(),
  };
};

const msg = (over = {}) => ({
  id: `m${++msg.seq}`,
  direction: 'inbound',
  platform: 'imessage',
  sender: { id: '+15551234567' },
  ...over,
});
msg.seq = 0;

beforeEach(() => {
  engine.handleInbound = origHandle;
});

describe('spectrum-runway worker', () => {
  it('maps text content to engine text input', async () => {
    const input = await worker.messageToEngineInput({ content: { type: 'text', text: 'play' } });
    expect(input).toEqual({ text: 'play' });
  });

  it('maps image attachments to data URLs', async () => {
    const bytes = Buffer.from('fakejpeg');
    const input = await worker.messageToEngineInput({
      content: { type: 'attachment', mimeType: 'image/jpeg', read: async () => bytes },
    });
    expect(input.imageDataUrl).toBe(`data:image/jpeg;base64,${bytes.toString('base64')}`);
  });

  it('skips non-image attachments and unknown content', async () => {
    expect(await worker.messageToEngineInput({
      content: { type: 'attachment', mimeType: 'application/pdf', read: async () => Buffer.alloc(4) },
    })).toBeNull();
    expect(await worker.messageToEngineInput({ content: { type: 'richlink', url: 'https://x' } })).toBeNull();
  });

  it('renders card intents as attachment then richlink', async () => {
    const space = fakeSpace();
    await worker.renderIntents(space, [
      { type: 'text', text: 'verdict here' },
      { type: 'card', cardUrl: 'https://web/runway/r/abc', cardImageUrl: 'https://api/runway/card/abc.png', caption: 'c', subcaption: 's' },
      { type: 'text', text: 'fix text' },
      { type: 'link', url: 'https://web/look/x?sid=1' },
    ], sdk);
    expect(space.sent).toEqual([
      'verdict here',
      { type: 'attachment', url: 'https://api/runway/card/abc.png' },
      { type: 'richlink', url: 'https://web/runway/r/abc' },
      'fix text',
      { type: 'richlink', url: 'https://web/look/x?sid=1' },
    ]);
  });

  it('skips outbound, non-imessage, and duplicate messages', async () => {
    let calls = 0;
    engine.handleInbound = async () => { calls++; return []; };
    const space = fakeSpace();
    const m = msg({ content: { type: 'text', text: 'play' } });
    await worker.handleMessage(space, { ...m, direction: 'outbound' }, sdk);
    await worker.handleMessage(space, { ...m, platform: 'whatsapp' }, sdk);
    await worker.handleMessage(space, m, sdk);
    await worker.handleMessage(space, m, sdk); // duplicate id
    expect(calls).toBe(1);
  });

  it('routes text through handleInbound with a spectrum-namespaced chatId', async () => {
    let seen;
    engine.handleInbound = async (a) => { seen = a; return [{ type: 'text', text: 'ok' }]; };
    const space = fakeSpace('xyz');
    await worker.handleMessage(space, msg({ content: { type: 'text', text: 'help' } }), sdk);
    expect(seen).toEqual({ chatId: 'spectrum:xyz', text: 'help' });
    expect(space.sent).toEqual(['ok']);
  });

  it('reads image content inside space.responding and never touches text', async () => {
    let seen;
    let respondingUsed = false;
    engine.handleInbound = async (a) => { seen = a; return [{ type: 'text', text: 'ok' }]; };
    const space = fakeSpace('img');
    space.responding = async (fn) => { respondingUsed = true; return fn(); };
    const bytes = Buffer.from('img');
    await worker.handleMessage(space, msg({
      content: { type: 'attachment', mimeType: 'image/heic', read: async () => bytes },
    }), sdk);
    expect(respondingUsed).toBe(true);
    expect(seen.chatId).toBe('spectrum:img');
    expect(seen.imageDataUrl).toBe(`data:image/heic;base64,${bytes.toString('base64')}`);
    expect(seen.text).toBeUndefined();
  });

  it('serialises per chat but runs different chats in parallel', async () => {
    const chains = new Map();
    const order = [];
    let releaseA;
    const aDone = new Promise((r) => { releaseA = r; });
    const pA = worker.enqueueSerial(chains, 'A', async () => { await aDone; order.push('A1'); });
    const pB = worker.enqueueSerial(chains, 'B', async () => { order.push('B1'); });
    await pB; // B finishes while A is still blocked
    expect(order).toEqual(['B1']);
    releaseA();
    await pA;
    expect(order).toEqual(['B1', 'A1']);
  });

  it('preserves order within one chat and cleans up the chain', async () => {
    const chains = new Map();
    const order = [];
    const tasks = [1, 2, 3].map((n) =>
      worker.enqueueSerial(chains, 'chat', async () => { order.push(n); }));
    await Promise.all(tasks);
    expect(order).toEqual([1, 2, 3]);
    await new Promise((r) => setImmediate(r));
    expect(chains.size).toBe(0);
  });
});
