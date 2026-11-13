/**
 * NEAR Intents payment rail — settlement through the verifier contract.
 *
 * Third NEAR payment form alongside native transfer and forwarder `pay`.
 * The buyer deposits the settlement FT to the verifier's internal ledger,
 * signs a NEP-413 transfer intent off-chain, and the SELLER — or any
 * registered solver racing the open queue — executes it via
 * `execute_intents` — agent-to-agent settlement: buyer publishes the signed
 * intent, a fulfiller settles it, the verifier enforces atomicity. The
 * API's job is verification only; it holds no keys.
 *
 * Config (rail disabled unless all set):
 *   NEAR_INTENTS_VERIFIER  verifier contract id (intents.onpoint.testnet /
 *                          intents.near on mainnet). We run the official
 *                          unmodified defuse wasm on our own testnet account —
 *                          there is no official testnet deploy.
 *   NEAR_TOKEN_CONTRACT    settlement FT (required — token-denominated only)
 *   NEAR_TOKEN_DECIMALS / NEAR_TOKEN_SYMBOL  as the forwarder rail
 *
 * Proof: the order re-POST carries { intentsTxHash } — the hash of the
 * fulfiller's execute_intents tx — plus { intentsExecutor } naming the
 * submitting account. We verify on-chain that the tx carried a valid
 * NEP-413 signed intent from the claimed buyer paying the quoted amount
 * to the quoted payee; the inner intent is the authority, so the executor
 * may be the payee OR any solver (reported distinctly on the receipt).
 */

const nearPayments = require('./near-payments');

function intentsConfig() {
  const verifier = process.env.NEAR_INTENTS_VERIFIER;
  const token = nearPayments.nearTokenConfig();
  if (!verifier || !nearPayments.isNearAccountId(verifier)) return null;
  if (!token?.contractId) return null;
  return {
    verifier,
    tokenId: `nep141:${token.contractId}`,
    tokenContractId: token.contractId,
    symbol: token.symbol,
    decimals: token.decimals,
  };
}

/**
 * The intents block for a 402 quote — tells the buying agent what to sign.
 * amount is base units of the settlement token.
 */
function intentsQuoteForUsd(usd, payTo) {
  const cfg = intentsConfig();
  if (!cfg || !payTo || !Number.isFinite(usd) || usd <= 0) return null;
  const amount = BigInt(Math.ceil(usd * 10 ** cfg.decimals));
  return {
    standard: 'nep413',
    verifier: cfg.verifier,
    tokenId: cfg.tokenId,
    tokenContractId: cfg.tokenContractId,
    symbol: cfg.symbol,
    decimals: cfg.decimals,
    amount: amount.toString(),
    display: Number(amount) / 10 ** cfg.decimals,
    payTo,
    instructions:
      `Deposit ${cfg.symbol} to ${cfg.verifier} via ft_transfer_call on ${cfg.tokenContractId}, ` +
      `sign a NEP-413 transfer intent {receiver_id:"${payTo}",tokens:{"${cfg.tokenId}":"${amount}"}} ` +
      `with verifying_contract "${cfg.verifier}", then have the seller execute it via execute_intents ` +
      `and re-POST with { nearAccountId, intentsTxHash, quoteId }.`,
  };
}

/**
 * Verify an intents settlement on-chain — executed by the payee OR a solver.
 *
 * Whoever submits `execute_intents`, the signed payload inside is the
 * authority: the verifier enforces the signatures and atomicity, and funds
 * can only move per the inner intents. So the proof is: tx final +
 * succeeded (all receipts), receiver = verifier, args contain a NEP-413
 * payload whose inner message has signer_id = buyer, verifying_contract =
 * verifier, and a transfer intent paying >= minAmountBase of tokenId to
 * the payee. The executor is recorded + classified (payee | solver) — an
 * OPEN solver queue means solver ≠ payee on the receipt is expected.
 * `executorAccountId` (the declared submitter) is needed for the
 * EXPERIMENTAL_tx_status lookup, which keys on (tx_hash, signer), and is
 * consistency-checked when provided. Nonce replay is impossible — the
 * verifier consumes nonces on-chain, and orders guard tx-hash reuse.
 */
