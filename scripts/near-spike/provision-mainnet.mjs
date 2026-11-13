#!/usr/bin/env node
/**
 * provision-mainnet.mjs — create the mainnet account set for the
 * real-money intents run. Uses IMPLICIT accounts (account id = hex of the
 * ed25519 public key): no registrar, no naming fee — an implicit account
 * springs into existence the first time NEAR lands on its address, with
 * the key below as its full-access key.
 *
 *   node provision-mainnet.mjs            # generate creds + print funding
 *   node provision-mainnet.mjs --check    # re-check funding status only
 *
 * After funding (the script tells you exactly what to send where):
 *   --register  adds each account's pubkey to the intents.near key
 *               registry (required before it can sign NEP-413 intents)
 *               and storage_deposit's the merchant on native USDC for
 *               ft_withdraw.
 *
 * Cost envelope (~$3 total):
 *   buyer    ~0.30 NEAR gas+storage  +  ~$2.00 USDC (the spend)
 *   merchant ~0.15 NEAR gas + USDC storage
 *   solver   (optional — swap leg needs its own USDC inventory)
 */
import { KeyPair } from "near-api-js";
import { baseDecode } from "near-api-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

process.env.NEAR_NETWORK = "mainnet";
const intents = await import("./intents-lib.mjs");

const DIR = dirname(fileURLToPath(import.meta.url));
const CREDS = join(DIR, intents.NET.credsFile);
const USDC = intents.FT_CONTRACT;

const roles = ["agent", "merchant", "solver"];

function implicitAccount() {
  const kp = KeyPair.fromRandom("ed25519");
  const pubBytes = baseDecode(kp.getPublicKey().toString().split(":")[1]);
  return {
    accountId: Buffer.from(pubBytes).toString("hex"),
    secretKey: kp.toString(),
  };
}

let creds;
if (existsSync(CREDS)) {
  creds = JSON.parse(readFileSync(CREDS, "utf8"));
  console.log(`loaded existing ${intents.NET.credsFile} — not overwriting keys`);
} else {
  creds = {
    network: "mainnet",
    generated: new Date().toISOString(),
    accounts: Object.fromEntries(roles.map((r) => [r, implicitAccount()])),
  };
  writeFileSync(CREDS, JSON.stringify(creds, null, 2), { mode: 0o600 });
  console.log(`wrote ${intents.NET.credsFile} (chmod 600)`);
}

const bal = async (id) => {
  try {
    const a = await intents.provider.query({
      request_type: "view_account", finality: "final", account_id: id,
    });
    return Number(a.amount) / 1e24;
  } catch { return null; }
};
const usdcBal = async (id) =>
  Number((await intents.provider.callFunction({
    contractId: USDC, method: "ft_balance_of", args: { account_id: id },
  }).catch(() => "0")) ?? "0") / 1e6;

console.log("\n── accounts (implicit — hex id = the public key) ──");
for (const r of roles) {
  const a = creds.accounts[r];
  const [n, u] = [await bal(a.accountId), await usdcBal(a.accountId)];
  console.log(`${r.padEnd(8)} ${a.accountId}`);
  console.log(`         NEAR ${n === null ? "unfunded" : n.toFixed(4)} · USDC ${u.toFixed(2)}`);
}

const agentNear = await bal(creds.accounts.agent.accountId);
const merchantNear = await bal(creds.accounts.merchant.accountId);
if ((agentNear ?? 0) < 0.2 || (merchantNear ?? 0) < 0.05) {
  console.log("\n── fund these (testnet needs none of this — mainnet is real money) ──");
  console.log(`  ~0.30 NEAR → ${creds.accounts.agent.accountId}   (buyer gas)`);
  console.log(`  ~$2.00 USDC (NEAR network) → same address      (the spend)`);
  console.log(`  ~0.15 NEAR → ${creds.accounts.merchant.accountId} (merchant gas + storage)`);
  console.log("then re-run: node provision-mainnet.mjs --register");
  process.exit(0);
}

if (process.argv.includes("--register")) {
  const acct = (r) => intents.accountOf(creds.accounts[r].accountId, creds.accounts[r].secretKey);
  for (const r of roles) {
    const a = acct(r);
    // Each signer registers ITS OWN full-access pubkey with the verifier —
    // required before the contract accepts that key's NEP-413 signatures.
    const pubKey = KeyPair.fromString(creds.accounts[r].secretKey).getPublicKey().toString();
    try {
      await a.functionCall({
        contractId: intents.VERIFIER, method: "add_public_key",
        args: { public_key: pubKey }, gas: "5000000000000", deposit: "1",
      });
      console.log(`${r}: registered pubkey on ${intents.VERIFIER}`);
    } catch (e) {
      console.log(`${r}: add_public_key → ${String(e.message).slice(0, 120)}`);
    }
  }
  // Merchant needs USDC storage to receive ft_withdraw proceeds.
  const m = acct("merchant");
  try {
    await m.functionCall({
      contractId: USDC, method: "storage_deposit",
      args: { account_id: creds.accounts.merchant.accountId },
      gas: "30000000000000", deposit: "1250000000000000000000", // 0.00125 NEAR
    });
    console.log("merchant: USDC storage registered — ft_withdraw can pay out");
  } catch (e) {
    console.log(`merchant storage_deposit → ${String(e.message).slice(0, 120)}`);
  }
  console.log("\nready — run: NEAR_NETWORK=mainnet node seller-agent.mjs & NEAR_NETWORK=mainnet node agent-demo.mjs");
}
