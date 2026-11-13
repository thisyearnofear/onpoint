/**
 * NEAR Intents settlement — buyer signs a NEP-413 transfer intent, the seller
 * executes it through the verifier, and the verifier settles the internal
 * ledger atomically. No solver, no custom contract.
 *
 * Testnet: we run the official unmodified `defuse` verifier (v0.4.2,
 * sha256-verified download) on our own account `intents.onpoint.testnet` —
 * there is no official testnet deploy. Tidepool's community sandbox at
 * `verifier.tidepool-sandbox.testnet` works too (INTENTS_VERIFIER env).
 * Mainnet path is identical with VERIFIER = "intents.near".
 *
 *   1. buyer deposits USDC.e:  ft_transfer_call(FT, verifier, amount)
 *   2. buyer signs the intent: NEP-413 {signer_id, verifying_contract,
 *      deadline, nonce, intents:[{intent:"transfer", receiver_id: payee,
 *      tokens:{tokenId: amount}}]}
 *   3. seller executes:        execute_intents({signed:[signedPayload]})
 *      — anyone may submit; the signature inside carries the authority.
 *      The seller submitting IS "the seller executes the buyer's intent".
 */
import { Account, JsonRpcProvider, KeyPairSigner, baseEncode } from "near-api-js";
import { signMessage } from "near-api-js/nep413";
import { randomBytes, createHash } from "node:crypto";
import { createRequire } from "node:module";

// Shared quote-token codec — the SAME canonicalization the API verifies.
// Byte-exactness is the whole game: one module, both sides.
const codec = createRequire(import.meta.url)("../../apps/api/lib/quote-token-codec.js");

export const VERIFIER = process.env.INTENTS_VERIFIER || "intents.onpoint.testnet";
export const FT_CONTRACT = process.env.INTENTS_FT || "usdc.fakes.testnet";
export const TOKEN_ID = `nep141:${FT_CONTRACT}`; // internal ledger id
export const RPC = process.env.INTENTS_RPC || "https://test.rpc.fastnear.com";

export const provider = new JsonRpcProvider({ url: RPC });
export const accountOf = (accountId, secretKey) =>
  new Account(accountId, provider, KeyPairSigner.fromSecretKey(secretKey));

// Current contract salt — the first 4 bytes of every valid nonce.
export async function currentSalt() {
  const hex = await provider.callFunction({
    contractId: VERIFIER,
    method: "current_salt",
    args: {},
  });
  return Buffer.from(hex, "hex"); // 4 bytes
}

// Internal-ledger balance (NEP-245) of an account on the verifier.
export async function internalBalance(accountId, tokenId = TOKEN_ID) {
  const [bal] = await provider.callFunction({
    contractId: VERIFIER,
    method: "mt_batch_balance_of",
    args: { account_id: accountId, token_ids: [tokenId] },
  });
  return BigInt(bal ?? "0");
}

// The verifier keeps its own key registry per account (NEAR access keys are
// NOT automatically known to it). Each signer registers its full-access
// pubkey once via `add_public_key` (1 yoctoNEAR; keyed to predecessor).
export async function ensureVerifierKey(signer /* Account */) {
  const pub = (await signer.getSigner().getPublicKey()).toString();
  const has = await provider.callFunction({
    contractId: VERIFIER,
    method: "has_public_key",
    args: { account_id: signer.accountId, public_key: pub },
  });
  if (has) return { already: true, publicKey: pub };
  const out = await signer.callFunctionRaw({
    contractId: VERIFIER,
    methodName: "add_public_key",
    args: { public_key: pub },
    gas: "30000000000000",
    deposit: "1",
  });
  const failed = (out.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure);
  return { already: false, ok: !failed, publicKey: pub, txHash: out.transaction?.hash ?? out.transaction_outcome?.id, failure: failed?.outcome?.status?.Failure };
}

// Deposit NEP-141 into the verifier's internal ledger for `signer`.
export async function deposit(signer /* Account */, amountBase) {
  const out = await signer.callFunctionRaw({
    contractId: FT_CONTRACT,
    methodName: "ft_transfer_call",
    args: { receiver_id: VERIFIER, amount: String(amountBase), msg: "" },
    gas: "60000000000000",
    deposit: "1",
  });
  const failed = (out.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure);
  return { ok: !failed, txHash: out.transaction?.hash ?? out.transaction_outcome?.id, failure: failed?.outcome?.status?.Failure };
}

// Sign a NEP-413 payload carrying an arbitrary intents array. `signer`
// must be a full-access Account (FCAKs cannot sign off-chain messages —
// by design; the FCAK stays the bounded on-chain budget layer, this
// signature is the agent's identity).
export async function signIntents({ signer, intents, deadlineMs = 15 * 60 * 1000 }) {
  const salt = await currentSalt();
  const nonce = Buffer.concat([salt, randomBytes(28)]);
  const payload = {
    signer_id: signer.accountId,
    verifying_contract: VERIFIER,
    deadline: new Date(Date.now() + deadlineMs).toISOString().replace("Z", "000Z"),
    nonce: nonce.toString("base64"),
    intents,
  };
  const messagePayload = {
    message: JSON.stringify(payload),
    recipient: VERIFIER,
    nonce,
    callbackUrl: undefined,
  };
  const signed = await signMessage({ signerAccount: signer, payload: messagePayload });
  return {
    standard: "nep413",
    payload: {
      message: messagePayload.message,
      nonce: nonce.toString("base64"),
      recipient: VERIFIER,
    },
    signature: `ed25519:${baseEncode(signed.signature)}`,
    public_key: signed.publicKey.toString(),
    intentPayload: payload, // decoded — for the API/buyer's own record
  };
}

