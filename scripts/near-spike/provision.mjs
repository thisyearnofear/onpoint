/**
 * NEAR testnet provisioning for the OnPoint agent-commerce demo.
 *
 * Creates a small account tree via the public testnet helper + sub-account
 * creation, then writes credentials to near-credentials.testnet.json
 * (scripts/* is gitignored — keys stay local):
 *
 *   <root>.testnet            platform account → NEAR_PAYOUT_ACCOUNT fallback
 *   agent.<root>.testnet      paying agent → demo agent's own key (limited funds)
 *   curator.<root>.testnet    curator payout → curator commerce.nearAccountId
 *
 * Trust model: the agent holds a full-access key ONLY on its sub-account
 * (limited balance = scoped spend). The root key stays in the credentials
 * file, never in app env or agent code. The API itself needs no secrets —
 * it only verifies payments on-chain.
 *
 * Usage: node provision.mjs
 */
import {
  Account,
  JsonRpcProvider,
  KeyPair,
  KeyPairSigner,
  nearToYocto,
} from "near-api-js";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RPC_URL = "https://rpc.testnet.near.org";
const HELPER_URL = "https://helper.testnet.near.org/account";
const provider = new JsonRpcProvider({ url: RPC_URL });
const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "near-credentials.testnet.json");

const ROOT_CANDIDATES = [
  "onpoint",
  "onpoint-app",
  "onpoint-pay",
  "onpoint-agent",
  "onpoint-commerce",
  "trustfall-onpoint",
];
const AGENT_FUNDING = "3"; // NEAR — enough for dozens of try-on/order demos
const CURATOR_FUNDING = "0.1"; // NEAR — storage minimum + change

async function accountExists(accountId) {
  try {
    await provider.query({
      request_type: "view_account",
      finality: "final",
      account_id: accountId,
    });
    return true;
  } catch {
    return false;
  }
}

async function createFundedTestnetAccount(accountId, publicKey) {
  const res = await fetch(HELPER_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      newAccountId: accountId,
      newAccountPublicKey: publicKey,
    }),
  });
  if (!res.ok) {
    throw new Error(`helper create ${accountId} failed: ${res.status} ${await res.text()}`);
  }
}

function newKey() {
  const keyPair = KeyPair.fromRandom("ed25519");
  return {
    keyPair,
    publicKey: keyPair.getPublicKey().toString(),
    secretKey: keyPair.toString(),
  };
}

// ── 1. Find an available root name ──
let root = null;
for (const base of ROOT_CANDIDATES) {
  const candidate = `${base}.testnet`;
  if (!(await accountExists(candidate))) {
    root = candidate;
    break;
  }
  console.log(`${candidate} — taken`);
}
if (!root) throw new Error("No root name available — extend ROOT_CANDIDATES");
console.log(`\nroot account: ${root}`);

// ── 2. Create root via helper (auto-funded 10 NEAR) ──
const rootKey = newKey();
await createFundedTestnetAccount(root, rootKey.publicKey);
console.log("  created + funded by helper");

const rootAccount = new Account(
  root,
  provider,
  KeyPairSigner.fromSecretKey(rootKey.secretKey),
);

// ── 3. Create sub-accounts (root signs; subs get their own keys) ──
async function createSub(prefix, funding) {
  const key = newKey();
  const accountId = `${prefix}.${root}`;
  await rootAccount.createSubAccount({
    accountOrPrefix: prefix,
    publicKey: key.publicKey,
    nearToTransfer: nearToYocto(funding),
  });
  console.log(`  created ${accountId} (${funding} NEAR)`);
  return { accountId, ...{ publicKey: key.publicKey, secretKey: key.secretKey } };
}

console.log("\nsub-accounts:");
const agent = await createSub("agent", AGENT_FUNDING);
const curator = await createSub("curator", CURATOR_FUNDING);

// ── 4. Persist credentials (local only — scripts/* is gitignored) ──
const creds = {
  network: "testnet",
  rpcUrl: RPC_URL,
  createdAt: new Date().toISOString(),
  accounts: {
    root: { accountId: root, publicKey: rootKey.publicKey, secretKey: rootKey.secretKey, role: "platform" },
    agent,
    curator,
  },
};
writeFileSync(OUT, JSON.stringify(creds, null, 2) + "\n");

console.log(`\ncredentials → ${OUT}`);
console.log("\n── API env block ──────────────────────────────");
console.log(`NEAR_NETWORK=testnet`);
console.log(`NEAR_RPC_URL=${RPC_URL}`);
console.log(`NEAR_USD_PRICE=<current USD/NEAR rate>`);
console.log(`NEAR_PAYOUT_ACCOUNT=${root}`);
console.log("\n── curator (direct-to-curator NEAR payout) ────");
console.log(`UPDATE curators SET commerce = jsonb_set(commerce, '{nearAccountId}', '"${curator.accountId}"') WHERE slug = '<demo-curator>';`);
console.log("\n── demo agent pays with ───────────────────────");
console.log(`accountId: ${agent.accountId}`);
console.log(`secretKey: ${agent.secretKey}`);
