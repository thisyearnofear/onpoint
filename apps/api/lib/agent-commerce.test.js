import { createRequire } from 'node:module';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  kesToCusd,
  curatorPayoutAddress,
  curatorSellerBps,
  buildListingAgentCommerce,
  buildStorefrontAgentCommerce,
} = require('./agent-commerce');

const WALLET = '0x1111111111111111111111111111111111111111';

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

    it('is disabled without a wallet', () => {
      const block = buildStorefrontAgentCommerce({}, 'wanja');
      expect(block.enabled).toBe(false);
    });
  });
});
