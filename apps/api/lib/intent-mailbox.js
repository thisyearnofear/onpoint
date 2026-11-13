/**
 * Pending-intent mailbox — the seller-agent split.
 *
 * A signed NEP-413 intent is safe to publish: whoever submits it to
 * execute_intents, the funds can only move to the intent's own
 * receiver_id. So the buyer hands its signed commitment to the API as a
 * mailbox, and an INDEPENDENT seller process (holding only the payee's
 * key) picks it up and executes it. Two agents, disjoint keys — the API
 * holds none.
 *
 * Lifecycle: pending → settled | expired | failed
 *   1. Buyer POSTs the order/try-on with {signedIntent} → the route
 *      structurally validates it (near-intents.validateSignedIntentPayload)
 *      and stores a record here → 202 {pendingId}.
 *   2. Seller agent polls GET /api/pending-intents?payee=<id>, executes
 *      the intent, re-POSTs the stored redeem body + intentsTxHash
 *      through the normal verify path, then calls complete().
 *   3. Buyer polls GET /api/pending-intents/:id for the outcome.
 *
 * In-memory like the negotiation sessions — swap to the sessions table
 * when persistence lands (same TTL discipline).
 */

const crypto = require('crypto');
const nearIntents = require('./near-intents');
const { persistedMap } = require('./kv-state');

const MAX_PENDING = 200;
const pending = persistedMap('intent_mailbox', { expiresAtOf: (p) => p.expiresAt }); // pendingId → record

function sweep(now = Date.now()) {
  for (const [id, p] of pending) {
    if (p.status === 'pending' && Date.parse(p.expiresAt) <= now) {
      p.status = 'expired';
    }
    if (pending.size > MAX_PENDING && p.status !== 'pending') pending.delete(id);
  }
}

/**
 * Validate + store a published intent.
 * Returns {ok, pendingId} or {ok:false, reason}.
 */
function submit({ signed, signedSwap, buyerAccountId, payee, minAmountBase, redeem }) {
  const check = nearIntents.validateSignedIntentPayload({
    signed,
    buyerAccountId,
    expectedPayeeId: payee,
    minAmountBase,
  });
  if (!check.ok) return { ok: false, reason: check.reason, detail: check };
  // Optional swap funding: the buyer also published a signed token_diff
  // (give another asset, get the settlement token). Its signer must be the
  // same buyer as the transfer; the counterparty mirror is the seller's
  // own sovereign signature, added at execution time.
  let swap = null;
  if (signedSwap) {
    const dCheck = nearIntents.validateSignedDiffPayload({
      signed: signedSwap,
      expectedSigner: check.signer,
      giveTokenId: signedSwap?.giveTokenId,
      minGetBase: check.amount,
    });
    if (!dCheck.ok) return { ok: false, reason: `swap_${dCheck.reason}`, detail: dCheck };
    swap = {
      signed: {
        standard: signedSwap.standard,
        payload: signedSwap.payload,
        signature: signedSwap.signature,
        public_key: signedSwap.public_key,
      },
      diff: dCheck.diff,
      giveTokenId: dCheck.giveTokenId,
      giveAmount: dCheck.giveAmount,
      getAmount: dCheck.getAmount,
    };
  }
  sweep();
  const pendingId = `pin_${crypto.randomBytes(9).toString('hex')}`;
  pending.set(pendingId, {
    pendingId,
    payee,
    buyer: check.signer, // the payload's signer_id is authoritative
    signed: {
      standard: signed.standard,
      payload: signed.payload,
      signature: signed.signature,
      public_key: signed.public_key,
    },
    swap,
    amountBase: check.amount,
    redeem: redeem || null, // { endpoint, body } the seller replays with intentsTxHash
    status: 'pending',
    createdAt: new Date().toISOString(),
    expiresAt: check.deadline ?? new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  return { ok: true, pendingId };
}

function list({ payee, solver } = {}) {
  sweep();
  return [...pending.values()]
    .filter((p) => p.status === 'pending' && (!payee || p.payee === payee))
    // Open solver queue: swap-funded intents are broadcast to ANY solver
    // (the mirror diff is counter-signed by whoever fills it) — the race is
    // won on-chain: the verifier consumes nonces, so a second executor's tx
    // fails and its late complete() report loses to the first.
    .filter((p) => !solver || !!p.swap)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function get(pendingId) {
  sweep();
  return pending.get(pendingId) ?? null;
}

/**
 * Executor (payee or solver) reports the outcome — RACE SEMANTICS: the
 * first completion wins. A solver that lost the on-chain race (its
 * execute_intents failed on consumed nonces, or a peer completed first)
 * gets { won:false, ...record } — the winning outcome is never overwritten.
 * Returns null only when the pendingId doesn't exist at all.
 */
function complete(pendingId, { txHash, status = 'settled', result, executor } = {}) {
  const p = pending.get(pendingId);
  if (!p) return null;
  if (p.status !== 'pending') return { ...p, won: false };
  // Solver-queue items: one executor's failure is NOT terminal — in a race,
  // a losing solver's report could land before the winner's, and the item
  // is still fillable by anyone else. Record the attempt, stay pending.
  // (Payee-only items keep first-wins semantics — the payee's own failure
  // is its sovereign decision to stop filling.)
  if (status === 'failed' && p.swap) {
    p.attempts = [...(p.attempts ?? []), { executor: executor ?? null, result, at: new Date().toISOString() }].slice(-10);
    pending.set(pendingId, p);
    return { ...p, won: false, attemptRecorded: true };
  }
  p.status = status;
  p.txHash = txHash ?? p.txHash;
  p.result = result ?? p.result;
  if (executor) p.executor = executor;
  p.completedAt = new Date().toISOString();
  pending.set(pendingId, p); // flush the mutated record
  return { ...p, won: true };
}

module.exports = { submit, list, get, complete };
