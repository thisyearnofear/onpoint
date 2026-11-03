import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { playerHash } = require('./player-hash');

const KEY = 'RUNWAY_PLAYER_SALT';

describe('playerHash', () => {
  afterEach(() => delete process.env[KEY]);

  it('is deterministic and returns 16 hex chars', () => {
    const a = playerHash('web:550e8400-e29b-41d4-a716-446655440000');
    const b = playerHash('web:550e8400-e29b-41d4-a716-446655440000');
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{16}$/);
  });

  it('differs per chat id and never exposes the raw id', () => {
    const a = playerHash('web:uuid-1');
    const b = playerHash('+15551234567');
    expect(a).not.toBe(b);
    expect(a).not.toContain('uuid-1');
    expect(b).not.toContain('5551234');
  });

  it('changes with RUNWAY_PLAYER_SALT', () => {
    const before = playerHash('web:x');
    process.env[KEY] = 'other-salt';
    const after = playerHash('web:x');
    expect(after).not.toBe(before);
  });

  it('returns null for empty input', () => {
    expect(playerHash('')).toBeNull();
    expect(playerHash(null)).toBeNull();
    expect(playerHash(undefined)).toBeNull();
  });
});