async function verifyIntentsSettlement({
  txHash,
  buyerAccountId,
  expectedPayeeId,
  minAmountBase,
  executorAccountId,
  rpcUrl = nearPayments.nearRpcUrl(),
}) {
  const cfg = intentsConfig();
  if (!cfg) return { ok: false, reason: 'intents_not_configured' };

  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'near-intents-verify',
      method: 'EXPERIMENTAL_tx_status',
      params: {
        tx_hash: txHash,
        sender_account_id: executorAccountId || expectedPayeeId,
        wait_until: 'FINAL',
      },
    }),
  });
  if (!res.ok) return { ok: false, reason: `rpc_http_${res.status}` };
  const data = await res.json();
  if (data.error) {
    return {
      ok: false,
      reason: data.error.name ?? 'rpc_error',
      detail: data.error.data ?? data.error.message,
    };
  }

  const r = data.result;
  const finality = r.final_execution_status;
  if (finality !== 'EXECUTED' && finality !== 'FINAL') {
    return { ok: false, reason: 'not_final', finalExecutionStatus: finality };
  }
  const status = r.status ?? {};
  if (!('SuccessValue' in status) && !('SuccessReceiptId' in status)) {
    return { ok: false, reason: 'tx_failed', failure: status.Failure ?? status };
  }
  for (const outcome of r.receipts_outcome ?? []) {
    const oStatus = outcome?.outcome?.status ?? {};
    if ('Failure' in oStatus) {
      return { ok: false, reason: 'receipt_failed', failure: oStatus.Failure };
    }
  }

  const tx = r.transaction;
  if (tx.receiver_id !== cfg.verifier) {
    return { ok: false, reason: 'verifier_mismatch', receiver: tx.receiver_id };
  }
  // Any registered account may submit the signed intents — the payee itself
  // or a solver racing the open queue. When the caller declares who
  // executed (the mailbox records it), the claim must match the tx signer.
  if (executorAccountId && tx.signer_id !== executorAccountId) {
    return { ok: false, reason: 'executor_mismatch', signer: tx.signer_id, declared: executorAccountId };
  }
  const solverExecuted = tx.signer_id !== expectedPayeeId;

  const fc = (tx.actions ?? []).find(
    (a) => a?.FunctionCall?.method_name === 'execute_intents',
  );
  if (!fc) return { ok: false, reason: 'no_execute_intents' };

  let args;
  try {
    args = JSON.parse(Buffer.from(fc.FunctionCall.args, 'base64').toString('utf8'));
  } catch {
    return { ok: false, reason: 'args_decode_failed' };
  }

  const signed = Array.isArray(args?.signed) ? args.signed : [];
  const min = BigInt(minAmountBase ?? '0');
  let match = null;
  for (const entry of signed) {
    if (entry?.standard !== 'nep413' || typeof entry?.payload?.message !== 'string') continue;
    let msg;
    try {
      msg = JSON.parse(entry.payload.message);
    } catch {
      continue;
    }
    if (msg?.signer_id !== buyerAccountId) continue;
    if (msg?.verifying_contract !== cfg.verifier) continue;
    const transfer = (msg.intents ?? []).find(
      (i) => i?.intent === 'transfer' && i?.receiver_id === expectedPayeeId,
    );
    if (!transfer) continue;
    let amount;
    try {
      amount = BigInt(transfer.tokens?.[cfg.tokenId] ?? '0');
    } catch {
      continue;
    }
    if (amount >= min) {
      match = { msg, amount };
      break;
    }
  }
  if (!match) {
    return {
      ok: false,
      reason: 'no_matching_intent',
      expected: { buyer: buyerAccountId, payee: expectedPayeeId, tokenId: cfg.tokenId, minAmount: min.toString() },
    };
  }

  // Optional: surface a token_diff funding leg when the same atomic
  // bundle contains one — the buyer swapped another asset into tokenId to
  // fund the transfer. Report it; the transfer match above is what pays.
  let swap = null;
  const diffs = [];
  for (const entry of signed) {
    if (entry?.standard !== 'nep413' || typeof entry?.payload?.message !== 'string') continue;
    let m;
    try {
      m = JSON.parse(entry.payload.message);
    } catch {
      continue;
    }
    const d = (m.intents ?? []).find((i) => i?.intent === 'token_diff' && i?.diff);
    if (d) diffs.push({ signer: m.signer_id, diff: d.diff });
  }
  if (diffs.length >= 2) {
    const nets = {};
    for (const { diff } of diffs) {
      for (const [t, a] of Object.entries(diff)) {
        try {
          nets[t] = (nets[t] ?? 0n) + BigInt(a);
        } catch { /* ignore unparseable deltas */ }
      }
    }
    swap = {
      intents: diffs,
      netsZero: Object.values(nets).every((n) => n === 0n),
    };
  }

  return {
    ok: true,
    mode: 'intents',
    txHash: r.transaction_outcome?.id ?? txHash,
    signer: buyerAccountId, // the intent signer is the payer, not the tx signer
    executor: tx.signer_id,
    executorKind: solverExecuted ? 'solver' : 'payee',
    solverExecuted,
    receiver: expectedPayeeId,
    verifier: cfg.verifier,
    tokenContract: cfg.tokenContractId,
    tokenId: cfg.tokenId,
    amountToken: match.amount.toString(),
    finalExecutionStatus: finality,
    ...(swap ? { swap } : {}),
  };
}

