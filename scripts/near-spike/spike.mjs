/**
 * NEAR testnet payment spike — end to end.
 *
 * 1. Create two testnet accounts via the public helper (agent + curator).
 *    The helper funds each with 10 NEAR.
 * 2. Agent sends a transfer to curator via near-api-js.
 * 3. Server-side verification with raw JSON-RPC (see verify.mjs) — this is
 *    the shape the OnPoint API would use, with no SDK dependency.
 *
 * Usage: node spike.mjs
 */
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  nearToYocto,
} from "near-api-js";
import { verifyNearPayment } from "./verify.mjs";

const RPC_URL = "https://rpc.testnet.near.org";
const HELPER_URL = "https://helper.testnet.near.org/account";
const PAY_AMOUNT = "0.05";

const provider = new JsonRpcProvider({ url: RPC_URL });

async function createTestnetAccount(label) {
  const keyPair = KeyPair.fromRandom("ed25519");
  const suffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const accountId = `spike-${label}-${suffix}.testnet`;

  const res = await fetch(HELPER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      newAccountId: accountId,
      newAccountPublicKey: keyPair.getPublicKey().toString(),
    }),
  });
  if (!res.ok) throw new Error(`helper create failed: ${res.status}`);
  return { accountId, keyPair };
}

const agent = await createTestnetAccount("agent");
const curator = await createTestnetAccount("curator");
console.log("agent:  ", agent.accountId);
console.log("curator:", curator.accountId);

const account = new Account(
  agent.accountId,
  provider,
  KeyPairSigner.fromSecretKey(agent.keyPair.toString()),
);

const outcome = await account.transfer({
  receiverId: curator.accountId,
  amount: nearToYocto(PAY_AMOUNT),
});
const txHash = outcome.transaction?.hash ?? outcome.transaction_outcome?.id;
console.log(`\ntransfer sent: ${PAY_AMOUNT} NEAR`);
console.log("tx:", txHash);
console.log(`explorer: https://testnet.nearblocks.io/txns/${txHash}`);

console.log("\nverifying (polling for FINAL)...");
let verdict;
for (let i = 0; i < 15; i++) {
  verdict = await verifyNearPayment({
    rpcUrl: RPC_URL,
    txHash,
    signerAccountId: agent.accountId,
    expectedReceiverId: curator.accountId,
    minDepositYocto: nearToYocto(PAY_AMOUNT),
  });
  if (verdict.ok && verdict.finalExecutionStatus === "FINAL") break;
  await new Promise((r) => setTimeout(r, 2000));
}

console.log("\nverdict:", verdict);
if (verdict?.ok) {
  const final = verdict.finalExecutionStatus === "FINAL" ? "FINAL" : `pending (${verdict.finalExecutionStatus})`;
  console.log(`PASS — payment verified on-chain, finality: ${final}`);
} else {
  console.log("FAIL");
  process.exitCode = 1;
}
