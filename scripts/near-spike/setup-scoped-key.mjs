/**
 * Scoped spend setup for the OnPoint NEAR stablecoin demo.
 *
 * Turns the demo agent's "limited balance" into "limited authority":
 * adds a FUNCTION-CALL access key to agent.<root>.testnet that can call
 * exactly one thing — `pay` on the escrow forwarder contract
 * (escrow.<root>.testnet). A function-call key cannot attach a deposit, so
 * it can NEVER call ft_transfer directly; the forwarder holds the agent's
 * escrowed USDC.e and releases it only to allow-listed curator accounts.
 *
 * Spend authority is enforced by the chain, not by us:
 *   key scope:        FCAK → escrow.<root>.testnet :: pay only
 *   contract policy:  predecessor == agent, receiver ∈ merchant allow-list,
 *                     amount ≤ escrowed balance
 *
 * Steps:
 *   1. storage_deposit on the FT contract for agent + all payTo candidates
 *      (store/curator/root — whichever the API resolves as nearPayoutAccount)
 *   2. mint test USDC.e to the agent, then escrow it into the forwarder
 *   3. addFunctionCallAccessKey scoped to the forwarder's `pay` method;
 *      delete any stale function-call keys from previous setups
 *   4. write the scoped key into near-credentials.testnet.json (gitignored)
 *
 * The agent's full-access key stays on the account (used for escrow
 * top-ups) — the scoped key is what the demo pays with, which is the point.
 *
 * Usage: node setup-scoped-key.mjs   (after deploy-payforwarder.mjs)
 */
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  nearToYocto,
} from "near-api-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RPC_URL = "https://rpc.testnet.near.org";
const FT_CONTRACT = "usdc.fakes.testnet";
const FT_DECIMALS = 6;
const STORAGE_DEPOSIT = "0.0125"; // NEAR — NEP-145 minimum; excess refunded
const AGENT_TARGET_USDC = 25; // mint up to this balance for demo headroom
const ESCROW_USDC = 20; // USDC.e moved into the forwarder for the demo
const STORAGE_PAYEE_KEYS = ["store", "curator", "root"]; // payTo candidates

const provider = new JsonRpcProvider({ url: RPC_URL });
const HERE = dirname(fileURLToPath(import.meta.url));
const CREDS = join(HERE, "near-credentials.testnet.json");

const creds = JSON.parse(readFileSync(CREDS, "utf8"));
const agent = creds.accounts?.agent;
if (!agent?.accountId || !agent?.secretKey) {
  throw new Error("no agent credentials — run provision.mjs first");
}
const forwarder = creds.payForwarder?.accountId;
if (!forwarder) {
  throw new Error("no payForwarder in creds — run deploy-payforwarder.mjs first");
}

const agentAccount = new Account(
  agent.accountId,
  provider,
  KeyPairSigner.fromSecretKey(agent.secretKey),
);

const ftView = (method, args) =>
  provider.callFunction({ contractId: FT_CONTRACT, method, args });

async function ftBalanceOf(accountId) {
  const raw = await ftView("ft_balance_of", { account_id: accountId });
  return BigInt(raw ?? "0");
}
const fmt = (base) => Number(base) / 10 ** FT_DECIMALS;

// ── 1. storage_deposit: agent + every account the API might resolve as payTo ──
console.log(`FT contract: ${FT_CONTRACT}`);
console.log(`forwarder:   ${forwarder}`);
const payees = [
  agent.accountId,
  forwarder,
  ...STORAGE_PAYEE_KEYS.map((k) => creds.accounts?.[k]?.accountId).filter(Boolean),
];
for (const payee of payees) {
  const registered = await ftView("storage_balance_of", { account_id: payee });
  if (registered) {
    console.log(`  storage registered: ${payee}`);
    continue;
  }
  const out = await agentAccount.callFunctionRaw({
    contractId: FT_CONTRACT,
    methodName: "storage_deposit",
    args: { account_id: payee, registration_only: true },
    deposit: nearToYocto(STORAGE_DEPOSIT),
  });
  console.log(`  storage_deposit → ${payee}  (${out.transaction.hash})`);
}

