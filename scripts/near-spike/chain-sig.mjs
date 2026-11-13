// chain-sig.mjs — NEAR Chain Signatures → EVM leg.
// A NEAR account derives an EVM address through v1.signer-prod.testnet
// (public MPC, not our deployment) — no private key exists anywhere.
// sign() returns {big_r, s, recovery_id}; we assemble the raw tx and
// broadcast over a public RPC.

import { keccak256 } from "ethereum-cryptography/keccak.js";
import { baseDecode } from "near-api-js";
import * as ints from "./intents-lib.mjs";

export const MPC = process.env.MPC_CONTRACT || "v1.signer-prod.testnet";
export const EVM_RPC = process.env.EVM_RPC || "https://ethereum-sepolia-rpc.publicnode.com";
export const CHAIN_ID = Number(process.env.EVM_CHAIN_ID || 11155111); // sepolia
export const CHAIN_PATH = process.env.CHAIN_PATH || "sepolia-1";
const EXPLORER = "https://sepolia.etherscan.io/tx/";

const provider = ints.provider;

async function mpcView(fn, args) {
  const r = await provider.query({
    request_type: "call_function", finality: "final",
    account_id: MPC, method_name: fn,
    args_base64: Buffer.from(JSON.stringify(args)).toString("base64"),
  });
  return JSON.parse(Buffer.from(r.result).toString());
}

// NEAR account + derivation path → EVM address (keccak of uncompressed x||y).
export async function deriveEvmAddress(nearAccountId, path = CHAIN_PATH) {
  const pk = await mpcView("derived_public_key", { path, predecessor: nearAccountId });
  const raw = baseDecode(String(pk).replace("secp256k1:", ""));
  return "0x" + Buffer.from(keccak256(raw)).toString("hex").slice(-40);
}

// MPC-sign a 32-byte payload. Returns { r, s, recoveryId } as Buffer/number.
export async function mpcSign(account /* near Account */, payload32 /* Uint8Array */, path = CHAIN_PATH) {
  const out = await account.callFunctionRaw({
    contractId: MPC, methodName: "sign",
    args: { request: { payload: Array.from(payload32), path, key_version: 0 } },
    gas: "300000000000000",
    deposit: "500000000000000000000000", // 0.5 NEAR — refunded when below cost
  });
  const failed = (out.receipts_outcome ?? []).find((x) => x?.outcome?.status?.Failure);
  if (failed) throw new Error(`mpc sign: ${JSON.stringify(failed.outcome.status.Failure).slice(0, 200)}`);
  const sv = (out.receipts_outcome ?? []).map((x) => x?.outcome?.status?.SuccessValue).find((v) => v);
  const sig = JSON.parse(Buffer.from(sv, "base64").toString());
  return {
    // big_r is a 33-byte compressed point: r = the x coordinate (bytes 1..33)
    r: Buffer.from(sig.big_r.affine_point, "hex").slice(1),
    s: Buffer.from(sig.s.scalar, "hex"),
    recoveryId: sig.recovery_id,
    txHash: out.transaction?.hash,
  };
}

// Minimal RLP — enough for a legacy EIP-155 transfer.
function rlp(items) {
  const enc = (b) => {
    if (typeof b === "number" || typeof b === "bigint") {
      if (b === 0n || b === 0) b = Buffer.alloc(0);
      else { let h = b.toString(16); if (h.length % 2) h = "0" + h; b = Buffer.from(h, "hex"); }
    }
    if (typeof b === "string") b = b.startsWith("0x") ? Buffer.from(b.slice(2), "hex") : Buffer.from(b, "utf8");
    if (Array.isArray(b)) {
      const payload = Buffer.concat(b.map(enc));
      const p = prefix(0xc0, payload.length);
      return Buffer.concat([p, payload]);
    }
    return Buffer.concat([prefix(0x80, b.length, b), b]);
  };
  const prefix = (base, len, buf) => {
    if (len === 1 && buf && buf[0] < 0x80) return Buffer.alloc(0);
    if (len <= 55) return Buffer.from([base + len]);
    const ll = Buffer.from(len.toString(16), "hex");
    return Buffer.concat([Buffer.from([base + 55 + ll.length]), ll]);
  };
  return enc(items);
}

async function rpc(method, params = []) {
  const r = await fetch(EVM_RPC, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message}`);
  return j.result;
}

export const evmBalance = async (addr) =>
  Number(BigInt(await rpc("eth_getBalance", [addr, "latest"]))) / 1e18;

// MPC-sign + broadcast a simple value transfer from a NEAR-derived address.
export async function sendEvmTransfer({ nearAccount /* Account */, nearAccountId, to, weiAmount, path = CHAIN_PATH }) {
  const from = await deriveEvmAddress(nearAccountId, path);
  const [nonceHex, gasPriceHex, gasHex] = await Promise.all([
    rpc("eth_getTransactionCount", [from, "pending"]),
    rpc("eth_gasPrice", []),
    rpc("eth_estimateGas", [{ from, to, value: "0x" + weiAmount.toString(16) }]).catch(() => "0x5208"),
  ]);
  const fields = [
    BigInt(nonceHex), BigInt(gasPriceHex), BigInt(gasHex),
    to, weiAmount, Buffer.alloc(0), BigInt(CHAIN_ID), 0, 0,
  ];
  const sighash = keccak256(rlp(fields));
  const { r, s, recoveryId, txHash: mpcTx } = await mpcSign(nearAccount, sighash, path);
  // NEAR's recovery_id is relative to its own signing — verify it recovers
  // OUR derived address locally; flip parity if the node computed the other.
  const { ProjectivePoint, Signature } = await import("@noble/secp256k1");
  let recId = recoveryId;
  for (const cand of [recoveryId, recoveryId ^ 1]) {
    try {
      const sig = Signature.fromCompact(r.toString("hex") + s.toString("hex")).addRecoveryBit(cand);
      const pub = sig.recoverPublicKey(sighash).toRawBytes(false).slice(1);
      const rec = "0x" + Buffer.from(keccak256(pub)).toString("hex").slice(-40);
      if (rec.toLowerCase() === from.toLowerCase()) { recId = cand; break; }
    } catch { /* try the other parity */ }
  }
  const v = BigInt(CHAIN_ID) * 2n + 35n + BigInt(recId);
  const signed = rlp(fields.slice(0, 6).concat([v, r, s]));
  const rawTx = "0x" + signed.toString("hex");
  const evmTx = await rpc("eth_sendRawTransaction", [rawTx]);
  return { from, to, weiAmount, evmTx, mpcTx, explorer: EXPLORER + evmTx };
}
