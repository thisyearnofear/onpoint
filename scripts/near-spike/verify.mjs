/**
 * Dependency-free NEAR payment verification via raw JSON-RPC.
 *
 * This is the piece that would move into apps/api/lib/ — it takes a tx hash
 * supplied by a paying agent and answers "did this account actually pay
 * >= minDeposit yoctoNEAR to the expected receiver?"
 *
 * Production hardening notes (spike scope is simpler):
 * - EXPERIMENTAL_tx_status looks up a tx by (tx_hash, sender_account_id);
 *   the sender id must come from the request, not be trusted from the hash.
 * - This checks the top-level transfer actions only. A hardened version
 *   should also walk receipt outcomes and reject txs that contain non-transfer
 *   actions (function calls masquerading as payments).
 * - Callers must enforce txHash uniqueness (replay protection) at the DB layer.
 * - wait_until "FINAL" covers finality; poll until final_execution_status
 *   is "FINAL" or "EXECUTED" per your risk tolerance.
 */
export async function verifyNearPayment({
  rpcUrl = "https://rpc.testnet.near.org",
  txHash,
  signerAccountId,
  expectedReceiverId,
  minDepositYocto,
  waitUntil = "FINAL",
}) {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: "near-verify",
      method: "EXPERIMENTAL_tx_status",
      params: {
        tx_hash: txHash,
        sender_account_id: signerAccountId,
        wait_until: waitUntil,
      },
    }),
  });
  if (!res.ok) return { ok: false, reason: `rpc_http_${res.status}` };

  const data = await res.json();
  if (data.error) {
    return {
      ok: false,
      reason: data.error.name ?? "rpc_error",
      detail: data.error.data ?? data.error.message,
    };
  }

  const r = data.result;
  const status = r.status ?? {};
  const succeeded = "SuccessValue" in status || "SuccessReceiptId" in status;
  if (!succeeded) {
    return {
      ok: false,
      reason: "tx_failed",
      failure: status.Failure ?? status,
      finalExecutionStatus: r.final_execution_status,
    };
  }

  const tx = r.transaction;
  if (signerAccountId && tx.signer_id !== signerAccountId) {
    return { ok: false, reason: "signer_mismatch", signer: tx.signer_id };
  }
  if (expectedReceiverId && tx.receiver_id !== expectedReceiverId) {
    return { ok: false, reason: "receiver_mismatch", receiver: tx.receiver_id };
  }

  let deposit = 0n;
  for (const action of tx.actions ?? []) {
    if (action?.Transfer?.deposit != null) deposit += BigInt(action.Transfer.deposit);
  }
  if (minDepositYocto != null && deposit < BigInt(minDepositYocto)) {
    return {
      ok: false,
      reason: "insufficient_deposit",
      depositYocto: deposit.toString(),
    };
  }

  return {
    ok: true,
    txHash: r.transaction_outcome?.id ?? txHash,
    signer: tx.signer_id,
    receiver: tx.receiver_id,
    depositYocto: deposit.toString(),
    finalExecutionStatus: r.final_execution_status,
  };
}
