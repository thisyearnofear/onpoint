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

  it('uses YouCam Apparel VTO first when configured (paid tier)', async () => {
    process.env.YOUCAM_API_KEY = 'youcam-test-key';

    global.fetch
      // 1. File API init for the person photo (data URI upload path)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 200,
          data: {
            files: [
              {
                file_id: 'src-file-id',
                requests: [{ method: 'PUT', url: 'https://s3.example.com/upload-src' }],
              },
            ],
          },
        }),
      })
      // 2. Presigned PUT of the person photo bytes
      .mockResolvedValueOnce({ ok: true })
      // 3. cloth-v4 task creation (garment passed through as public URL)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 200, data: { task_id: 'youcam-task-123' } }),
      })
      // 4. Task poll → success with render URL
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          status: 200,
          data: {
            task_status: 'success',
            results: { url: 'https://youcam.example.com/render.jpg' },
          },
        }),
      });

    const result = await router.__test.buildGeneratedOutfitImageResponse({
      provider: 'auto',
      data: {
        photoData: 'data:image/jpeg;base64,person',
        items: [
          {
            name: 'Ankara set',
            description: 'ankara print two-piece',
            imageUrl: 'https://cdn.example.com/ankara.webp',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      generatedImage: 'https://youcam.example.com/render.jpg',
      provider: 'youcam-cloth-v4',
      imageConditioned: true,
      fallbackReason: null,
      errorClass: null,
      youcamTaskId: 'youcam-task-123',
    });
    expect(result.latencyMs).toEqual(expect.any(Number));
  });

  it('falls back to Replicate when YouCam rejects the API key', async () => {
    process.env.YOUCAM_API_KEY = 'youcam-bad-key';
    process.env.REPLICATE_API_TOKEN = 'replicate-test-token';

    global.fetch
      // YouCam File API init → 401 invalid key
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ status: 401, error: 'Invalid API key', error_code: 'InvalidAccessToken' }),
      })
      // Replicate prediction succeeds
      .mockResolvedValueOnce({
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
            name: 'Home kit',
            description: 'red football shirt',
            imageUrl: 'https://cdn.example.com/kit.webp',
          },
        ],
      },
    });

    expect(result).toMatchObject({
      generatedImage: 'https://replicate.delivery/result.webp',
      provider: 'replicate-idm-vton',
      imageConditioned: true,
      fallbackReason: 'youcam_unavailable',
    });
  });
});
