import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import sharp from 'sharp';

const require = createRequire(import.meta.url);
const photo = require('./photo');

const fixture = (name) => readFileSync(join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures', name));

describe('runway photo', () => {
  it('normalises a HEIC data URL to a resized jpeg', async () => {
    const heic = fixture('sample.heic');
    const out = await photo.normaliseDataUrl(`data:image/heic;base64,${heic.toString('base64')}`);
    expect(out.startsWith('data:image/jpeg;base64,')).toBe(true);
    const meta = await sharp(Buffer.from(out.split(',')[1], 'base64')).metadata();
    expect(meta.format).toBe('jpeg');
    expect(Math.max(meta.width, meta.height)).toBeLessThanOrEqual(1024);
  });

  it('still normalises jpeg data URLs', async () => {
    const src = await sharp({ create: { width: 8, height: 8, channels: 3, background: '#333' } }).jpeg().toBuffer();
    const out = await photo.normaliseDataUrl(`data:image/jpeg;base64,${src.toString('base64')}`);
    expect(out.startsWith('data:image/jpeg;base64,')).toBe(true);
  });

  it('rejects non-image data URLs', async () => {
    await expect(photo.normaliseDataUrl('data:text/plain;base64,aGk=')).rejects.toThrow('unsupported');
  });
});