// ── 2. mint USDC.e to the agent, then escrow it into the forwarder ──
const mintTarget = BigInt(AGENT_TARGET_USDC) * 10n ** BigInt(FT_DECIMALS);
let balance = await ftBalanceOf(agent.accountId);
console.log(`\nagent balance: ${fmt(balance)} USDC.e`);
if (balance < mintTarget) {
  const mintAmount = mintTarget - balance;
  const out = await agentAccount.callFunctionRaw({
    contractId: FT_CONTRACT,
    methodName: "mint",
    args: { account_id: agent.accountId, amount: mintAmount.toString() },
  });
  console.log(`  minted ${fmt(mintAmount)} USDC.e (${out.transaction.hash})`);
}

const escrowTarget = BigInt(ESCROW_USDC) * 10n ** BigInt(FT_DECIMALS);
const escrowed = await ftBalanceOf(forwarder);
console.log(`escrow balance: ${fmt(escrowed)} USDC.e in ${forwarder}`);
if (escrowed < escrowTarget) {
  const move = escrowTarget - escrowed;
  balance = await ftBalanceOf(agent.accountId); // re-read after minting
  if (balance < move) {
    throw new Error(`agent balance ${fmt(balance)} < top-up needed ${fmt(move)}`);
  }
  // Escrow top-up uses the agent's FULL key — the operator budgets the agent;
  // day-to-day spend goes out through the scoped key only.
  const out = await agentAccount.callFunctionRaw({
    contractId: FT_CONTRACT,
    methodName: "ft_transfer",
    args: { receiver_id: forwarder, amount: move.toString() },
    deposit: "1",
  });
  console.log(`  escrowed ${fmt(move)} USDC.e → ${forwarder} (${out.transaction.hash})`);
}

// ── 3. FCAK scoped to forwarder::pay; drop stale scoped keys ──
const { keys } = await agentAccount.getAccessKeyList();
const stale = keys.filter(
  (k) =>
    typeof k.access_key.permission === "object" &&
    k.access_key.permission?.FunctionCall &&
    !(k.access_key.permission.FunctionCall.receiver_id === forwarder &&
      k.access_key.permission.FunctionCall.method_names?.includes("pay")),
);
for (const k of stale) {
  await agentAccount.deleteKey(k.public_key);
  console.log(`\ndeleted stale scoped key ${k.public_key}`);
}
const live = keys.find(
  (k) =>
    k.access_key.permission?.FunctionCall?.receiver_id === forwarder &&
    k.access_key.permission.FunctionCall.method_names?.includes("pay"),
);
let scopedPublicKey;
if (live && live.public_key === creds.accounts.agent.functionCallKey?.publicKey) {
  scopedPublicKey = live.public_key;
  console.log(`\nscoped key already present: ${scopedPublicKey}`);
} else {
  const scopedKey = KeyPair.fromRandom("ed25519");
  scopedPublicKey = scopedKey.getPublicKey().toString();
  const addOut = await agentAccount.addFunctionCallAccessKey({
    publicKey: scopedPublicKey,
    contractId: forwarder,
    methodNames: ["pay"],
  });
  creds.accounts.agent.functionCallKey = {
    publicKey: scopedPublicKey,
    secretKey: scopedKey.toString(),
    contractId: forwarder,
    methodNames: ["pay"],
  };
  console.log(`\nfunction-call key added (${addOut.transaction.hash})`);
}

const perm = (await agentAccount.getAccessKeyList()).keys.find(
  (k) => k.public_key === scopedPublicKey,
)?.access_key?.permission;
console.log(`\nfunction-call key: ${scopedPublicKey}`);
console.log(JSON.stringify(perm, null, 2));
if (perm === "FullAccess") {
  throw new Error("scoped key registered as FullAccess — aborting");
}
writeFileSync(CREDS, JSON.stringify(creds, null, 2) + "\n");

console.log("\n── API env block ──────────────────────────────");
console.log(`NEAR_TOKEN_CONTRACT=${FT_CONTRACT}`);
console.log(`NEAR_TOKEN_FORWARDER=${forwarder}`);
console.log(`NEAR_TOKEN_DECIMALS=${FT_DECIMALS}`);
console.log(`NEAR_TOKEN_SYMBOL=USDC.e`);
