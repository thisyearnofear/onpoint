import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./curator-storefront.js', import.meta.url), 'utf8');

describe('curator storefront stock decrement contract', () => {
  it('re-evaluates stock inside the guarded row update', () => {
    expect(source).toContain('UPDATE ${listings} AS inventory');
    expect(source).toContain("(size_entry->>'stock')::int >= ${quantity}");
    expect(source).toContain('jsonb_agg(');
    expect(source).toContain("status: 'pending'");
    expect(source).toContain("status: 'confirmed'");
    expect(source).toContain("eq(orders.status, 'pending')");
  });

  it('normalizes checkout size matching and persisted order size', () => {
    expect(source).toContain('normalizeSize(entry.size) === requestedSize');
    expect(source).toContain('size: requestedSize');
    expect(source).toContain('refundStatus');
    expect(source).toContain('paymentMethod,');
  });
});