// Buyer signs a NEP-413 transfer intent (internal-ledger move to receiver).
export async function signTransferIntent({ buyer, receiverId, amountBase, tokenId = TOKEN_ID, deadlineMs }) {
  return signIntents({
    signer: buyer,
    deadlineMs,
    intents: [
      {
        intent: "transfer",
        receiver_id: receiverId,
        tokens: { [tokenId]: String(amountBase) },
      },
    ],
  });
}

// Seller signs a negotiation quoteToken — plain ed25519 over the shared
// canonical payload (NOT NEP-413). This is the sovereign signature: the
// payee's own key, which the platform does not hold, committing to a price.
export function signQuoteToken({ secretKey, accountId, scope, curatorSlug, listingId, size, quantity, agreedCusd, sessionId, payee, ttlMs = 10 * 60 * 1000 }) {
  const now = Date.now();
  const payload = {
    v: 1, scope, curatorSlug, listingId,
    size: size ?? null, quantity: quantity ?? null,
    agreedCusd, sessionId, payee,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  const signed = codec.signQuotePayload(payload, secretKey);
  return {
    payload,
    signature: signed.signature,
    signer: { accountId, publicKey: signed.publicKey },
    signed: true,
  };
}

// Owner signs an ft_withdraw intent — moves tokens from their internal
// ledger balance back to their wallet via the verifier's custody. This is
// how a seller "collects" what it earned.
export async function signWithdrawIntent({ owner, amountBase, tokenId = TOKEN_ID, deadlineMs }) {
  return signIntents({
    signer: owner,
    deadlineMs,
    intents: [
      {
        intent: "ft_withdraw",
        // ft_withdraw takes the FT *contract account id* (not the internal
        // nep141: token id) — the ledger balance it debits is derived from it.
        token: tokenId.replace(/^nep141:/, ""),
        receiver_id: owner.accountId,
        amount: String(amountBase),
      },
    ],
  });
}

// Seller (or any executor) submits the buyer's signed intent. The verifier
// validates the signature + nonce + deadline, then settles the internal
// ledger transfer atomically.
export async function executeIntents(seller /* Account */, signedPayload) {
  const out = await seller.callFunctionRaw({
    contractId: VERIFIER,
    methodName: "execute_intents",
    args: {
      signed: [
        {
          standard: signedPayload.standard,
          payload: signedPayload.payload,
          signature: signedPayload.signature,
          public_key: signedPayload.public_key,
        },
      ],
    },
    gas: "120000000000000",
    deposit: "0",
  });
  const failed = (out.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure);
  return {
    ok: !failed,
    txHash: out.transaction?.hash ?? out.transaction_outcome?.id,
    failure: failed?.outcome?.status?.Failure ?? out.status?.Failure,
    logs: (out.receipts_outcome ?? []).flatMap((r) => r?.outcome?.logs ?? []),
  };
}

// ── token_diff: atomic cross-asset swap inside the verifier ────────────
// A token_diff intent is a signed accounting delta over the internal
// ledger: {intent:"token_diff", diff:{"nep141:<contract>":"<signed amount>"}}.
// Per token, every negative delta must be matched by a positive delta
// somewhere else in the SAME execute_intents call — the contract fails
// with `unmatched_deltas` otherwise, which is what makes a multi-signer
// bundle atomic. Verified live on our unmodified defuse deployment:
// https://testnet.nearblocks.io/txns/85TCELdBRWcxkHnFcKDkUwuFyQWmYLLab6dDKgT9FAVJ

// Signer proposes a diff: give `give` (tokenId → negative) for `get`
// (tokenId → positive). E.g. a buyer holding wNEAR swaps into USDC.e to
// pay a quote denominated in USDC.
export async function signTokenDiffIntent({ signer, give /* {tokenId: amountBase} */, get /* {tokenId: amountBase} */, deadlineMs }) {
  const diff = {};
  for (const [t, a] of Object.entries(give)) diff[t] = `-${a}`;
  for (const [t, a] of Object.entries(get)) diff[t] = `${a}`;
  return signIntents({ signer, deadlineMs, intents: [{ intent: "token_diff", diff }] });
}

// The mirror image — what the counterparty (merchant-as-solver) signs.
export function counterDiff(diff /* {tokenId: signedString} */) {
  const out = {};
  for (const [t, a] of Object.entries(diff)) out[t] = `${-BigInt(a)}`;
  return out;
}

// Execute N signed payloads (possibly from different signers) in ONE
// atomic call. Order inside `signed` doesn't matter — the contract
// applies the whole set or nothing.
export async function executeBundle(executor /* Account */, signedPayloads /* array */) {
  const out = await executor.callFunctionRaw({
    contractId: VERIFIER,
    methodName: "execute_intents",
    args: {
      signed: signedPayloads.map((p) => ({
        standard: p.standard,
        payload: p.payload,
        signature: p.signature,
        public_key: p.public_key,
      })),
    },
    gas: "240000000000000",
    deposit: "0",
  });
  const failed = (out.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure);
  return {
    ok: !failed,
    txHash: out.transaction?.hash ?? out.transaction_outcome?.id,
    failure: failed?.outcome?.status?.Failure ?? out.status?.Failure,
    logs: (out.receipts_outcome ?? []).flatMap((r) => r?.outcome?.logs ?? []),
  };
}
