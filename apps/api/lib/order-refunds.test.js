import { describe, expect, it } from 'vitest';

const {
  CUSD_PAYMENT_METHOD,
  FACILITATOR_PAYMENT_METHOD,
  SPLIT_PAYMENT_METHOD,
  REFUND_STATUS,
  paymentMethodForOrder,
  paymentAssetForOrder,
  isAutomaticCusdRefundEligible,
  decimalToAtomic,
} = require('./order-refunds');

const BUYER = '0x1111111111111111111111111111111111111111';
const CUSD = '0x765de816845861e75a25fca122bb6898b8b1282a';
const USDC = 'eip155:42220/erc20:0xceba9300f2b948710d2653dd7b07f33a8b32118c';

describe('order refund contract', () => {
  it('classifies custodial, facilitator, and split payment rails', () => {
    expect(paymentMethodForOrder({ usingSplit: false, settlementTxHash: null })).toBe(CUSD_PAYMENT_METHOD);
    expect(paymentMethodForOrder({ usingSplit: false, settlementTxHash: '0xsettled' })).toBe(FACILITATOR_PAYMENT_METHOD);
    expect(paymentMethodForOrder({ usingSplit: true, settlementTxHash: null })).toBe(SPLIT_PAYMENT_METHOD);
    expect(paymentAssetForOrder({ usingSplit: false, settlementTxHash: null, cusdAsset: CUSD, usdcAsset: USDC })).toBe(CUSD);
    expect(paymentAssetForOrder({ usingSplit: false, settlementTxHash: '0xsettled', cusdAsset: CUSD, usdcAsset: USDC })).toBe(USDC);
    expect(paymentAssetForOrder({ usingSplit: true, settlementTxHash: null, cusdAsset: CUSD, usdcAsset: USDC })).toBe(CUSD);
  });

  it('converts currency strings to exact atomic units', () => {
    expect(decimalToAtomic('12.50', 18)).toBe(12500000000000000000n);
    expect(decimalToAtomic('0.000000000000000001', 18)).toBe(1n);
    expect(() => decimalToAtomic('12.1234567890123456789', 18)).toThrow();
  });

  it('only allows pending/failed custodial cUSD refunds to a valid buyer', () => {
    const base = {
      source: 'agent',
      status: 'cancelled',
      paymentMethod: CUSD_PAYMENT_METHOD,
      paymentAsset: CUSD,
      buyerAddress: BUYER,
      amountCusd: '12.50',
    };
    expect(isAutomaticCusdRefundEligible(base, { cusdAsset: CUSD })).toBe(true);
    expect(isAutomaticCusdRefundEligible({ ...base, refundStatus: REFUND_STATUS.PROCESSING }, { cusdAsset: CUSD })).toBe(false);
    expect(isAutomaticCusdRefundEligible({ ...base, refundTxHash: '0xrefund' }, { cusdAsset: CUSD })).toBe(false);
    expect(isAutomaticCusdRefundEligible({ ...base, paymentAsset: USDC }, { cusdAsset: CUSD })).toBe(false);
    expect(isAutomaticCusdRefundEligible({ ...base, paymentMethod: FACILITATOR_PAYMENT_METHOD }, { cusdAsset: CUSD })).toBe(false);
    expect(isAutomaticCusdRefundEligible({ ...base, buyerAddress: '0x123' }, { cusdAsset: CUSD })).toBe(false);
  });
});
