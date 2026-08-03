import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const virtualTryOn = require('../routes/ai-virtual-tryon');
const { tryOnGarment } = require('./prava-tryon');

describe('Prava try-on adapter', () => {
  const originalToken = process.env.REPLICATE_API_TOKEN;

  beforeEach(() => {
    process.env.REPLICATE_API_TOKEN = 'replicate-test-token';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (originalToken) process.env.REPLICATE_API_TOKEN = originalToken;
    else delete process.env.REPLICATE_API_TOKEN;
  });

  it('passes a non-null garment description to IDM-VTON', async () => {
    const run = vi.spyOn(virtualTryOn.engine, 'runReplicatePrediction').mockResolvedValue('https://replicate.delivery/fit.webp');

    await expect(
      tryOnGarment({
        garmentImageUrl: 'https://cdn.example.com/jacket.webp',
        garmentDescription: "Women's lightweight running jacket",
        photoUrl: 'https://cdn.example.com/person.jpg',
      }),
    ).resolves.toEqual({
      renderUrl: 'https://replicate.delivery/fit.webp',
      provider: 'replicate-idm-vton',
    });

    expect(run).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({
          garment_des: "Women's lightweight running jacket",
        }),
      }),
    );
  });

  it('turns a terminal model failure into a recoverable fit error', async () => {
    const providerError = Object.assign(new Error('Replicate prediction failed'), {
      code: 'REPLICATE_PREDICTION_FAILED',
      status: 422,
      context: { predictionId: 'pred_test', detail: 'invalid input' },
    });
    vi.spyOn(virtualTryOn.engine, 'runReplicatePrediction').mockRejectedValue(providerError);

    await expect(
      tryOnGarment({
        garmentImageUrl: 'https://cdn.example.com/jacket.webp',
        photoUrl: 'https://cdn.example.com/person.jpg',
      }),
    ).rejects.toMatchObject({
      code: 'TRY_ON_INPUT_UNSUPPORTED',
      status: 422,
      context: expect.objectContaining({ predictionId: 'pred_test' }),
    });
  });
});
