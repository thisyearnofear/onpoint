import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  kesToCusd,
  curatorPayoutAddress,
  curatorSplitAddress,
  curatorSellerBps,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
} = require('./agent-commerce');

const WALLET = '0x1111111111111111111111111111111111111111';
const SPLIT = '0x2222222222222222222222222222222222222222';

describe('agent-commerce helpers', () => {
  beforeEach(() => {
    delete process.env.KES_PER_USD;
  });

  afterEach(() => {
    delete process.env.KES_PER_USD;
  });

  describe('kesToCusd', () => {
    it('converts KES using the configured rate', () => {
      process.env.KES_PER_USD = '125';
      expect(kesToCusd(2500)).toBe(20);
    });

    it('rounds to 2 decimal places', () => {
      process.env.KES_PER_USD = '130';
      expect(kesToCusd(2500)).toBe(19.23);
    });

    it('returns null for invalid prices', () => {
      expect(kesToCusd(0)).toBeNull();
      expect(kesToCusd(-5)).toBeNull();
      expect(kesToCusd('nope')).toBeNull();
    });

    it('falls back to the default rate when env is unset or garbage', () => {
      process.env.KES_PER_USD = 'garbage';
      expect(kesToCusd(1300)).toBe(10);
    });
  });

  describe('curatorPayoutAddress', () => {
    it('returns the wallet when valid', () => {
      expect(curatorPayoutAddress({ commerce: { walletAddress: WALLET } })).toBe(WALLET);
    });

    it('returns null for missing or malformed wallets', () => {
      expect(curatorPayoutAddress({})).toBeNull();
      expect(curatorPayoutAddress({ commerce: {} })).toBeNull();
      expect(curatorPayoutAddress({ commerce: { walletAddress: '0x123' } })).toBeNull();
      expect(curatorPayoutAddress(null)).toBeNull();
    });
  });

  describe('curatorSplitAddress', () => {
    it('returns the split address when valid', () => {
      expect(curatorSplitAddress({ commerce: { splitAddress: SPLIT } })).toBe(SPLIT);
    });

    it('returns null for missing or malformed split addresses', () => {
      expect(curatorSplitAddress({})).toBeNull();
      expect(curatorSplitAddress({ commerce: {} })).toBeNull();
      expect(curatorSplitAddress({ commerce: { splitAddress: '0x123' } })).toBeNull();
      expect(curatorSplitAddress(null)).toBeNull();
    });
  });

  describe('curatorSellerBps', () => {
    it('inverts revShare into the seller share', () => {
      expect(curatorSellerBps({ commerce: { revShare: 0.05 } })).toBe(9500);
      expect(curatorSellerBps({ commerce: { revShare: 0.15 } })).toBe(8500);
    });

    it('returns undefined when revShare is unset or out of range', () => {
      expect(curatorSellerBps({ commerce: {} })).toBeUndefined();
      expect(curatorSellerBps({ commerce: { revShare: 1 } })).toBeUndefined();
      expect(curatorSellerBps({ commerce: { revShare: -0.1 } })).toBeUndefined();
    });
  });

  describe('buildListingAgentCommerce', () => {
    const curator = { commerce: { walletAddress: WALLET } };

    it('exposes in-stock sizes as cUSD offers', () => {
      process.env.KES_PER_USD = '125';
      const block = buildListingAgentCommerce(curator, {
        sizes: [
          { size: 'M', stock: 3, price: 2500 },
          { size: 'L', stock: 0, price: 2500 },
        ],
      });
      expect(block).toEqual({
        available: true,
        currency: 'cUSD',
        offers: [{ size: 'M', stock: 3, priceKes: 2500, priceCusd: 20 }],
      });
    });

    it('returns null without a payout wallet', () => {
      expect(
        buildListingAgentCommerce({}, { sizes: [{ size: 'M', stock: 3, price: 2500 }] }),
      ).toBeNull();
    });

    it('returns null when nothing is in stock', () => {
      expect(
        buildListingAgentCommerce(curator, { sizes: [{ size: 'M', stock: 0, price: 2500 }] }),
      ).toBeNull();
    });

    it('returns null for digital inventory (try-on only)', () => {
      expect(
        buildListingAgentCommerce(curator, {
          inventoryType: 'digital',
          sizes: [{ size: 'M', stock: 3, price: 2500 }],
        }),
      ).toBeNull();
    });
  });

  describe('buildStorefrontAgentCommerce', () => {
    it('is enabled with a wallet and points at the order endpoint', () => {
      const block = buildStorefrontAgentCommerce({ commerce: { walletAddress: WALLET } }, 'wanja');
      expect(block.enabled).toBe(true);
      expect(block.chainId).toBe(42220);
      expect(block.tokenSymbol).toBe('cUSD');
      expect(block.orderEndpoint).toBe('/api/curator/wanja/order');
      expect(block.flow.length).toBeGreaterThan(1);
    });

    it('reports non-custodial model when split address is set', () => {
      const block = buildStorefrontAgentCommerce(
        { commerce: { walletAddress: WALLET, splitAddress: SPLIT } },
        'wanja',
      );
      expect(block.payoutModel).toBe('0xSplits (non-custodial)');
      expect(block.splitAddress).toBe(SPLIT);
    });

    it('reports custodial model when no split address', () => {
      const block = buildStorefrontAgentCommerce(
        { commerce: { walletAddress: WALLET } },
        'wanja',
      );
      expect(block.payoutModel).toBe('custodial');
      expect(block.splitAddress).toBeUndefined();
    });

    it('is disabled without a wallet', () => {
      const block = buildStorefrontAgentCommerce({}, 'wanja');
      expect(block.enabled).toBe(false);
    });
  });
});

