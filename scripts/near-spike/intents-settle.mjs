/**
 * End-to-end NEAR Intents settlement (script-level proof before API wiring):
 *
 *   agent (buyer)  ── NEP-413 signed transfer intent ──▶  store (seller)
 *                                                          │ execute_intents
 *                     intents.onpoint.testnet  ◀───────────┘
 *                     (defuse verifier — internal ledger settles atomically)
 *
 * Run:  node intents-settle.mjs [amountBaseUnits]   (default 50000 = 0.05 USDC.e)
 *
 * Verifies: deposit path (if ledger balance is low), signed-intent execution,
 * and the mt_batch_balance_of delta for both sides.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  accountOf,
  deposit,
  ensureVerifierKey,
  internalBalance,
  signTransferIntent,
  executeIntents,
  TOKEN_ID,
  VERIFIER,
} from "./intents-lib.mjs";

const CREDS = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");
const creds = JSON.parse(readFileSync(CREDS, "utf8"));
const agent = accountOf(creds.accounts.agent.accountId, creds.accounts.agent.secretKey);
const seller = accountOf(creds.accounts.store.accountId, creds.accounts.store.secretKey);

const amount = BigInt(process.argv[2] ?? "50000"); // 0.05 USDC.e
const link = (h) => `https://testnet.nearblocks.io/txns/${h}`;

let agentLedger = await internalBalance(agent.accountId);
console.log(`verifier: ${VERIFIER}  token: ${TOKEN_ID}`);
console.log(`ledger at start — agent: ${agentLedger}  seller: ${await internalBalance(seller.accountId)}`);

// Top the ledger up if this run's transfer wouldn't fit.
if (agentLedger < amount) {
  console.log(`agent ledger short by ${amount - agentLedger} — depositing via ft_transfer_call …`);
  const d = await deposit(agent, amount - agentLedger + 50000n);
  console.log(`deposit ${d.ok ? "ok" : "FAILED"} ${link(d.txHash)}`);
  if (!d.ok) throw new Error(`deposit failed: ${JSON.stringify(d.failure)}`);
} else {
  console.log("agent ledger funded — skipping deposit (deposit path already proven)");
}

// Snapshot AFTER any deposit so the delta isolates the intent transfer.
const before = {
  agent: await internalBalance(agent.accountId),
  seller: await internalBalance(seller.accountId),
};

// One-time: register the agent's full-access pubkey in the verifier's own
// key registry (the contract does not see NEAR access keys directly).
const keyReg = await ensureVerifierKey(agent);
console.log(keyReg.already
  ? `verifier already knows agent key ${keyReg.publicKey}`
  : `registered agent key on verifier ${keyReg.ok ? link(keyReg.txHash) : "FAILED " + JSON.stringify(keyReg.failure)}`);
if (keyReg.ok === false) process.exit(1);

// Buyer signs; seller executes — the seller submitting IS the fulfillment.
const signed = await signTransferIntent({ buyer: agent, receiverId: seller.accountId, amountBase: amount });
console.log(`intent signed by ${agent.accountId} (NEP-413, full-access key):`);
console.log(`  deadline ${signed.intentPayload.deadline}  nonce …${signed.payload.nonce.slice(-8)}`);

const res = await executeIntents(seller, signed);
console.log(`execute_intents by ${seller.accountId}: ${res.ok ? "OK" : "FAILED"} ${link(res.txHash)}`);
if (!res.ok) {
  console.log(JSON.stringify(res.failure ?? res.logs, null, 2));
  process.exit(1);
}

const after = {
  agent: await internalBalance(agent.accountId),
  seller: await internalBalance(seller.accountId),
};
const dAgent = after.agent - before.agent;
const dSeller = after.seller - before.seller;
console.log(`ledger after  — agent: ${after.agent}  seller: ${after.seller}`);
console.log(`delta        — agent: ${dAgent}  seller: ${dSeller}`);
const pass = dAgent === -amount && dSeller === amount;
console.log(pass ? `✔ settled ${amount} base units agent → seller, atomically` : "✘ delta mismatch");
process.exit(pass ? 0 : 1);
