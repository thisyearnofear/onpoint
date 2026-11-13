/**
 * Deploys the pay-forwarder contract to escrow.<root>.testnet.
 *
 * The contract releases escrowed USDC.e via ft_transfer when the agent's
 * scoped function-call key invokes `pay` — the key itself can't call the
 * FT because function-call keys can't attach the 1 yoctoNEAR deposit that
 * NEP-141 requires. The contract funds that yocto from its own balance.
 *
 * Steps:
 *   1. create escrow.<root>.testnet (funded from root — gas + FT deposit yocto)
 *   2. deploy pay_forwarder.wasm
 *   3. storage_deposit so the contract can HOLD the FT (escrow)
 *   4. write accounts.pay into near-credentials.testnet.json (gitignored)
 *
 * Usage: node deploy-payforwarder.mjs   (after provision.mjs)
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
const PAY_FUNDING = "1.5"; // NEAR — ~1.2 NEAR code-storage stake + gas + 1-yocto ft_transfer deposits
const WASM = join(
  dirname(fileURLToPath(import.meta.url)),
  "pay-forwarder/target/wasm32-unknown-unknown/release/pay_forwarder.wasm",
);
const CREDS = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");

const provider = new JsonRpcProvider({ url: RPC_URL });
const creds = JSON.parse(readFileSync(CREDS, "utf8"));
const root = creds.accounts?.root;
if (!root?.accountId || !root?.secretKey) {
  throw new Error("no root credentials — run provision.mjs first");
}
const payId = `escrow.${root.accountId}`;

async function exists(id) {
  try {
    await provider.query({ request_type: "view_account", finality: "final", account_id: id });
    return true;
  } catch {
    return false;
  }
}

const rootAccount = new Account(
  root.accountId,
  provider,
  KeyPairSigner.fromSecretKey(root.secretKey),
);

// ── 1. pay.<root> sub-account ──
let payKey;
if (await exists(payId)) {
  if (!creds.accounts?.pay?.secretKey) {
    throw new Error(`${payId} exists but creds lack accounts.pay — can't sign for it`);
  }
  payKey = creds.accounts.pay;
  console.log(`pay account exists: ${payId}`);
} else {
  const keyPair = KeyPair.fromRandom("ed25519");
  await rootAccount.createSubAccount({
    accountOrPrefix: "escrow",
    publicKey: keyPair.getPublicKey().toString(),
    nearToTransfer: nearToYocto(PAY_FUNDING),
  });
  payKey = {
    accountId: payId,
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: keyPair.toString(),
    role: "pay-forwarder",
  };
  console.log(`created ${payId} (${PAY_FUNDING} NEAR)`);
}

const payAccount = new Account(
  payId,
  provider,
  KeyPairSigner.fromSecretKey(payKey.secretKey),
);

// ── 2. deploy wasm ──
const code = readFileSync(WASM);
const out = await payAccount.deployContract(code);
console.log(`deployed ${code.length} bytes → ${payId} (${out.transaction.hash})`);

// ── 2b. init the spend policy (owner-managed; self-call only, one-time) ──
const agentId = creds.accounts?.agent?.accountId ?? `agent.${root.accountId}`;
const storeId = creds.accounts?.store?.accountId ?? `store.${root.accountId}`;
const curatorId = creds.accounts?.curator?.accountId ?? `curator.${root.accountId}`;
const state = await provider
  .callFunction({ contractId: payId, method: "get_state", args: {} })
  .catch(() => null);
if (state) {
  console.log(`already initialized: ${JSON.stringify(state)}`);
} else {
  const initOut = await payAccount.callFunctionRaw({
    contractId: payId,
    methodName: "init",
    args: {
      owner: root.accountId,
      agent: agentId,
      token: FT_CONTRACT,
      max_per_tx: "25000000", // 25 USDC.e at 6 decimals
      payees: [storeId, curatorId, root.accountId],
    },
  });
  console.log(`init(owner=${root.accountId}, agent=${agentId}, cap=25 USDC.e) (${initOut.transaction.hash})`);
}

// ── 3. storage_deposit so the contract can hold the FT (escrow) ──
const registered = await provider.callFunction({
  contractId: FT_CONTRACT,
  method: "storage_balance_of",
  args: { account_id: payId },
});
if (registered) {
  console.log(`storage registered: ${payId}`);
} else {
  const depOut = await payAccount.callFunctionRaw({
    contractId: FT_CONTRACT,
    methodName: "storage_deposit",
    args: { account_id: payId, registration_only: true },
    deposit: nearToYocto("0.0125"),
  });
  console.log(`storage_deposit → ${payId} (${depOut.transaction.hash})`);
}

// ── 4. persist ──
creds.accounts.pay = payKey;
creds.payForwarder = { accountId: payId, ftContract: FT_CONTRACT, method: "pay" };
writeFileSync(CREDS, JSON.stringify(creds, null, 2) + "\n");
console.log(`\ncreds → ${CREDS} (accounts.pay + payForwarder)`);
console.log(`\nAPI env:  NEAR_TOKEN_FORWARDER=${payId}`);