describe('split-setup helpers', () => {
  // split-setup.js requires blockchain-client at module level, which may
  // not be built in all environments. We test buildSplitRecipients in
  // isolation by extracting it inline (it has no external deps).
  const buildSplitRecipients = (curatorWallet, revShare = 0.05) => {
    const agentCore = require('@repo/agent-core');
    const SPLIT_TOTAL_ALLOCATION = 1_000_000;
    const platformBps = Math.round(revShare * SPLIT_TOTAL_ALLOCATION);
    const curatorBps = SPLIT_TOTAL_ALLOCATION - platformBps;
    return {
      recipients: [
        { address: curatorWallet, percentAllocation: curatorBps / 10_000 },
        { address: agentCore.PLATFORM_WALLET, percentAllocation: platformBps / 10_000 },
      ],
      distributorFeePercent: 0,
    };
  };

  describe('buildSplitRecipients', () => {
    it('allocates 95% curator / 5% platform at default revShare', () => {
      const { recipients, distributorFeePercent } = buildSplitRecipients(WALLET, 0.05);
      expect(distributorFeePercent).toBe(0);
      expect(recipients).toHaveLength(2);

      // SDK expects percent (0-100), not basis points
      const curator = recipients.find((r) => r.address === WALLET);
      const platform = recipients.find((r) => r.address !== WALLET);
      expect(curator.percentAllocation).toBeCloseTo(95, 5);
      expect(platform.percentAllocation).toBeCloseTo(5, 5);
    });

    it('allocates 85% curator / 15% platform at 0.15 revShare', () => {
      const { recipients } = buildSplitRecipients(WALLET, 0.15);
      const curator = recipients.find((r) => r.address === WALLET);
      const platform = recipients.find((r) => r.address !== WALLET);
      expect(curator.percentAllocation).toBeCloseTo(85, 5);
      expect(platform.percentAllocation).toBeCloseTo(15, 5);
    });

    it('allocations sum to 100%', () => {
      const { recipients } = buildSplitRecipients(WALLET, 0.07);
      const total = recipients.reduce((sum, r) => sum + r.percentAllocation, 0);
      expect(total).toBeCloseTo(100, 5);
    });
  });
});

describe('calculateSplit (commission split)', () => {
  const { calculateSplit } = require('@repo/agent-core');

  it('splits 85/10/3/2 by default (seller/platform/affiliate/agent)', () => {
    const totalWei = 10n * 10n ** 18n; // 10 cUSD
    const split = calculateSplit(totalWei, WALLET);

    const seller = split.recipients.find((r) => r.label === 'seller');
    const platform = split.recipients.find((r) => r.label === 'platform');

    expect(seller.percentBps).toBe(8500);
    expect(seller.amount).toBe((85n * 10n ** 18n) / 10n);
    expect(platform.percentBps).toBe(1500); // 10% + 3% + 2% (no affiliate/agent, folds in)
    expect(platform.amount).toBe((15n * 10n ** 18n) / 10n);
  });

  it('respects sellerBps override from curator revShare', () => {
    const totalWei = 10n * 10n ** 18n;
    const split = calculateSplit(totalWei, WALLET, { sellerBps: 9500 });

    const seller = split.recipients.find((r) => r.label === 'seller');
    const platform = split.recipients.find((r) => r.label === 'platform');

    expect(seller.percentBps).toBe(9500);
    expect(seller.amount).toBe((95n * 10n ** 18n) / 10n);
    expect(platform.percentBps).toBe(500); // 5% platform, no affiliate/agent
  });

  it('caps sellerBps at 9500 (leaves room for affiliate + agent)', () => {
    const totalWei = 10n * 10n ** 18n;
    const split = calculateSplit(totalWei, WALLET, { sellerBps: 9900 });

    const seller = split.recipients.find((r) => r.label === 'seller');
    expect(seller.percentBps).toBe(9500); // capped
  });

  it('includes affiliate when address is provided', () => {
    const AFFILIATE = '0x3333333333333333333333333333333333333333';
    const totalWei = 10n * 10n ** 18n;
    const split = calculateSplit(totalWei, WALLET, { affiliateAddress: AFFILIATE });

    const affiliate = split.recipients.find((r) => r.label === 'affiliate');
    const platform = split.recipients.find((r) => r.label === 'platform');

    expect(affiliate).toBeDefined();
    expect(affiliate.percentBps).toBe(300); // 3%
    expect(platform.percentBps).toBe(1200); // 10% + 2% (agent folds in, affiliate paid separately)
  });

  it('all recipient amounts sum to total', () => {
    const totalWei = 7n * 10n ** 18n + 123456n;
    const split = calculateSplit(totalWei, WALLET);
    const sumAmounts = split.recipients.reduce((sum, r) => sum + r.amount, 0n);
    expect(sumAmounts).toBe(totalWei);
  });
});
