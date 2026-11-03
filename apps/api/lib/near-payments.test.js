import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  isNearAccountId,
  isNearTxHash,
  nearPayoutAccount,
  nearQuoteForUsd,
  nearRailEnabled,
  nearExplorerTxUrl,
  nearNetwork,
} = require('./near-payments');

const NEAR_ENV = ['NEAR_NETWORK', 'NEAR_RPC_URL', 'NEAR_USD_PRICE', 'NEAR_PAYOUT_ACCOUNT'];

describe('near-payments helpers', () => {
  beforeEach(() => NEAR_ENV.forEach((k) => delete process.env[k]));
  afterEach(() => NEAR_ENV.forEach((k) => delete process.env[k]));

  describe('isNearAccountId', () => {
    it('accepts named accounts and implicit ids', () => {
      expect(isNearAccountId('agent.onpoint.near')).toBe(true);
      expect(isNearAccountId('onpoint.testnet')).toBe(true);
      expect(isNearAccountId('ab')).toBe(true);
      expect(isNearAccountId('a'.repeat(64))).toBe(true); // implicit hex
      expect(isNearAccountId('cool_agent-1.near')).toBe(true);
    });

    it('rejects invalid forms', () => {
      expect(isNearAccountId('')).toBe(false);
      expect(isNearAccountId('A.near')).toBe(false); // uppercase
      expect(isNearAccountId('.near')).toBe(false); // leading separator
      expect(isNearAccountId('near.')).toBe(false); // trailing separator
      expect(isNearAccountId('-bad.near')).toBe(false);
      expect(isNearAccountId('bad..near')).toBe(false);
      expect(isNearAccountId('a'.repeat(65))).toBe(false);
      expect(isNearAccountId(null)).toBe(false);
      // 64 non-hex chars is a valid named account — only 64-hex is implicit
      expect(isNearAccountId('g'.repeat(64))).toBe(true);
    });
  });

  describe('isNearTxHash', () => {
    it('accepts base58 43–44 char hashes', () => {
      expect(isNearTxHash('CBqaUzXaKr657uCKT3ZNzE36GwARk83CdAExgGqyRRJ3')).toBe(true);
    });

    it('rejects non-base58 and wrong lengths', () => {
      expect(isNearTxHash('0x' + 'a'.repeat(64))).toBe(false); // evm shape
      expect(isNearTxHash('contains0OIl')).toBe(false);
      expect(isNearTxHash('short')).toBe(false);
      expect(isNearTxHash(null)).toBe(false);
    });
  });

  describe('nearPayoutAccount', () => {
    it('prefers curator commerce.nearAccountId over the env fallback', () => {
      process.env.NEAR_PAYOUT_ACCOUNT = 'platform.near';
      const curator = { commerce: { nearAccountId: 'curator.near' } };
      expect(nearPayoutAccount(curator)).toBe('curator.near');
    });

    it('falls back to env, and to null when neither is valid', () => {
      process.env.NEAR_PAYOUT_ACCOUNT = 'platform.testnet';
      expect(nearPayoutAccount({})).toBe('platform.testnet');
      delete process.env.NEAR_PAYOUT_ACCOUNT;
      expect(nearPayoutAccount({})).toBeNull();
      process.env.NEAR_PAYOUT_ACCOUNT = 'INVALID!';
      expect(nearPayoutAccount({})).toBeNull();
    });
  });

  describe('nearRailEnabled', () => {
    it('requires both a USD rate and a payout account', () => {
      expect(nearRailEnabled({})).toBe(false);
      process.env.NEAR_USD_PRICE = '2.5';
      expect(nearRailEnabled({})).toBe(false);
      process.env.NEAR_PAYOUT_ACCOUNT = 'platform.testnet';
      expect(nearRailEnabled({})).toBe(true);
    });
  });

  describe('nearQuoteForUsd', () => {
    it('converts USD to yoctoNEAR, rounding up to never undercharge', () => {
      process.env.NEAR_USD_PRICE = '2.5';
      const q = nearQuoteForUsd(0.05);
      expect(q.amountNear).toBe(0.02);
      expect(q.amountYocto).toBe('20000000000000000000000'); // 0.02 * 1e24
      expect(q.usdRate).toBe(2.5);
      expect(q.network).toBe('testnet');
    });

    it('rounds up at 1e-8 NEAR granularity', () => {
      process.env.NEAR_USD_PRICE = '3';
      const q = nearQuoteForUsd(0.01); // 0.003333... NEAR
      expect(q.amountNear).toBe(0.00333334);
      expect(BigInt(q.amountYocto)).toBeGreaterThanOrEqual(BigInt(Math.floor((0.01 / 3) * 1e24)));
    });

    it('returns null without a rate or valid usd', () => {
      expect(nearQuoteForUsd(0.05)).toBeNull();
      process.env.NEAR_USD_PRICE = '2.5';
      expect(nearQuoteForUsd(0)).toBeNull();
      expect(nearQuoteForUsd(NaN)).toBeNull();
    });
  });

  describe('network helpers', () => {
    it('defaults to testnet and produces matching explorer links', () => {
      expect(nearNetwork()).toBe('testnet');
      expect(nearExplorerTxUrl('ABC')).toBe('https://testnet.nearblocks.io/txns/ABC');
      process.env.NEAR_NETWORK = 'mainnet';
      expect(nearNetwork()).toBe('mainnet');
      expect(nearExplorerTxUrl('ABC')).toBe('https://nearblocks.io/txns/ABC');
    });
  });
});