/**
 * Structural validation of a NEP-413 signed intent payload BEFORE it is
 * published for execution — the mailbox path (seller-agent split). The
 * verifier contract is still the authority on the signature itself; this
 * just rejects payloads that can never pay the quoted payee, so the buyer
 * fails fast instead of leaving a dead letter in the mailbox.
 *
 * Checks: standard === 'nep413', payload.message parses, signer_id =
 * buyer (when buyerAccountId is declared — the payload's signer_id is
 * authoritative and returned either way), verifying_contract = our
 * verifier, deadline unexpired, and a transfer intent to expectedPayeeId
 * for >= minAmountBase of tokenId.
 */
function validateSignedIntentPayload({ signed, buyerAccountId, expectedPayeeId, minAmountBase }) {
  const cfg = intentsConfig();
  if (!cfg) return { ok: false, reason: 'intents_not_configured' };
  if (!signed || signed.standard !== 'nep413') {
    return { ok: false, reason: 'not_nep413' };
  }
  if (typeof signed.signature !== 'string' || !signed.signature.startsWith('ed25519:')) {
    return { ok: false, reason: 'signature_missing' };
  }
  if (typeof signed.public_key !== 'string' || !signed.public_key.startsWith('ed25519:')) {
    return { ok: false, reason: 'public_key_missing' };
  }
  let msg;
  try {
    msg = JSON.parse(signed.payload?.message ?? '');
  } catch {
    return { ok: false, reason: 'message_unparseable' };
  }
  if (typeof msg?.signer_id !== 'string' || !msg.signer_id) {
    return { ok: false, reason: 'signer_missing' };
  }
  if (buyerAccountId && msg.signer_id !== buyerAccountId) {
    return { ok: false, reason: 'signer_mismatch', signer: msg.signer_id };
  }
  if (msg?.verifying_contract !== cfg.verifier) {
    return { ok: false, reason: 'verifier_mismatch', verifier: msg?.verifying_contract };
  }
  if (msg?.deadline && Date.parse(msg.deadline) <= Date.now()) {
    return { ok: false, reason: 'deadline_expired', deadline: msg.deadline };
  }
  const transfer = (msg.intents ?? []).find(
    (i) => i?.intent === 'transfer' && i?.receiver_id === expectedPayeeId,
  );
  if (!transfer) {
    return { ok: false, reason: 'no_transfer_to_payee', payee: expectedPayeeId };
  }
  let amount;
  try {
    amount = BigInt(transfer.tokens?.[cfg.tokenId] ?? '0');
  } catch {
    return { ok: false, reason: 'amount_unparseable' };
  }
  const min = BigInt(minAmountBase ?? '0');
  if (amount < min) {
    return { ok: false, reason: 'amount_below_quote', amount: amount.toString(), minAmount: min.toString() };
  }
  return { ok: true, msg, signer: msg.signer_id, amount: amount.toString(), deadline: msg.deadline };
}

/**
 * Structural validation of a signed token_diff payload — the funding leg
 * of a swap-funded settlement. The buyer publishes it next to its
 * transfer intent; an independent counterparty (merchant-as-solver)
 * countersigns the mirror and executes the whole set in ONE
 * execute_intents call. The contract enforces per-token conservation
 * (`unmatched_deltas`), so the diff pair + transfer is atomic.
 *
 * Checks: nep413, message parses, signer_id = expectedSigner (the same
 * buyer as the transfer), verifier match, unexpired, and the message
 * contains a token_diff whose diff map gives `giveTokenId` (negative) for
 * `tokenId` (positive, >= minGetBase). The API does not judge the rate —
 * that is the counterparty's sovereign decision.
 */
