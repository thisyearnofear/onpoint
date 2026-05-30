import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const router = require('./ai-virtual-tryon');

describe('ai-virtual-tryon contract', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  it('strictly parses JSON body-analysis responses', () => {
    const result = router.__test.parseBodyAnalysisResponse(
      JSON.stringify({
        currentLook: ['navy tee with a relaxed fit'],
        bodyType: 'athletic',
        measurements: {
          shoulders: 'large',
          chest: 'medium',
          waist: 'medium',
          hips: 'small',
        },
        fitRecommendations: ['Use structured shoulders to keep balance.'],
        styleRecommendations: ['Choose warmer contrast near the face.'],
        personalization: ['The navy top works with the current palette.'],
        score: 8.4,
        confidence: 0.72,
      }),
    );

    expect(result).toMatchObject({
      bodyType: 'athletic',
      measurements: {
        shoulders: 'large',
        chest: 'medium',
        waist: 'medium',
        hips: 'small',
      },
      fitRecommendations: ['Use structured shoulders to keep balance.'],
      score: 8,
      confidence: 0.72,
    });
  });

  it('falls back when the model response is malformed', () => {
    const result = router.__test.parseBodyAnalysisResponse(`
CURRENT LOOK:
- navy tee with a relaxed fit and light denim
BODY ANALYSIS:
Body Type: athletic
Shoulders: large
Chest: medium
Waist: medium
Hips: small
FIT RECOMMENDATIONS:
- Keep the shoulder seam clean for better proportion
STYLE RECOMMENDATIONS:
- Add a structured outer layer for sharper lines
PERSONALIZATION:
- The current blue palette is wearable and cohesive
`);

    expect(result.bodyType).toBe('athletic');
    expect(result.measurements.shoulders).toBe('large');
    expect(result.fitRecommendations[0]).toContain('shoulder');
    expect(result.styleRecommendations[0]).toContain('structured');
  });

  it('falls back to Venice image generation when Replicate is unavailable', async () => {
    process.env.REPLICATE_API_TOKEN = 'replicate-test-token';
    process.env.VENICE_API_KEY = 'venice-test-token';

    global.fetch
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ error: 'unavailable' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ images: ['base64-webp-image'] }),
      });

    const result = await router.__test.buildGeneratedOutfitImageResponse({
      provider: 'auto',
      data: {
        photoData: 'data:image/jpeg;base64,person',
        items: [
          {
            name: 'Home kit',
            description: 'red football shirt',
            imageUrl: 'https://cdn.example.com/kit.webp',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      generatedImage: 'base64-webp-image',
      provider: 'venice-image',
      imageConditioned: false,
      fallbackReason: 'replicate_unavailable',
      errorClass: 'Error',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('returns Replicate URL output as an image-conditioned try-on', async () => {
    process.env.REPLICATE_API_TOKEN = 'replicate-test-token';

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        status: 'succeeded',
        output: 'https://replicate.delivery/result.webp',
      }),
    });

    const result = await router.__test.buildGeneratedOutfitImageResponse({
      provider: 'auto',
      data: {
        photoData: 'data:image/jpeg;base64,person',
        items: [
          {
            name: 'Away kit',
            description: 'white football shirt',
            imageUrl: 'https://cdn.example.com/away-kit.webp',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      generatedImage: 'https://replicate.delivery/result.webp',
      provider: 'replicate-idm-vton',
      imageConditioned: true,
      fallbackReason: null,
      errorClass: null,
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });
});
