/**
 * Deploys the canonical NEAR Intents "Verifier" (defuse) contract to
 * intents.<root>.testnet.
 *
 * Why: the upstream verifier at intents.near is mainnet-only and
 * intents.testnet has no code deployed. For the demo we run the real,
 * unmodified release wasm (defuse/v0.4.2, sha256-verified at download)
 * on our own testnet account. The settlement path — deposit via
 * ft_transfer_call, NEP-413 signed intent, execute_intents — is identical
 * to mainnet; only the ledger (mock USDC.e) differs.
 *
 * Steps:
 *   1. fund root if needed (store.<root> holds idle NEAR and keeps it in the family)
 *   2. create intents.<root>.testnet funded for code storage (~14.6 NEAR)
 *   3. deploy intents-verifier/defuse.wasm
 *   4. call new({ wnear_id, fees, roles.super_admins: [root] })
 *   5. write accounts.intents into near-credentials.testnet.json (gitignored)
 *
 * Usage: node deploy-intents-verifier.mjs   (after provision.mjs)
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
const WASM = join(dirname(fileURLToPath(import.meta.url)), "intents-verifier/defuse.wasm");
const CREDS = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");
const INTENTS_BALANCE = "15.2"; // ~14.66 NEAR storage stake for 1.46MB + margin
const ROOT_TOPUP = "16"; // pulled from store.<root> when root is short

const provider = new JsonRpcProvider({ url: RPC_URL });
const creds = JSON.parse(readFileSync(CREDS, "utf8"));
const root = creds.accounts?.root;
const store = creds.accounts?.store;
if (!root?.accountId || !root?.secretKey) throw new Error("no root credentials — run provision.mjs first");
const intentsId = `intents.${root.accountId}`;

const account = (id, sk) => new Account(id, provider, KeyPairSigner.fromSecretKey(sk));
const balance = async (id) => {
  try {
    const r = await provider.query({ request_type: "view_account", finality: "final", account_id: id });
    return Number(r.amount) / 1e24;
  } catch {
    return null;
  }
};

// ── 1. top up root from store if needed (only when creating the account) ──
const intentsExists = (await balance(intentsId)) !== null;
const rootBal = (await balance(root.accountId)) ?? 0;
if (!intentsExists && rootBal < Number(INTENTS_BALANCE) + 0.3) {
  if (!store?.secretKey) throw new Error(`root has ${rootBal.toFixed(2)} NEAR — need ~${Number(INTENTS_BALANCE) + 0.3}; no store key to top up`);
  console.log(`root has ${rootBal.toFixed(2)} NEAR — pulling ${ROOT_TOPUP} NEAR from ${store.accountId}`);
  const topUp = await account(store.accountId, store.secretKey).transfer({
    receiverId: root.accountId,
    amount: nearToYocto(ROOT_TOPUP).toString(),
  });
  console.log(`  funded root (${topUp.transaction.hash ?? topUp.transaction_outcome?.id})`);
}

// ── 2. create intents.<root>.testnet ──
const rootAccount = account(root.accountId, root.secretKey);
const savedIntents = creds.accounts?.intents;
const intentsKey = savedIntents?.secretKey
  ? KeyPair.fromString(savedIntents.secretKey)
  : KeyPair.fromRandom("ed25519");
const canSignAsIntents = Boolean(savedIntents?.secretKey);
if (!intentsExists) {
  console.log(`creating ${intentsId}…`);
  await rootAccount.createAccount({
    newAccountId: intentsId,
    publicKey: intentsKey.getPublicKey().toString(),
    nearToTransfer: nearToYocto(INTENTS_BALANCE),
  });
} else {
  console.log(`${intentsId} already exists`);
}
const intents = account(intentsId, intentsKey.toString());

// ── 3. deploy the canonical verifier wasm ──
const code = readFileSync(WASM);
let codeDeployed = false;
try {
  const cc = await provider.query({ request_type: "view_code", finality: "final", account_id: intentsId });
  codeDeployed = Boolean(cc.code_base64 && cc.code_base64.length > 4);
} catch {}
if (codeDeployed) {
  console.log(`  verifier code already deployed — skipping redeploy`);
} else if (!canSignAsIntents) {
  throw new Error(`no code on ${intentsId} and its key isn't in creds — cannot deploy. Delete/recreate the account or restore the key.`);
} else {
  console.log(`deploying ${code.length} bytes → ${intentsId}…`);
  const deploy = await intents.deployContract(code);
  console.log(`  deployed (${deploy.transaction.hash ?? deploy.transaction_outcome?.id})`);
}

// ── 4. init: zero-fee verifier, root is super admin ──
// DefuseConfig { wnear_id, fees: { fee: Pips, fee_collector }, roles }
// `new` isn't predecessor-gated in near-sdk — root signs it when the
// intents account key isn't in creds.
const intentsSigner = canSignAsIntents ? intents : rootAccount;
const init = await intentsSigner.callFunctionRaw({
  contractId: intentsId,
  methodName: "new",
  args: {
    config: {
      wnear_id: "wrap.testnet",
      fees: { fee: 0, fee_collector: root.accountId },
      roles: { super_admins: [root.accountId], admins: {}, grantees: {} },
    },
  },
});
console.log(`  initialized (${init.transaction.hash ?? init.transaction_outcome?.id})`);

// ── 5. record creds ──
creds.accounts.intents = {
  accountId: intentsId,
  publicKey: intentsKey.getPublicKey().toString(),
  secretKey: intentsKey.toString(),
  contract: "defuse/v0.4.2 canonical verifier (intents.near upstream is mainnet-only)",
};
creds.intentsVerifier = { contractId: intentsId, release: "defuse/v0.4.2", wnear: "wrap.testnet" };
writeFileSync(CREDS, JSON.stringify(creds, null, 2) + "\n");
console.log(`\ncreds → ${CREDS} (accounts.intents + intentsVerifier)`);
console.log(`verifier: ${intentsId}  ·  mt tokens live under nep141:<ft-contract> ids`);
