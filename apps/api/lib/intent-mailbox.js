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

function list({ payee } = {}) {
  sweep();
  return [...pending.values()]
    .filter((p) => p.status === 'pending' && (!payee || p.payee === payee))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function get(pendingId) {
  sweep();
  return pending.get(pendingId) ?? null;
}

/** Seller executed + redeemed — record the outcome for the buyer's poll. */
function complete(pendingId, { txHash, status = 'settled', result } = {}) {
  const p = pending.get(pendingId);
  if (!p) return null;
  p.status = status;
  p.txHash = txHash ?? p.txHash;
  p.result = result ?? p.result;
  p.completedAt = new Date().toISOString();
  pending.set(pendingId, p); // flush the mutated record
  return p;
}

module.exports = { submit, list, get, complete };
