/**
 * NEAR Payment Rail — quote + on-chain verification for agent payments.
 *
 * Second payment rail alongside Celo cUSD/x402 (NEAR HACKATHON). The flow
 * mirrors the existing challenge/verify pattern: the 402 response carries a
 * `near` quote block (payTo account + yoctoNEAR amount), the agent transfers
 * NEAR, then re-POSTs with { nearAccountId, nearTxHash }. We verify the
 * transfer trustlessly via raw JSON-RPC — no SDK dependency.
 *
 * Config (all optional — rail is disabled when unset):
 *   NEAR_NETWORK         'testnet' (default) | 'mainnet'
 *   NEAR_RPC_URL         override the network default RPC
 *   NEAR_USD_PRICE       USD per NEAR — converts the cUSD-priced fee to NEAR.
 *                        Manual rate for the hackathon; NEAR Intents / 1-Click
 *                        Swap is the real conversion path later.
 *   NEAR_PAYOUT_ACCOUNT  platform fallback receiver. A curator's
 *                        commerce.nearAccountId takes precedence when set.
 */

const NEAR_RPC_DEFAULTS = {
  mainnet: 'https://rpc.mainnet.near.org',
  testnet: 'https://rpc.testnet.near.org',
};

function nearNetwork() {
  return process.env.NEAR_NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

function nearRpcUrl() {
  return process.env.NEAR_RPC_URL || NEAR_RPC_DEFAULTS[nearNetwork()];
}

function nearUsdPrice() {
  const price = Number(process.env.NEAR_USD_PRICE);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function nearExplorerTxUrl(txHash) {
  const sub = nearNetwork() === 'testnet' ? 'testnet.' : '';
  return `https://${sub}nearblocks.io/txns/${txHash}`;
}

/** Named account (foo.near / foo.testnet / sub.account.near) or 64-hex implicit. */
function isNearAccountId(value) {
  if (typeof value !== 'string') return false;
  if (/^[0-9a-f]{64}$/.test(value)) return true;
  if (value.length < 2 || value.length > 64) return false;
  return /^[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9_-]*[a-z0-9])?)*$/.test(
    value,
  );
}

/** Base58-encoded 32-byte hash (43–44 chars, no 0OIl). */
function isNearTxHash(value) {
  return typeof value === 'string' && /^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(value);
}

/**
 * NEAR account that receives payment for this curator.
 * Per-curator commerce.nearAccountId wins; platform env is the fallback.
 * Returns null when neither is configured (rail disabled).
 */
function nearPayoutAccount(curator) {
  const perCurator = curator?.commerce?.nearAccountId;
  if (typeof perCurator === 'string' && isNearAccountId(perCurator)) {
    return perCurator;
  }
  const envAccount = process.env.NEAR_PAYOUT_ACCOUNT;
  return envAccount && isNearAccountId(envAccount) ? envAccount : null;
}

function nearRailEnabled(curator) {
  return Boolean(nearUsdPrice() && nearPayoutAccount(curator));
}

/**
 * Convert a USD price to the NEAR quote the agent must pay.
 * Rounds UP to 1e-8 NEAR granularity so the quoted minimum never undercharges.
 * Returns null when no USD rate is configured.
 */
function nearQuoteForUsd(usd) {
  const price = nearUsdPrice();
  if (!price || !Number.isFinite(usd) || usd <= 0) return null;
  const amountE8 = Math.ceil((usd / price) * 1e8);
  return {
    amountNear: amountE8 / 1e8,
    amountYocto: (BigInt(amountE8) * 10n ** 16n).toString(),
    usdRate: price,
    network: nearNetwork(),
  };
}

/**
 * Verify a NEAR transfer on-chain via EXPERIMENTAL_tx_status.
 *
 * The RPC indexes transactions by (tx_hash, sender_account_id), so the
 * signer's account id must come from the request — never inferred.
 *
 * Checks: tx succeeded at EXECUTED+ finality, signer = claimed payer,
 * receiver = expected payout account, summed Transfer deposits >= minimum.
 *
 * Hardening TODO before this rail is the primary path:
 * - reject txs containing non-Transfer actions (function-call masking)
 * - walk receipt outcomes, not just the top-level transaction
 * - consider a max age on the tx (block-height bound) to reject stale payments
 */
async function verifyNearPayment({
  txHash,
  signerAccountId,
  expectedReceiverId,
  minDepositYocto,
  rpcUrl = nearRpcUrl(),
}) {
  const res = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'near-verify',
      method: 'EXPERIMENTAL_tx_status',
      params: {
        tx_hash: txHash,
        sender_account_id: signerAccountId,
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
  const succeeded = 'SuccessValue' in status || 'SuccessReceiptId' in status;
  if (!succeeded) {
    return { ok: false, reason: 'tx_failed', failure: status.Failure ?? status };
  }

  const tx = r.transaction;
  if (tx.signer_id !== signerAccountId) {
    return { ok: false, reason: 'signer_mismatch', signer: tx.signer_id };
  }
  if (tx.receiver_id !== expectedReceiverId) {
    return { ok: false, reason: 'receiver_mismatch', receiver: tx.receiver_id };
  }

  let deposit = 0n;
  for (const action of tx.actions ?? []) {
    if (action?.Transfer?.deposit != null) deposit += BigInt(action.Transfer.deposit);
  }
  if (minDepositYocto != null && deposit < BigInt(minDepositYocto)) {
    return {
      ok: false,
      reason: 'insufficient_deposit',
      depositYocto: deposit.toString(),
    };
  }

  return {
    ok: true,
    txHash: r.transaction_outcome?.id ?? txHash,
    signer: tx.signer_id,
    receiver: tx.receiver_id,
    depositYocto: deposit.toString(),
    finalExecutionStatus: finality,
  };
}

module.exports = {
  nearNetwork,
  nearRpcUrl,
  nearUsdPrice,
  nearExplorerTxUrl,
  isNearAccountId,
  isNearTxHash,
  nearPayoutAccount,
  nearRailEnabled,
  nearQuoteForUsd,
  verifyNearPayment,
};
