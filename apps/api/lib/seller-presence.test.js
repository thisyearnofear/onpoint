import { beforeEach, describe, expect, it } from 'vitest';

const presence = require('./seller-presence');

const PAYEE = 'store.onpoint.testnet';

beforeEach(() => {
  presence._seen.clear();
});

describe('seller-presence', () => {
  it('beat marks a payee fresh for 45s', () => {
    const now = 1_000_000;
    presence.beat(PAYEE, now);
    expect(presence.isFresh(PAYEE, now)).toBe(true);
    expect(presence.isFresh(PAYEE, now + presence.FRESH_MS - 1)).toBe(true);
    expect(presence.isFresh(PAYEE, now + presence.FRESH_MS)).toBe(false);
  });

  it('unknown payee is not fresh', () => {
    expect(presence.isFresh('nobody.testnet')).toBe(false);
    expect(presence.lastSeen('nobody.testnet')).toBeNull();
  });

  it('lastSeen returns the stamped record', () => {
    const now = 1_000_000;
    presence.beat(PAYEE, now);
    const rec = presence.lastSeen(PAYEE);
    expect(rec.payee).toBe(PAYEE);
    expect(rec.lastSeenAt).toBe(now);
    expect(rec.lastSeenIso).toBe(new Date(now).toISOString());
  });

  it('a later beat refreshes freshness', () => {
    const t0 = 1_000_000;
    presence.beat(PAYEE, t0);
    presence.beat(PAYEE, t0 + 40_000);
    expect(presence.isFresh(PAYEE, t0 + 40_000 + presence.FRESH_MS - 1)).toBe(true);
  });

  it('sweep drops records older than 10 minutes', () => {
    const t0 = 1_000_000;
    presence.beat(PAYEE, t0);
    presence.beat('other.testnet', t0 + 11 * 60 * 1000); // triggers sweep
    expect(presence.lastSeen(PAYEE)).toBeNull();
    expect(presence.lastSeen('other.testnet')).not.toBeNull();
  });
});
