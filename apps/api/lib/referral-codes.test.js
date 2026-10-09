import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { deriveReferralCode, isValidAddress, resolveReferralAgent } = require('./referral-codes');

const ADDR = '0xAbCdEf0123456789aBcDeF0123456789abcdef01';
const OTHER = '0xabcdef01ffffffffffffffffffffffffffffffff';

// Minimal stand-ins for drizzle's `sql` tag and db.execute.
const sql = (strings, ...values) => ({ text: strings.join('?'), values });
function fakeDb({ referrals = [], looks = [] } = {}) {
  const calls = [];
  return {
    calls,
    async execute(q) {
      calls.push(q.text);
      if (q.text.includes('FROM agent_referrals')) return referrals;
      if (q.text.includes('FROM agent_looks')) return { rows: looks };
      throw new Error('unexpected query');
    },
  };
}

describe('deriveReferralCode', () => {
  it('keeps the address casing so issued codes stay valid', () => {
    expect(deriveReferralCode(ADDR)).toBe('ref_AbCdEf01');
  });
  it('rejects non-addresses', () => {
    expect(deriveReferralCode('ref_abcdef01')).toBeNull();
    expect(deriveReferralCode(undefined)).toBeNull();
    expect(isValidAddress('0x123')).toBe(false);
  });
});

describe('resolveReferralAgent', () => {
  it('uses a full address directly without querying', async () => {
    const db = fakeDb();
    expect(await resolveReferralAgent(db, sql, ADDR)).toEqual({ address: ADDR, reason: 'address' });
    expect(db.calls).toHaveLength(0);
  });

  it('rejects malformed codes without querying', async () => {
    const db = fakeDb();
    for (const bad of ['', 'ref_zz', 'ref_abcdef0', "ref_abcdef01'; drop", 'hello', 42]) {
      expect((await resolveReferralAgent(db, sql, bad)).reason).toBe('invalid');
    }
    expect(db.calls).toHaveLength(0);
  });

  it('prefers a previous referral row with a valid address', async () => {
    const db = fakeDb({ referrals: [{ agent_address: ADDR }] });
    expect(await resolveReferralAgent(db, sql, 'ref_abcdef01')).toEqual({ address: ADDR, reason: 'known' });
  });

  it('ignores legacy rows that stored the raw code as the address', async () => {
    const db = fakeDb({
      referrals: [{ agent_address: 'ref_abcdef01' }],
      looks: [{ agent_address: ADDR.toLowerCase() }],
    });
    expect(await resolveReferralAgent(db, sql, 'ref_abcdef01')).toEqual({
      address: ADDR.toLowerCase(),
      reason: 'look_owner',
    });
  });

  it('resolves a first-ever referral through the look owner', async () => {
    const db = fakeDb({ looks: [{ agent_address: ADDR.toLowerCase() }] });
    const r = await resolveReferralAgent(db, sql, 'ref_ABCDEF01'); // case-insensitive
    expect(r).toEqual({ address: ADDR.toLowerCase(), reason: 'look_owner' });
  });

  it('refuses ambiguous prefixes instead of guessing who to pay', async () => {
    const db = fakeDb({ looks: [{ agent_address: ADDR.toLowerCase() }, { agent_address: OTHER }] });
    expect(await resolveReferralAgent(db, sql, 'ref_abcdef01')).toEqual({ address: null, reason: 'ambiguous' });
  });

  it('returns unknown when nobody owns the code, never the code itself', async () => {
    const db = fakeDb();
    const r = await resolveReferralAgent(db, sql, 'ref_deadbeef');
    expect(r).toEqual({ address: null, reason: 'unknown' });
  });
});
