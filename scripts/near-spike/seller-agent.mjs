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
 *   SELLER=you.testnet SELLER_KEY=ed25519:… node seller-agent.mjs  # YOUR account —
 *                                                                   no demo creds needed
 *
 * Keys: reads ONLY creds.accounts.store / .curator from
 * near-credentials.testnet.json (optional), or SELLER_KEY directly —
 * the buyer's key never enters this process. On mainnet a merchant
 * runs this with their own account.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as intents from "./intents-lib.mjs";
import { decide, policyFor } from "./seller-policy.mjs";

const API = process.env.API_URL || "http://localhost:48751";
const POLL_MS = Number(process.env.POLL_MS || 3000);
const HEARTBEAT_MS = Number(process.env.HEARTBEAT_MS || 15000);
const CREDS_PATH = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");
const POLICY_PATH = join(dirname(fileURLToPath(import.meta.url)), "seller-policy.json");

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const txLink = (h) => `https://testnet.nearblocks.io/txns/${h}`;

const creds = existsSync(CREDS_PATH)
  ? JSON.parse(readFileSync(CREDS_PATH, "utf8"))
  : { accounts: {} }; // demo creds optional — SELLER_KEY covers standalone merchants

// This process may hold payee keys only — never the buyer's.
const only = process.env.SELLER ? process.env.SELLER.split(",").map((s) => s.trim()) : null;
const sellers = new Map(); // payee accountId → Account
// Every creds entry that isn't the platform root or the buyer agent is a
// candidate payee (store, curator, merchant-ext, …).
for (const [name, rec] of Object.entries(creds.accounts || {})) {
  if (name === "root" || name === "agent") continue;
  if (rec?.secretKey && (!only || only.includes(rec.accountId))) {
    sellers.set(rec.accountId, intents.accountOf(rec.accountId, rec.secretKey));
  }
}
// Direct key — how a real merchant runs this: their account, their key,
// nothing else from this repo's credential file.
if (process.env.SELLER && process.env.SELLER_KEY) {
  sellers.set(process.env.SELLER, intents.accountOf(process.env.SELLER, process.env.SELLER_KEY));
}
if (sellers.size === 0) {
  console.error(`no seller keys — SELLER=${process.env.SELLER || "(any)"} not found in creds.accounts.{store,curator} and no SELLER_KEY given`);
  process.exit(1);
}
// The verifier keeps its own pubkey registry — a payee's key must be
// registered before its signatures (ft_withdraw intents included) verify.
// Idempotent view+payable call; a fresh merchant does this once at boot.
for (const [payee, seller] of sellers) {
  await intents.ensureVerifierKey(seller).catch((e) =>
    say(`   ${C.y}⚠${C.x} verifier key registration for ${payee}: ${String(e).slice(0, 120)}`),
  );
}

// ── Sovereign negotiation: presence + the offer queue ────────────────────
// The heartbeat (unsigned liveness) is what routes buyer offers to THIS
// process instead of the platform's hosted policy. Decisions — and on
// accept, the ed25519 quote-token signature — are made here, with a key
// the platform does not hold.
const policyCfg = existsSync(POLICY_PATH) ? JSON.parse(readFileSync(POLICY_PATH, "utf8")) : {};
const secrets = new Map(); // payee → raw secretKey, for quote-token signing
for (const [name, rec] of Object.entries(creds.accounts || {})) {
  if (name === "root" || name === "agent") continue;
  if (rec?.secretKey && sellers.has(rec.accountId)) secrets.set(rec.accountId, rec.secretKey);
}
if (process.env.SELLER && process.env.SELLER_KEY) secrets.set(process.env.SELLER, process.env.SELLER_KEY);

const lastBeat = new Map(); // payee → ms
async function heartbeat(payee) {
  const at = lastBeat.get(payee) ?? 0;
  if (Date.now() - at < HEARTBEAT_MS) return;
  lastBeat.set(payee, Date.now());
  const res = await fetch(`${API}/api/seller-presence`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ payee }),
  }).catch(() => null);
  if (res?.ok) say(`${C.dim}   ♥ presence beat — ${payee} (sovereign path live)${C.x}`);
}

