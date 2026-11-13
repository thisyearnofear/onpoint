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
 *   NEAR_TOKEN_CONTRACT  optional FT contract id (e.g. usdc.fakes.testnet).
 *                        When set, quotes are denominated in the token and the
 *                        agent pays via ft_transfer — dollar-priced checkout
 *                        without a hand-set NEAR_USD_PRICE.
 *   NEAR_TOKEN_FORWARDER optional escrow/forwarder contract. When set, the
 *                        quote's token block points at it instead of the FT:
 *                        agents call `pay` on the forwarder, which releases
 *                        escrowed tokens via ft_transfer. Required for
 *                        function-call access keys, which cannot attach the
 *                        1 yoctoNEAR deposit ft_transfer demands.
 *   NEAR_TOKEN_DECIMALS  token decimals (default 6).
 *   NEAR_TOKEN_SYMBOL    display symbol (default 'USDC').
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

/** Settlement FT config — set NEAR_TOKEN_CONTRACT to enable token quotes. */
function nearTokenConfig() {
  const contractId = process.env.NEAR_TOKEN_CONTRACT;
  if (!contractId || !isNearAccountId(contractId)) return null;
  const decimals = Number(process.env.NEAR_TOKEN_DECIMALS ?? 6);
  const forwarder = process.env.NEAR_TOKEN_FORWARDER;
  return {
    contractId,
    decimals: Number.isInteger(decimals) && decimals >= 0 && decimals <= 24 ? decimals : 6,
    symbol: process.env.NEAR_TOKEN_SYMBOL || 'USDC',
    forwarder: forwarder && isNearAccountId(forwarder) ? forwarder : null,
  };
}

function nearRailEnabled(curator) {
  return Boolean((nearTokenConfig() || nearUsdPrice()) && nearPayoutAccount(curator));
}

/**
 * Convert a USD price to the NEAR quote the agent must pay.
 *
 * Two payable forms may be advertised together:
 * - native: amountYocto of NEAR (needs NEAR_USD_PRICE) — what wallets and
 *   the existing demo send.
 * - token: a FunctionCall for the USD amount in token base units (no rate
 *   needed — the token is dollar-denominated). When NEAR_TOKEN_FORWARDER is
 *   set the call is `pay` on the escrow forwarder (0 deposit — signable by
 *   a function-call access key); otherwise it is `ft_transfer` on the FT
 *   itself (1 yoctoNEAR attached — needs a full-access key).
 *
 * Returns null when neither form can be priced.
 */
function nearQuoteForUsd(usd) {
  if (!Number.isFinite(usd) || usd <= 0) return null;
  const network = nearNetwork();
  const quote = { network };

  const price = nearUsdPrice();
  if (price) {
    const amountE8 = Math.ceil((usd / price) * 1e8);
    quote.amountNear = amountE8 / 1e8;
    quote.amountYocto = (BigInt(amountE8) * 10n ** 16n).toString();
    quote.usdRate = price;
  }

  const token = nearTokenConfig();
  if (token) {
    const amount = BigInt(Math.ceil(usd * 10 ** token.decimals));
    quote.token = {
      contractId: token.forwarder ?? token.contractId,
      tokenContractId: token.contractId,
      symbol: token.symbol,
      decimals: token.decimals,
      amount: amount.toString(),
      display: Number(amount) / 10 ** token.decimals,
      method: token.forwarder ? 'pay' : 'ft_transfer',
      attachYocto: token.forwarder ? '0' : '1',
    };
  }

  return quote.amountYocto || quote.token ? quote : null;
}

/**
 * Verify a NEAR transfer on-chain via EXPERIMENTAL_tx_status.
 *
 * The RPC indexes transactions by (tx_hash, sender_account_id), so the
 * signer's account id must come from the request — never inferred.
 *
 * Checks: tx succeeded at EXECUTED+ finality, signer = claimed payer,
 * receiver = expected payout account, summed Transfer deposits >= minimum.
 * Token form (quote.token present): the tx must be a FunctionCall to
 * token.contractId whose token.method args name the payout account with
 * amount >= token.amount. With NEAR_TOKEN_FORWARDER set the contract is the
 * escrow forwarder (method `pay`, callable by a function-call access key);
 * otherwise it is the FT itself (`ft_transfer`, full-access key only).
 *
 * Hardening TODO before this rail is the primary path:
 * - reject txs containing non-Transfer actions (function-call masking)
 * - consider a max age on the tx (block-height bound) to reject stale payments
 */
