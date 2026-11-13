#!/usr/bin/env node
/**
 * OnPoint seller agent — the merchant/stylist's half of the intents rail.
 *
 * This process is the OTHER agent. It holds only the payee's own key —
 * it never touches the buyer's credentials. It watches the API's pending-
 * intent mailbox for signed NEP-413 commitments addressed to its account,
 * and fulfills them: execute_intents on the verifier, then replays the
 * stored redeem body + its own execution tx hash through the normal
 * verify path.
 *
 * Why this is safe to automate: a published intent can only ever pay its
 * named receiver_id — the signature inside carries all the authority.
 * This agent just decides WHETHER to fulfill (its own acceptance check:
 * receiver must be itself, deadline unexpired), then submits.
 *
 *   API_URL=http://localhost:48751 node seller-agent.mjs           # all payees
 *   API_URL=… SELLER=store.onpoint.testnet node seller-agent.mjs   # one
 *
 * Keys: reads ONLY creds.accounts.store / .curator from
 * near-credentials.testnet.json — the buyer's key never enters this
 * process. On mainnet a merchant runs this with their own account.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as intents from "./intents-lib.mjs";

const API = process.env.API_URL || "http://localhost:48751";
const POLL_MS = Number(process.env.POLL_MS || 3000);
const CREDS_PATH = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const txLink = (h) => `https://testnet.nearblocks.io/txns/${h}`;

if (!existsSync(CREDS_PATH)) {
  console.error("no near-credentials.testnet.json — run provision.mjs first");
  process.exit(1);
}
const creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));

// This process may hold payee keys only — never the buyer's.
const only = process.env.SELLER ? [process.env.SELLER] : null;
const sellers = new Map(); // payee accountId → Account
for (const name of ["store", "curator"]) {
  const rec = creds.accounts?.[name];
  if (rec?.secretKey && (!only || only.includes(rec.accountId))) {
    sellers.set(rec.accountId, intents.accountOf(rec.accountId, rec.secretKey));
  }
}
if (sellers.size === 0) {
  console.error(`no seller keys — SELLER=${process.env.SELLER || "(any)"} not found in creds.accounts.{store,curator}`);
  process.exit(1);
}

// The seller's own fulfillment policy — deliberately independent of the
// API's. Trust nothing the mailbox says: re-check the signed payload.
function acceptanceCheck(p, myAccountId) {
  if (p.payee !== myAccountId) return { ok: false, why: `addressed to ${p.payee}, not me` };
  if (Date.parse(p.expiresAt) <= Date.now()) return { ok: false, why: "deadline passed" };
  let msg;
  try { msg = JSON.parse(p.signed.payload.message); } catch { return { ok: false, why: "message unparseable" }; }
  const transfer = (msg.intents ?? []).find((i) => i?.intent === "transfer" && i?.receiver_id === myAccountId);
  if (!transfer) return { ok: false, why: "no transfer paying me" };
  return { ok: true, amountBase: transfer.tokens?.[intents.TOKEN_ID] ?? "0", buyer: msg.signer_id };
}

async function fulfill(p, seller) {
  const exec = await intents.executeIntents(seller, p.signed);
  if (!exec.ok) {
    say(`   ${C.y}✗${C.x} execute_intents failed: ${JSON.stringify(exec.failure ?? {}).slice(0, 160)}`);
    await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "failed", result: { failure: exec.failure } }),
    }).catch(() => {});
    return;
  }
  say(`   ${C.g}✓${C.x} executed — ${txLink(exec.txHash)}`);

  if (p.redeem?.path && p.redeem?.body) {
    const res = await fetch(new URL(p.redeem.path, API).href, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...p.redeem.body, nearAccountId: p.buyer, intentsTxHash: exec.txHash }),
    });
    const body = await res.json().catch(() => ({}));
    say(`   ${res.ok ? `${C.g}✓` : `${C.y}✗`}${C.x} redeem ${res.status} — order ${body.orderId ?? body.status ?? "?"}${body.receiptUrl ? `  receipt ${body.receiptUrl}` : ""}`);
    // Hand the redemption back to the buyer through the mailbox (capped).
    const result = { status: res.status, orderId: body.orderId, receiptUrl: body.receiptUrl };
    if (JSON.stringify(body).length <= 8_000) result.body = body; // fits the mailbox's 10kb limit
    await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: exec.txHash, status: res.ok ? "settled" : "failed", result }),
    }).catch(() => {});
    return;
  }
  await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ txHash: exec.txHash, status: "settled" }),
  }).catch(() => {});
}

say(`${C.b}seller agent${C.x}  ·  api: ${API}  ·  payees: ${[...sellers.keys()].join(", ")}`);
say(`${C.dim}watching the pending-intent mailbox — I only hold my own key${C.x}`);

for (;;) {
  for (const [payee, seller] of sellers) {
    let list;
    try {
      list = await (await fetch(`${API}/api/pending-intents?payee=${payee}`)).json();
    } catch { continue; }
    for (const p of list.pending ?? []) {
      const check = acceptanceCheck(p, payee);
      if (!check.ok) {
        say(`${C.dim}   skip ${p.pendingId}: ${check.why}${C.x}`);
        continue;
      }
      say(`\n${C.m}━━${C.x} intent ${p.pendingId}: ${C.b}${(Number(check.amountBase) / 1e6).toFixed(2)} USDC.e${C.x} from ${check.buyer}`);
      await fulfill(p, seller);
    }
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