async function answerNegotiation(item, payee) {
  const cfg = policyFor(policyCfg, payee);
  const d = decide(item, cfg);
  const ctx = item.context || {};
  const offerUsd = item.offer?.kind === "accept" ? (ctx.askCents ?? 0) / 100 : (item.offer?.cents ?? 0) / 100;
  say(`\n${C.m}━━${C.x} offer on ${ctx.listingId} (round ${item.round}): buyer ${C.b}$${offerUsd.toFixed(2)}${C.x} · my list $${((ctx.listCents ?? 0) / 100).toFixed(2)}${ctx.bundle ? " · bundle" : ""}`);
  say(`   ${C.c}my policy${C.x} (${payee}): ${d.decision}${d.priceCents ? ` @ $${(d.priceCents / 100).toFixed(2)}` : ""} — ${d.why}`);

  const body = { round: item.round, decision: d.decision, price: d.priceCents != null ? d.priceCents / 100 : undefined, reasoning: d.reasoning };
  if (d.decision === "accept") {
    body.quoteToken = intents.signQuoteToken({
      secretKey: secrets.get(payee),
      accountId: payee,
      scope: ctx.scope, curatorSlug: ctx.curatorSlug, listingId: ctx.listingId,
      size: ctx.size, quantity: ctx.quantity,
      agreedCusd: d.priceCents / 100,
      sessionId: item.sessionId, payee,
    });
    say(`   ${C.g}✓ signed the quoteToken myself — the platform never saw my key${C.x}`);
  }
  const res = await fetch(`${API}/api/pending-negotiations/${item.pendingId}/respond`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const out = await res.json().catch(() => ({}));
  if (res.ok) say(`   ${C.g}✓ answered${C.x} — buyer session is now "${out.status ?? "?"}"`);
  else say(`   ${C.y}✗ respond ${res.status}: ${out.code ?? out.error ?? "?"}${C.x}`);
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

// Collect: pull what the settle just earned off the verifier's internal
// ledger into my own wallet — earn → custody, signed by my key, executed
// by me. Earnings stay on-ledger if this fails; the redeem already landed.
async function collect(seller, amountBase) {
  const withdraw = await intents
    .signWithdrawIntent({ owner: seller, amountBase })
    .then((signed) => intents.executeIntents(seller, signed))
    .catch((e) => ({ ok: false, failure: String(e) }));
  if (withdraw.ok) {
    const display = (Number(amountBase) / 1e6).toFixed(2);
    const ledger = await intents.internalBalance(seller.accountId).catch(() => null);
    say(`   ${C.g}✓${C.x} collected ${display} USDC.e → my wallet (ledger → ${ledger === null ? "?" : (Number(ledger) / 1e6).toFixed(2)})`);
    say(`   ${C.dim}${txLink(withdraw.txHash)}${C.x}`);
  } else {
    say(`   ${C.y}⚠${C.x} withdraw intent failed (earnings stay on the ledger): ${JSON.stringify(withdraw.failure ?? {}).slice(0, 140)}`);
  }
}

// Merchant-as-solver: the buyer's payment is funded by a token_diff — it
// gives some other asset (e.g. wNEAR) for USDC.e. The bundle can only
// settle if *someone* countersigns the mirror diff, and that's me: I
// supply the settlement-token liquidity and take the other asset. The
// rate is MY decision — below my policy's minimum I refuse to sign, and
// the whole bundle cannot execute.
function solveSwap(p, payee, transferAmountBase) {
  const swap = p.swap;
  if (!swap?.diff || !swap?.signed) return { ok: false, why: "malformed swap record" };
  let giveAmt, getAmt;
  try {
    giveAmt = -BigInt(swap.diff[swap.giveTokenId]); // buyer's negative delta
    getAmt = BigInt(swap.diff[intents.TOKEN_ID]);   // buyer's positive delta
  } catch { return { ok: false, why: "diff amounts unparseable" }; }
  if (getAmt < BigInt(transferAmountBase)) {
    return { ok: false, why: `diff gets ${getAmt} < the ${transferAmountBase} it must fund` };
  }
  const minRate = policyFor(policyCfg, payee).minUsdcPerWnear ?? 0;
  if (swap.giveTokenId === "nep141:wrap.testnet" && minRate > 0) {
    const impliedUsdcPerWnear = (Number(getAmt) / 1e6) / (Number(giveAmt) / 1e24);
    if (impliedUsdcPerWnear < minRate) {
      return { ok: false, why: `rate ${impliedUsdcPerWnear.toFixed(3)} USDC/wNEAR < my minimum ${minRate}` };
    }
    say(`   ${C.c}solver policy${C.x} (${payee}): ${impliedUsdcPerWnear.toFixed(3)} USDC/wNEAR ≥ my ${minRate} — I'll take the wNEAR`);
  }
  return { ok: true };
}

async function fulfill(p, seller, amountBase) {
  let exec;
  try {
    if (p.swap) {
      const decision = solveSwap(p, seller.accountId, amountBase);
      if (!decision.ok) {
        say(`   ${C.y}✗${C.x} refused to solve the swap: ${decision.why} — bundle cannot settle without my counter-diff`);
        return; // leave it pending — the buyer can re-offer at a better rate
      }
      const mirror = await intents.signIntents({
        signer: seller,
        intents: [{ intent: "token_diff", diff: intents.counterDiff(p.swap.diff) }],
      });
      say(`   ${C.g}✓ countersigned the diff with my own key — supplying liquidity${C.x}`);
      // Order matters: diffs first so the buyer's settlement-token credit
      // lands before its transfer debits. The contract fails the whole call
      // if any leg is unbalanced mid-flight.
      exec = await intents.executeBundle(seller, [p.swap.signed, mirror, p.signed]);
    } else {
      exec = await intents.executeIntents(seller, p.signed);
    }
  } catch (e) {
    // A contract panic throws rather than returning a failed outcome —
    // record it and keep the agent alive for the next item.
    exec = { ok: false, failure: String(e?.message ?? e).slice(0, 300) };
  }
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
    const orderId = body.order?.id ?? body.orderId;
    const receiptUrl = body.order?.receiptUrl ?? body.receiptUrl;
    say(`   ${res.ok ? `${C.g}✓` : `${C.y}✗`}${C.x} redeem ${res.status} — order ${orderId ?? body.status ?? "?"}${receiptUrl ? `  receipt ${receiptUrl}` : ""}`);
    // Hand the redemption back to the buyer through the mailbox (capped).
    const result = { status: res.status, orderId, receiptUrl };
    if (JSON.stringify(body).length <= 8_000) result.body = body; // fits the mailbox's 10kb limit
    await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: exec.txHash, status: res.ok ? "settled" : "failed", result }),
    }).catch(() => {});
    if (res.ok) await collect(seller, amountBase);
    return;
  }
  await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ txHash: exec.txHash, status: "settled" }),
  }).catch(() => {});
}

say(`${C.b}seller agent${C.x}  ·  api: ${API}  ·  payees: ${[...sellers.keys()].join(", ")}`);
say(`${C.dim}watching pending-intents + pending-negotiations — I only hold my own key${C.x}`);
say(`${C.dim}heartbeating every ${HEARTBEAT_MS / 1000}s — while I live, offers come to ME (sovereign)${C.x}`);

for (;;) {
  for (const [payee, seller] of sellers) {
    await heartbeat(payee).catch(() => {});
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
      await fulfill(p, seller, check.amountBase);
    }
    let negList;
    try {
      negList = await (await fetch(`${API}/api/pending-negotiations?payee=${payee}`)).json();
    } catch { continue; }
    for (const n of negList.pending ?? []) {
      await answerNegotiation(n, payee).catch((e) => say(`   ${C.y}✗ negotiate ${n.pendingId}: ${e.message}${C.x}`));
    }
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
