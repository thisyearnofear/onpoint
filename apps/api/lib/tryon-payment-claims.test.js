import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { acquireTryOnClaim, CLAIM_STALE_MS } = require('./tryon-payment-claims');

/**
 * In-memory store mirroring the Postgres guarantees the Drizzle adapter
 * relies on: insertIfAbsent is check-and-insert atomic (unique tx_hash),
 * reclaimIf is a conditional update atomic on the status predicate. Each
 * method body runs synchronously (no internal await), so concurrent
 * acquireTryOnClaim calls interleave only BETWEEN primitives — exactly how
 * separate HTTP requests interleave against the database.
 */
function createMemoryStore() {
  const rows = new Map(); // proofId -> row
  let seq = 0;
  return {
    rows,
    async insertIfAbsent(proofId, values) {
      if (rows.has(proofId)) return null;
      const id = `pay-${++seq}`;
      rows.set(proofId, { id, txHash: proofId, createdAt: new Date(), ...values });
      return { id };
    },
    async findByProof(proofId) {
      const r = rows.get(proofId);
      if (!r) return null;
      const meta = r.metadata || {};
      return { id: r.id, status: meta.status || null, renderKey: meta.renderKey || null, createdAt: r.createdAt, metadata: meta };
    },
    async reclaimIf(proofId, { statuses, staleBefore, values }) {
      const r = rows.get(proofId);
      if (!r) return null;
      const status = r.metadata?.status || 'completed';
      if (!statuses.includes(status)) return null;
      if (staleBefore && !(new Date(r.createdAt) < staleBefore)) return null;
      Object.assign(r, values, { createdAt: new Date() });
      return { id: r.id };
    },
    async markCompleted(id, renderKey) {
      for (const r of rows.values()) {
        if (r.id === id) r.metadata = { ...r.metadata, status: 'completed', renderKey };
      }
    },
    async markFailed(id) {
      for (const r of rows.values()) {
        if (r.id === id) r.metadata = { ...r.metadata, status: 'render_failed' };
      }
    },
  };
}

const VALUES = { purpose: 'try_on', curatorSlug: 'nia', amountCusd: '0.03', metadata: { listingId: 'L1' } };

describe('acquireTryOnClaim — one proof, one render', () => {
  it('5 concurrent claims on one proof yield exactly one winner; losers carry no render', async () => {
    const store = createMemoryStore();
    const results = await Promise.all(
      Array.from({ length: 5 }, () => acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES })),
    );
    const winners = results.filter((r) => r.outcome === 'claimed');
    const losers = results.filter((r) => r.outcome === 'conflict');
    expect(winners).toHaveLength(1);
    expect(losers).toHaveLength(4);
    expect(store.rows.size).toBe(1);
    for (const loser of losers) {
      expect(loser.status).toBe('processing');
      expect(loser.render).toBeUndefined();
      expect(loser.row).toBeUndefined();
    }
  });

  it('a second submission after completion replays the stored artifact (no re-render)', async () => {
    const store = createMemoryStore();
    const first = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    expect(first.outcome).toBe('claimed');
    await store.markCompleted(first.paymentId, 'polaroids/x.jpg');

    const again = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    expect(again.outcome).toBe('replay');
    expect(again.paymentId).toBe(first.paymentId);
    expect(again.row.renderKey).toBe('polaroids/x.jpg');
    expect(store.rows.size).toBe(1); // no second row, no second render
  });

  it('a completed claim with no stored artifact is a plain conflict', async () => {
    const store = createMemoryStore();
    const first = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    await store.markCompleted(first.paymentId, null);
    const again = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    expect(again.outcome).toBe('conflict');
    expect(again.status).toBe('completed');
  });

  it('a render failure releases the claim so a retry re-renders exactly once', async () => {
    const store = createMemoryStore();
    const first = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    await store.markFailed(first.paymentId);

    const retries = await Promise.all(
      Array.from({ length: 3 }, () => acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES })),
    );
    const winners = retries.filter((r) => r.outcome === 'claimed');
    expect(winners).toHaveLength(1);
    expect(winners[0].reclaimed).toBe(true);
    expect(winners[0].paymentId).toBe(first.paymentId); // same ledger row reused
    expect(retries.filter((r) => r.outcome === 'conflict')).toHaveLength(2);
  });

  it('a fresh processing claim is not reclaimable; a stale one is', async () => {
    const store = createMemoryStore();
    const first = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES });
    expect(first.outcome).toBe('claimed');

    // 1 minute later: holder still presumed alive → conflict
    const fresh = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES, now: Date.now() + 60_000 });
    expect(fresh.outcome).toBe('conflict');
    expect(fresh.status).toBe('processing');

    // past the stale window: crashed holder → reclaim
    const stale = await acquireTryOnClaim(store, { proofId: '0xabc', values: VALUES, now: Date.now() + CLAIM_STALE_MS + 1000 });
    expect(stale.outcome).toBe('claimed');
    expect(stale.reclaimed).toBe(true);
    expect(stale.paymentId).toBe(first.paymentId);
  });

  it('treats legacy rows (no status) as completed', async () => {
    const store = createMemoryStore();
    store.rows.set('0xlegacy', { id: 'old-1', txHash: '0xlegacy', createdAt: new Date(), metadata: { listingId: 'L0', renderKey: 'polaroids/old.jpg' } });
    const res = await acquireTryOnClaim(store, { proofId: '0xlegacy', values: VALUES });
    expect(res.outcome).toBe('replay');
    expect(res.row.renderKey).toBe('polaroids/old.jpg');
  });
});
