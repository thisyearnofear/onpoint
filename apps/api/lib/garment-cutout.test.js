import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  cutoutEnabled,
  generateGarmentCutout,
  ensureCutout,
  __test,
} = require('./garment-cutout');

const ENV = ['GARMENT_CUTOUT_ENABLED', 'OPENAI_IMAGE_API_KEY', 'OPENAI_API_KEY', 'OPENAI_IMAGE_BASE_URL', 'OPENAI_IMAGE_MODEL', 'R2_PUBLIC_URL'];

function enable() {
  process.env.GARMENT_CUTOUT_ENABLED = '1';
  process.env.OPENAI_IMAGE_API_KEY = 'img-key';
  process.env.R2_PUBLIC_URL = 'https://cdn.example.com';
}

const SRC_IMG = {
  ok: true,
  headers: { get: () => 'image/jpeg' },
  arrayBuffer: async () => Buffer.from('source-photo'),
};

describe('cutoutEnabled', () => {
  beforeEach(() => ENV.forEach((k) => delete process.env[k]));
  afterEach(() => ENV.forEach((k) => delete process.env[k]));

  it('is off by default and needs flag + key', () => {
    expect(cutoutEnabled()).toBe(false);
    process.env.OPENAI_IMAGE_API_KEY = 'k';
    expect(cutoutEnabled()).toBe(false); // flag missing
    process.env.GARMENT_CUTOUT_ENABLED = '1';
    expect(cutoutEnabled()).toBe(true);
    delete process.env.OPENAI_IMAGE_API_KEY;
    process.env.OPENAI_API_KEY = 'fallback';
    expect(cutoutEnabled()).toBe(true); // OPENAI_API_KEY fallback
  });
});

describe('generateGarmentCutout', () => {
  beforeEach(() => {
    ENV.forEach((k) => delete process.env[k]);
    enable();
  });
  afterEach(() => {
    ENV.forEach((k) => delete process.env[k]);
    vi.restoreAllMocks();
  });

  it('posts multipart edits request with model, size and prompt', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ b64_json: Buffer.from('png-bytes').toString('base64') }] }),
      });

    const buf = await generateGarmentCutout({
      imageUrl: 'https://cdn.example.com/k1.jpg',
      title: 'Home kit',
      fetchImpl,
    });

    expect(buf).toEqual(Buffer.from('png-bytes'));
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const [url, init] = fetchImpl.mock.calls[1];
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(init.method).toBe('POST');
    expect(init.headers.authorization).toBe('Bearer img-key');
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.body.get('model')).toBe('gpt-image-1');
    expect(init.body.get('size')).toBe('1024x1024');
    expect(init.body.get('prompt')).toContain('white background');
    expect(init.body.get('prompt')).toContain('Home kit');
    expect(init.body.get('image')).toBeInstanceOf(Blob);
  });

  it('accepts a url response and fetches it', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ url: 'https://oai.example/cut.png' }] }),
      })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Buffer.from('png-url-bytes') });

    const buf = await generateGarmentCutout({ imageUrl: 'https://cdn.example.com/k1.jpg', fetchImpl });
    expect(buf).toEqual(Buffer.from('png-url-bytes'));
    expect(fetchImpl.mock.calls[2][0]).toBe('https://oai.example/cut.png');
  });

  it('honors custom base url and model', async () => {
    process.env.OPENAI_IMAGE_BASE_URL = 'https://proxy.example/v1/';
    process.env.OPENAI_IMAGE_MODEL = 'custom-img';
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [{ b64_json: 'aGk=' }] }) });

    await generateGarmentCutout({ imageUrl: 'https://cdn.example.com/k1.jpg', fetchImpl });
    expect(fetchImpl.mock.calls[1][0]).toBe('https://proxy.example/v1/images/edits');
    expect(fetchImpl.mock.calls[1][1].body.get('model')).toBe('custom-img');
  });

  it('throws typed errors on failures', async () => {
    await expect(generateGarmentCutout({ imageUrl: 'not-a-url' }))
      .rejects.toMatchObject({ code: 'CUTOUT_BAD_INPUT' });

    const fetchImpl = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 404 });
    await expect(generateGarmentCutout({ imageUrl: 'https://x/y.jpg', fetchImpl }))
      .rejects.toMatchObject({ code: 'CUTOUT_FETCH_FAILED' });

    fetchImpl.mockReset()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(generateGarmentCutout({ imageUrl: 'https://x/y.jpg', fetchImpl }))
      .rejects.toMatchObject({ code: 'CUTOUT_API_FAILED' });

    fetchImpl.mockReset()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) });
    await expect(generateGarmentCutout({ imageUrl: 'https://x/y.jpg', fetchImpl }))
      .rejects.toMatchObject({ code: 'CUTOUT_EMPTY' });
  });
});

describe('ensureCutout', () => {
  const listing = {
    id: 'l-1',
    curatorSlug: 'nia',
    title: 'Home kit',
    photoKeys: ['k1.jpg'],
    attributes: { type: 'kit', colors: ['red'] },
  };

  function fakeDb() {
    const updates = [];
    return {
      updates,
      update: () => ({
        set: (v) => {
          updates.push(v);
          return { where: async () => {} };
        },
      }),
    };
  }

  beforeEach(() => ENV.forEach((k) => delete process.env[k]));
  afterEach(() => {
    ENV.forEach((k) => delete process.env[k]);
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('no-ops when disabled', async () => {
    const db = fakeDb();
    expect(await ensureCutout({ listing, db })).toBeNull();
    expect(db.updates).toHaveLength(0);
  });

  it('skips listings that already have a cutoutKey', async () => {
    enable();
    const db = fakeDb();
    const withCutout = { ...listing, attributes: { ...listing.attributes, cutoutKey: 'existing.png' } };
    expect(await ensureCutout({ listing: withCutout, db })).toBe('existing.png');
    expect(db.updates).toHaveLength(0);
  });

  it('generates, uploads and merges attributes preserving existing keys', async () => {
    enable();
    const uploadSpy = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(SRC_IMG)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ b64_json: Buffer.from('png').toString('base64') }] }),
      }));

    const db = fakeDb();
    const key = await ensureCutout({ listing, db, uploadFn: uploadSpy });

    expect(key).toBe('curators/nia/listings/l-1/cutout.png');
    expect(uploadSpy).toHaveBeenCalledWith(
      'curators/nia/listings/l-1/cutout.png',
      Buffer.from('png'),
      'image/png',
    );
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0].attributes).toEqual({
      type: 'kit',
      colors: ['red'],
      cutoutKey: 'curators/nia/listings/l-1/cutout.png',
    });
  });

  it('returns null without throwing on generation failure', async () => {
    enable();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const db = fakeDb();
    await expect(ensureCutout({ listing, db })).resolves.toBeNull();
    expect(db.updates).toHaveLength(0);
  });
});
