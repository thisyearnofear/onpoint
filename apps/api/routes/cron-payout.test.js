import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./cron-payout.js', import.meta.url), 'utf8');

describe('cron payout safety contract', () => {
  it('does not auto-pay legacy orders with unknown payment rails', () => {
    expect(source).toContain('sql`${orders.paymentMethod} = ${CUSD_PAYMENT_METHOD}`');
    expect(source).toContain('sql`${orders.paymentAsset} = ${sharedTypes.X402_ASSET}`');
    expect(source).toContain('sql`${orders.paymentMethod} = ${SPLIT_PAYMENT_METHOD}`');
    expect(source).toContain("sql`${orders.refundStatus} IS NULL`");
  });

  it('quarantines stale pending and processing refunds instead of blind retries', () => {
    expect(source).toContain('Pending payment claim timed out; verify stock reservation before resolving');
    expect(source).toContain('Refund transfer may have committed; verify on-chain before retrying');
    expect(source).toContain("eq(orders.refundStatus, REFUND_STATUS.PROCESSING)");
  });
});
