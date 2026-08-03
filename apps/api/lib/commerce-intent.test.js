import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { compileCommerceIntent, sanitizeIntent } = require('./commerce-intent');

describe('commerce intent compiler', () => {
  it('uses a lossless direct query when OpenAI is unavailable', async () => {
    const previous = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    const intent = await compileCommerceIntent('black Alo leggings under $130');
    expect(intent).toMatchObject({
      searchQuery: 'black Alo leggings under $130',
      provider: 'direct',
      model: null,
    });
    if (previous) process.env.OPENAI_API_KEY = previous;
  });

  it('credits OpenAI only when a valid compiled intent is returned', async () => {
    const create = vi.fn().mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              search_query: 'black Alo Yoga leggings women max $130',
              constraints: {
                brand: 'Alo Yoga',
                color: 'black',
                max_price: 130,
                currency: 'USD',
              },
            }),
          },
        },
      ],
    });
    const intent = await compileCommerceIntent(
      'black Alo leggings under $130 test-unique',
      {
        client: { chat: { completions: { create } } },
        model: 'gpt-test',
      },
    );
    expect(create).toHaveBeenCalledOnce();
    expect(intent).toMatchObject({
      provider: 'openai',
      model: 'gpt-test',
      constraints: { brand: 'Alo Yoga', max_price: 130 },
    });
  });

  it('does not credit OpenAI for an empty model result', () => {
    expect(sanitizeIntent({}, 'women’s jacket', 'gpt-test')).toMatchObject({
      provider: 'direct',
      searchQuery: 'women’s jacket',
    });
  });
});