function validateSignedDiffPayload({ signed, expectedSigner, giveTokenId, minGetBase }) {
  const cfg = intentsConfig();
  if (!cfg) return { ok: false, reason: 'intents_not_configured' };
  if (!signed || signed.standard !== 'nep413') {
    return { ok: false, reason: 'not_nep413' };
  }
  if (typeof signed.signature !== 'string' || !signed.signature.startsWith('ed25519:')) {
    return { ok: false, reason: 'signature_missing' };
  }
  if (typeof signed.public_key !== 'string' || !signed.public_key.startsWith('ed25519:')) {
    return { ok: false, reason: 'public_key_missing' };
  }
  let msg;
  try {
    msg = JSON.parse(signed.payload?.message ?? '');
  } catch {
    return { ok: false, reason: 'message_unparseable' };
  }
  if (typeof msg?.signer_id !== 'string' || !msg.signer_id) {
    return { ok: false, reason: 'signer_missing' };
  }
  if (expectedSigner && msg.signer_id !== expectedSigner) {
    return { ok: false, reason: 'diff_signer_mismatch', signer: msg.signer_id };
  }
  if (msg?.verifying_contract !== cfg.verifier) {
    return { ok: false, reason: 'verifier_mismatch', verifier: msg?.verifying_contract };
  }
  if (msg?.deadline && Date.parse(msg.deadline) <= Date.now()) {
    return { ok: false, reason: 'deadline_expired', deadline: msg.deadline };
  }
  const diffIntent = (msg.intents ?? []).find((i) => i?.intent === 'token_diff' && i?.diff);
  if (!diffIntent) return { ok: false, reason: 'no_token_diff' };
  let getAmount, giveAmount;
  try {
    getAmount = BigInt(diffIntent.diff[cfg.tokenId] ?? '0');
    giveAmount = BigInt(diffIntent.diff[giveTokenId] ?? '0');
  } catch {
    return { ok: false, reason: 'diff_unparseable' };
  }
  if (getAmount <= 0n || getAmount < BigInt(minGetBase ?? '0')) {
    return { ok: false, reason: 'diff_get_below_quote', amount: String(getAmount), minAmount: String(minGetBase ?? '0') };
  }
  if (giveAmount >= 0n) {
    return { ok: false, reason: 'diff_give_not_negative', giveTokenId, amount: String(giveAmount) };
  }
  return {
    ok: true,
    msg,
    signer: msg.signer_id,
    diff: diffIntent.diff,
    giveTokenId,
    giveAmount: String(-giveAmount),
    getAmount: String(getAmount),
  };
}

/**
 * Check the verifier's on-chain public-key registry — `has_public_key(
 * account_id, public_key)`. The registry is the same one that authorizes
 * intent signing (the account registered the key itself via add_public_key,
 * 1 yocto, self-call only), so it also authorizes quote-token signing for
 * sovereign sellers the platform cannot sign as.
 *
 * Returns {ok:true} / {ok:false} for a definitive answer, or
 * {ok:null, reason} when the question can't be answered (rail unconfigured,
 * RPC down) — callers fail closed.
 */
async function verifierHasPublicKey(accountId, publicKey, { rpcUrl = nearPayments.nearRpcUrl() } = {}) {
  const cfg = intentsConfig();
  if (!cfg) return { ok: null, reason: 'intents_not_configured' };
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'near-intents-keycheck',
      method: 'query',
      params: {
        request_type: 'call_function',
        finality: 'final',
        account_id: cfg.verifier,
        method_name: 'has_public_key',
        args_base64: Buffer.from(JSON.stringify({ account_id: accountId, public_key: publicKey })).toString('base64'),
      },
    }),
  }).catch((e) => ({ ok: false, error: e }));
  if (!res?.ok) return { ok: null, reason: `rpc_http_${res?.status ?? 'unreachable'}` };
  const data = await res.json();
  if (data.error) return { ok: null, reason: data.error.name ?? 'rpc_error' };
  try {
    const json = Buffer.from(data.result.result).toString('utf8');
    return { ok: JSON.parse(json) === true };
  } catch {
    return { ok: null, reason: 'result_unparseable' };
  }
}

module.exports = {
  intentsConfig,
  intentsQuoteForUsd,
  verifyIntentsSettlement,
  validateSignedIntentPayload,
  validateSignedDiffPayload,
  verifierHasPublicKey,
};
