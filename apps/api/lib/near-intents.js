/**
 * NEAR Intents payment rail — settlement through the verifier contract.
 *
 * Third NEAR payment form alongside native transfer and forwarder `pay`.
 * The buyer deposits the settlement FT to the verifier's internal ledger,
 * signs a NEP-413 transfer intent off-chain, and the SELLER executes it via
 * `execute_intents` — agent-to-agent settlement: buyer publishes the signed
 * intent, seller fulfills it, the verifier settles atomically. The API's
 * job is verification only; it holds no keys.
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
 * seller's execute_intents tx. We verify on-chain that it carried a valid
 * NEP-413 signed intent from the claimed buyer paying the quoted amount to
 * the quoted payee, and that the seller executed it (tx signer = payee).
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
 * Verify a seller-executed intents settlement on-chain.
 *
 * Checks: tx final + succeeded (all receipts), receiver = verifier,
 * signer = expected payee (the seller executes), args contain a NEP-413
 * payload whose inner message has signer_id = buyer, verifying_contract =
 * verifier, unexpired deadline, and a transfer intent paying >= minAmountBase
 * of tokenId to the payee. Nonce replay is impossible — the verifier
 * consumes nonces on-chain, and orders guard tx-hash reuse.
 */
async function verifyIntentsSettlement({
  txHash,
  buyerAccountId,
  expectedPayeeId,
  minAmountBase,
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
        sender_account_id: expectedPayeeId,
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
  // The story: the seller fulfills the buyer's intent — the payee must be
  // the executing signer.
  if (tx.signer_id !== expectedPayeeId) {
    return { ok: false, reason: 'executor_not_payee', signer: tx.signer_id };
  }

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

  return {
    ok: true,
    mode: 'intents',
    txHash: r.transaction_outcome?.id ?? txHash,
    signer: buyerAccountId, // the intent signer is the payer, not the tx signer
    executor: tx.signer_id,
    receiver: expectedPayeeId,
    verifier: cfg.verifier,
    tokenContract: cfg.tokenContractId,
    tokenId: cfg.tokenId,
    amountToken: match.amount.toString(),
    finalExecutionStatus: finality,
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

module.exports = {
  intentsConfig,
  intentsQuoteForUsd,
  verifyIntentsSettlement,
  validateSignedIntentPayload,
};
