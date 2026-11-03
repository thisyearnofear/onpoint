import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { extractGarmentAttributes, attributesFromTags } = require('./garment-attributes');

describe('attributesFromTags', () => {
  it('maps kit/jersey keywords to type kit', () => {
    const attrs = attributesFromTags(['football', 'home'], 'Arsenal Home Kit');
    expect(attrs.type).toBe('kit');
    expect(attrs.formality).toBe('sport');
    expect(attrs.source).toBe('rules');
  });

  it('classifies dresses, outerwear, footwear, bottoms, tops', () => {
    expect(attributesFromTags([], 'Ankara Maxi Dress').type).toBe('dress');
    expect(attributesFromTags([], 'Winter Puffer Jacket').type).toBe('outerwear');
    expect(attributesFromTags([], 'Leather Chelsea Boots').type).toBe('footwear');
    expect(attributesFromTags([], 'Slim Denim Jeans').type).toBe('bottom');
    expect(attributesFromTags([], 'Linen Button Shirt').type).toBe('top');
    expect(attributesFromTags(['cap'], 'Bucket Cap').type).toBe('accessory');
  });

  it('derives warmth, fabric, pattern, fit, colors', () => {
    const attrs = attributesFromTags(['winter'], 'Heavy Wool Coat — Black');
    expect(attrs.warmth).toBe('heavy');
    expect(attrs.fabric).toBe('wool');
    expect(attrs.colors).toContain('black');

    const light = attributesFromTags([], 'Striped Linen Summer Shirt — White Navy');
    expect(light.warmth).toBe('light');
    expect(light.pattern).toBe('striped');
    expect(light.colors).toEqual(['white', 'navy']);

    expect(attributesFromTags([], 'Slim Fit Jeans').fit).toBe('slim');
    expect(attributesFromTags([], 'Oversized Graphic Tee').fit).toBe('oversized');
    expect(attributesFromTags([], 'Oversized Graphic Tee').pattern).toBe('graphic');
  });

  it('defaults to type other / casual with no signal', () => {
    const attrs = attributesFromTags([], 'Mystery Item');
    expect(attrs.type).toBe('other');
    expect(attrs.formality).toBe('casual');
    expect(attrs.colors).toEqual([]);
  });
});

describe('extractGarmentAttributes', () => {
  beforeEach(() => {
    delete process.env.QWEN_CLOUD_KILL_SWITCH;
  });
  afterEach(() => {
    delete process.env.QWEN_CLOUD_KILL_SWITCH;
    vi.restoreAllMocks();
  });

  it('returns rules attributes when no image or kill switch set', async () => {
    process.env.QWEN_CLOUD_KILL_SWITCH = '1';
    const attrs = await extractGarmentAttributes({
      imageUrl: 'https://cdn.example.com/jeans.webp',
      title: 'Slim Denim Jeans',
      tags: ['denim'],
    });
    expect(attrs.source).toBe('rules');
    expect(attrs.type).toBe('bottom');

    const noImage = await extractGarmentAttributes({ title: 'Polo Shirt' });
    expect(noImage.source).toBe('rules');
  });

  it('falls back to rules when the vision client is unavailable', async () => {
    const client = { isAvailable: vi.fn().mockResolvedValue(false) };
    const attrs = await extractGarmentAttributes({
      imageUrl: 'https://cdn.example.com/dress.webp',
      title: 'Floral Dress',
      client,
    });
    expect(attrs.source).toBe('rules');
    expect(attrs.pattern).toBe('floral');
  });

  it('uses validated vision output when the client succeeds', async () => {
    const client = {
      isAvailable: vi.fn().mockResolvedValue(true),
      analyzeOutfit: vi.fn().mockResolvedValue({
        content: 'Here you go: {"type":"dress","formality":"formal","warmth":"bogus","fabric":"silk","pattern":"floral","fit":"slim","colors":["Red","GOLD","blue","extra"]}',
      }),
    };
    const attrs = await extractGarmentAttributes({
      imageUrl: 'https://cdn.example.com/dress.webp',
      title: 'Evening Dress',
      client,
    });
    expect(attrs).toMatchObject({
      type: 'dress',
      formality: 'formal',
      pattern: 'floral',
      fit: 'slim',
      fabric: 'silk',
      source: 'vision',
    });
    // unknown enum -> falls back to rules value, colors clamped+lowercased to 3
    expect(attrs.warmth).toBeNull();
    expect(attrs.colors).toEqual(['red', 'gold', 'blue']);
    expect(client.analyzeOutfit).toHaveBeenCalledWith(
      'https://cdn.example.com/dress.webp',
      expect.any(String),
      expect.objectContaining({ model: 'qwen3-vl-flash' }),
    );
  });

  it('falls back to rules on vision errors or malformed JSON', async () => {
    const failing = {
      isAvailable: vi.fn().mockResolvedValue(true),
      analyzeOutfit: vi.fn().mockRejectedValue(new Error('upstream 500')),
    };
    const attrs = await extractGarmentAttributes({
      imageUrl: 'https://cdn.example.com/tee.webp',
      title: 'Graphic Tee',
      client: failing,
    });
    expect(attrs.source).toBe('rules');

    const malformed = {
      isAvailable: vi.fn().mockResolvedValue(true),
      analyzeOutfit: vi.fn().mockResolvedValue({ content: 'not json at all' }),
    };
    const attrs2 = await extractGarmentAttributes({
      imageUrl: 'https://cdn.example.com/tee.webp',
      title: 'Graphic Tee',
      client: malformed,
    });
    expect(attrs2.source).toBe('rules');
  });
});
