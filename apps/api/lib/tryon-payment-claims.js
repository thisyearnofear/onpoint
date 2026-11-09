/**
 * Claim-first payment gate for paid try-on renders.
 *
 * One proof id (a Celo tx hash, PayPal capture id, NEAR tx hash, or an OKX
 * facade synthetic id) unlocks exactly one render. The gate is acquired
 * BEFORE the paid render runs, so a lost race can never hand back a second
 * render for a single payment.
 *
 * State lives in payments.metadata.status (no schema migration required):
 *   processing    — claim held, render in flight
 *   completed     — render delivered; metadata.renderKey holds the artifact
 *   render_failed — render errored; the claim can be retaken for a retry
 * Rows written before this gate existed have no status and are treated as
 * completed (the old flow only ledgered after a successful render).
 *
 * Atomicity comes from the store, not this module: insertIfAbsent uses the
 * unique tx_hash constraint (ON CONFLICT DO NOTHING), and reclaimIf is a
 * conditional UPDATE ... RETURNING so only one retry wins a released claim.
 * This module only decides WHICH primitive to call and interprets the result.
 */

const { eq, and, sql } = require('drizzle-orm');

/** A processing claim older than this is presumed crashed and reclaimable. */
const CLAIM_STALE_MS = 10 * 60 * 1000;

/**
 * Decide the outcome of submitting a proof id.
 *
 * @param {object} store — atomic primitives (see createDrizzleClaimStore)
 * @param {object} opts
 * @param {string} opts.proofId — unique payment proof (tx hash / capture id)
 * @param {object} opts.values — payment row values (metadata WITHOUT status)
 * @param {number} [opts.now] — injectable clock for stale-claim tests
 * @returns {Promise<{outcome:'claimed'|'replay'|'conflict', paymentId?:string,
 *   reclaimed?:boolean, row?:object, status?:string}>}
 */
async function acquireTryOnClaim(store, { proofId, values, now = Date.now() }) {
  const processingValues = {
    ...values,
    metadata: { ...(values.metadata || {}), status: 'processing' },
  };

  const inserted = await store.insertIfAbsent(proofId, processingValues);
  if (inserted) return { outcome: 'claimed', paymentId: inserted.id };

  const existing = await store.findByProof(proofId);
  if (!existing) return { outcome: 'conflict', status: 'unknown' };

  const status = existing.status || 'completed'; // legacy rows predate status

  if (status === 'completed') {
    if (existing.renderKey) {
      return { outcome: 'replay', paymentId: existing.id, row: existing };
    }
    return { outcome: 'conflict', status: 'completed' };
  }

  if (status === 'render_failed') {
    const reclaimed = await store.reclaimIf(proofId, {
      statuses: ['render_failed'],
      values: processingValues,
    });
    if (reclaimed) return { outcome: 'claimed', paymentId: reclaimed.id, reclaimed: true };
    return { outcome: 'conflict', status: 'processing' };
  }

  // status === 'processing': only reclaim if the holder looks crashed.
  const staleBefore = new Date(now - CLAIM_STALE_MS);
  if (existing.createdAt && new Date(existing.createdAt) < staleBefore) {
    const reclaimed = await store.reclaimIf(proofId, {
      statuses: ['processing'],
      staleBefore,
      values: processingValues,
    });
    if (reclaimed) return { outcome: 'claimed', paymentId: reclaimed.id, reclaimed: true };
  }
  return { outcome: 'conflict', status: 'processing' };
}

/**
 * Drizzle/Neon adapter. Each method is a single atomic statement; the
 * uniqueness and conditional-update guarantees are enforced by Postgres.
 *
 * @param {object} db — drizzle instance
 * @param {object} paymentsTable — the payments schema table
 */
function createDrizzleClaimStore(db, paymentsTable) {
  return {
    async insertIfAbsent(proofId, values) {
      const rows = await db
        .insert(paymentsTable)
        .values({ ...values, txHash: proofId })
        .onConflictDoNothing({ target: paymentsTable.txHash })
        .returning({ id: paymentsTable.id });
      return rows[0] || null;
    },

    async findByProof(proofId) {
      const rows = await db
        .select({
          id: paymentsTable.id,
          metadata: paymentsTable.metadata,
          createdAt: paymentsTable.createdAt,
        })
        .from(paymentsTable)
        .where(eq(paymentsTable.txHash, proofId))
        .limit(1);
      const r = rows[0];
      if (!r) return null;
      const meta = r.metadata || {};
      return {
        id: r.id,
        status: meta.status || null,
        renderKey: meta.renderKey || null,
        createdAt: r.createdAt,
        metadata: meta,
      };
    },

    async reclaimIf(proofId, { statuses, staleBefore, values }) {
      const conditions = [
        eq(paymentsTable.txHash, proofId),
        sql`metadata->>'status' = ANY(${statuses}::text[])`,
      ];
      if (staleBefore) {
        conditions.push(sql`created_at < ${staleBefore.toISOString()}::timestamptz`);
      }
      const rows = await db
        .update(paymentsTable)
        .set({ ...values, createdAt: new Date() })
        .where(and(...conditions))
        .returning({ id: paymentsTable.id });
      return rows[0] || null;
    },

    async markCompleted(id, renderKey) {
      await db
        .update(paymentsTable)
        .set({
          metadata: sql`jsonb_set(jsonb_set(metadata, '{status}', '"completed"'), '{renderKey}', to_jsonb(${renderKey}::text))`,
        })
        .where(eq(paymentsTable.id, id));
    },

    async markFailed(id) {
      await db
        .update(paymentsTable)
        .set({ metadata: sql`jsonb_set(metadata, '{status}', '"render_failed"')` })
        .where(eq(paymentsTable.id, id));
    },
  };
}

module.exports = { acquireTryOnClaim, createDrizzleClaimStore, CLAIM_STALE_MS };