async function verifyNearPayment({
  txHash,
  signerAccountId,
  expectedReceiverId,
  minDepositYocto,
  token,
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
        // EXPERIMENTAL_tx_status indexes by any participant — when the payer
        // is not claimed (human flow pastes only a hash), the receiver works.
        sender_account_id: signerAccountId || expectedReceiverId,
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
  // A FunctionCall's own outcome lives in the receipt it spawns — a failed
  // ft_transfer (e.g. insufficient balance) surfaces there, not at top level.
  for (const outcome of r.receipts_outcome ?? []) {
    const oStatus = outcome?.outcome?.status ?? {};
    if ('Failure' in oStatus) {
      return { ok: false, reason: 'receipt_failed', failure: oStatus.Failure };
    }
  }

  const tx = r.transaction;
  if (signerAccountId && tx.signer_id !== signerAccountId) {
    return { ok: false, reason: 'signer_mismatch', signer: tx.signer_id };
  }

  // ── Token form: FunctionCall on the quoted contract ──
  // Auto-detected by the tx receiver — a valid payment in either form counts.
  // token.contractId is the callable surface (escrow forwarder or the FT);
  // token.method is `pay` on the forwarder or `ft_transfer` on the FT. Both
  // take {receiver_id, amount} — the forwarder releases escrowed tokens to
  // receiver_id, so the args naming the payee are what we verify.
  if (token?.contractId && tx.receiver_id === token.contractId) {
    if (token.amount == null) {
      return { ok: false, reason: 'token_not_quoted' };
    }
    const method = token.method || 'ft_transfer';
    const fc = (tx.actions ?? []).find(
      (a) => a?.FunctionCall?.method_name === method,
    );
    if (!fc) {
      return { ok: false, reason: `no_${method}` };
    }
    let args;
    try {
      args = JSON.parse(Buffer.from(fc.FunctionCall.args, 'base64').toString('utf8'));
    } catch {
      return { ok: false, reason: 'args_decode_failed' };
    }
    if (args?.receiver_id !== expectedReceiverId) {
      return { ok: false, reason: 'receiver_mismatch', receiver: args?.receiver_id };
    }
    let amount;
    try {
      amount = BigInt(args.amount ?? '0');
    } catch {
      return { ok: false, reason: 'amount_decode_failed' };
    }
    if (amount < BigInt(token.amount)) {
      return { ok: false, reason: 'insufficient_deposit', amountToken: amount.toString() };
    }
    return {
      ok: true,
      mode: 'token',
      txHash: r.transaction_outcome?.id ?? txHash,
      signer: tx.signer_id,
      receiver: args.receiver_id,
      tokenContract: token.tokenContractId ?? token.contractId,
      via: token.contractId,
      method,
      amountToken: amount.toString(),
      finalExecutionStatus: finality,
    };
  }

  // ── Native mode: Transfer action(s) direct to the payout account ──
  if (tx.receiver_id !== expectedReceiverId) {
    return { ok: false, reason: 'receiver_mismatch', receiver: tx.receiver_id };
  }
  if (minDepositYocto == null) {
    // No native amount was quoted — an unrelated tx to the payee is not payment.
    return { ok: false, reason: 'native_not_quoted' };
  }
  let deposit = 0n;
  for (const action of tx.actions ?? []) {
    if (action?.Transfer?.deposit != null) deposit += BigInt(action.Transfer.deposit);
  }
  if (deposit < BigInt(minDepositYocto)) {
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

/** Display summary of what actually settled — for payout/receipt fields. */
function nearSettlementSummary(nearResult, nearQuote) {
  if (nearResult?.mode === 'token' && nearQuote?.token) {
    return {
      mode: 'token',
      asset: nearQuote.token.symbol,
      tokenContract: nearResult.tokenContract,
      amountToken: nearResult.amountToken,
      display: Number(nearResult.amountToken) / 10 ** nearQuote.token.decimals,
    };
  }
  return {
    mode: 'native',
    asset: 'NEAR',
    amountYocto: nearQuote?.amountYocto,
    display: nearQuote?.amountNear,
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
  nearTokenConfig,
  nearRailEnabled,
  nearQuoteForUsd,
  verifyNearPayment,
  nearSettlementSummary,
};
