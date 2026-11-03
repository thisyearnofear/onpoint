import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { runGeminiTryOn, __test } = require('./gemini-tryon');

const PERSON = 'data:image/jpeg;base64,cGVyc29u';
const GARMENT_URL = 'https://cdn.example.com/kit.webp';

function geminiResponse(inlineData) {
  return {
    candidates: [
      { content: { parts: [{ text: 'ok' }, ...(inlineData ? [{ inlineData }] : [])] } },
    ],
  };
}

describe('toInlineImagePart', () => {
  it('parses data URIs', async () => {
    const part = await __test.toInlineImagePart(PERSON, 'person');
    expect(part).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'cGVyc29u' } });
  });

  it('fetches http(s) images and base64-encodes them', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/webp' },
      arrayBuffer: async () => Buffer.from('garment-bytes'),
    }));
    const part = await __test.toInlineImagePart(GARMENT_URL, 'garment 1');
    expect(part.inlineData.mimeType).toBe('image/webp');
    expect(part.inlineData.data).toBe(Buffer.from('garment-bytes').toString('base64'));
    vi.unstubAllGlobals();
  });

  it('rejects bad inputs and failed fetches', async () => {
    await expect(__test.toInlineImagePart('ftp://x', 'garment')).rejects.toMatchObject({ code: 'GEMINI_BAD_INPUT' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    await expect(__test.toInlineImagePart(GARMENT_URL, 'garment')).rejects.toMatchObject({ code: 'GEMINI_FETCH_FAILED' });
    vi.unstubAllGlobals();
  });
});

describe('runGeminiTryOn', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => 'image/webp' },
      arrayBuffer: async () => Buffer.from('garment-bytes'),
    }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.GEMINI_TRYON_MODEL;
    __test.reset();
  });

  it('throws GEMINI_NOT_CONFIGURED without a client or key', async () => {
    delete process.env.GEMINI_API_KEY;
    await expect(runGeminiTryOn({ humanImage: PERSON, garmentImages: [GARMENT_URL] }))
      .rejects.toMatchObject({ code: 'GEMINI_NOT_CONFIGURED' });
  });

  it('returns the first inline image as a data URI', async () => {
    const client = {
      models: {
        generateContent: vi.fn().mockResolvedValue(
          geminiResponse({ mimeType: 'image/png', data: 'Z2VtLXJlbmRlcg==' }),
        ),
      },
    };

    const result = await runGeminiTryOn({
      humanImage: PERSON,
      garmentImages: [GARMENT_URL],
      garmentDescription: 'red home jersey',
      client,
    });

    expect(result.generatedImage).toBe('data:image/png;base64,Z2VtLXJlbmRlcg==');
    expect(result.model).toBe('gemini-2.5-flash-image');

    const call = client.models.generateContent.mock.calls[0][0];
    const parts = call.contents[0].parts;
    expect(parts[0].text).toContain("Keep the person");
    expect(parts[1]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'cGVyc29u' } });
    expect(parts[2].inlineData.mimeType).toBe('image/webp');
  });

  it('sends two garment images in order and honors GEMINI_TRYON_MODEL', async () => {
    process.env.GEMINI_TRYON_MODEL = 'gemini-test-image-model';
    const client = {
      models: {
        generateContent: vi.fn().mockResolvedValue(
          geminiResponse({ mimeType: 'image/png', data: 'aW1n' }),
        ),
      },
    };

    const result = await runGeminiTryOn({
      humanImage: PERSON,
      garmentImages: ['data:image/png;base64,dG9w', 'data:image/png;base64,Ym90dG9t'],
      client,
    });

    expect(result.model).toBe('gemini-test-image-model');
    const parts = client.models.generateContent.mock.calls[0][0].contents[0].parts;
    expect(parts[0].text).toContain('top garment first');
    expect(parts[2].inlineData.data).toBe('dG9w');
    expect(parts[3].inlineData.data).toBe('Ym90dG9t');
  });

  it('throws GEMINI_NO_IMAGE on empty or blocked responses', async () => {
    const client = {
      models: { generateContent: vi.fn().mockResolvedValue({ candidates: [] }) },
    };
    await expect(runGeminiTryOn({
      humanImage: PERSON,
      garmentImages: [GARMENT_URL],
      client,
    })).rejects.toMatchObject({ code: 'GEMINI_NO_IMAGE', name: 'GeminiTryOnError' });
  });

  it('requires person and garment inputs', async () => {
    const client = { models: { generateContent: vi.fn() } };
    await expect(runGeminiTryOn({ garmentImages: [GARMENT_URL], client }))
      .rejects.toMatchObject({ code: 'GEMINI_BAD_INPUT' });
    await expect(runGeminiTryOn({ humanImage: PERSON, client }))
      .rejects.toMatchObject({ code: 'GEMINI_BAD_INPUT' });
  });
});
