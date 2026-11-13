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
 *   SOLVER=me.testnet [SOLVER_KEY=ed25519:…]                        # solver job —
 *     polls the OPEN solver queue (?solver=1): swap-funded intents broadcast
 *     to ANY solver, whoever the payee is. I counter-sign the mirror diff,
 *     execute the bundle, take the give asset — solver ≠ payee on the
 *     receipt is the point. Can name an account already in SELLER creds.
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
const CREDS_PATH = join(dirname(fileURLToPath(import.meta.url)), intents.NET.credsFile);
// Per-network policy file: seller-policy.<network>.json wins, then the plain file.
const POLICY_PATH = [
  join(dirname(fileURLToPath(import.meta.url)), `seller-policy.${intents.NET.network}.json`),
  join(dirname(fileURLToPath(import.meta.url)), "seller-policy.json"),
].find(existsSync);

const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const txLink = (h) => `${intents.NET.explorerTx}${h}`;

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
// Open solver queue: SOLVER= gives this process a second job — race other
// solvers for swap-funded intents addressed to ANY payee. The solver's
// counter-diff signature must verify on-chain, so its key needs the same
// verifier registration a payee's does.
const solverIds = process.env.SOLVER ? process.env.SOLVER.split(",").map((s) => s.trim()) : [];
const solvers = new Map(); // solverId → Account
for (const id of solverIds) {
  if (sellers.has(id)) solvers.set(id, sellers.get(id));
}
if (process.env.SOLVER && process.env.SOLVER_KEY) {
  for (const id of solverIds) solvers.set(id, intents.accountOf(id, process.env.SOLVER_KEY));
}
if (process.env.SOLVER && solvers.size === 0) {
  console.error(`SOLVER=${process.env.SOLVER} resolves to no key — add it to creds, SELLER= it too, or pass SOLVER_KEY`);
  process.exit(1);
}
if (sellers.size === 0 && solvers.size === 0) {
  console.error(`no keys — SELLER=${process.env.SELLER || "(any)"} not found in creds and neither SELLER_KEY nor SOLVER_KEY given`);
  process.exit(1);
}

// The verifier keeps its own pubkey registry — a payee's key must be
// registered before its signatures (ft_withdraw intents included) verify.
// Idempotent view+payable call; a fresh merchant does this once at boot.
const registrationAccounts = new Map([...sellers, ...solvers]);
for (const [payee, seller] of registrationAccounts) {
  await intents.ensureVerifierKey(seller).catch((e) =>
    say(`   ${C.y}⚠${C.x} verifier key registration for ${payee}: ${String(e).slice(0, 120)}`),
  );
  // Same for the FT's storage registry — a fresh account can't receive
  // NEP-141 tokens until it registers. Idempotent; the merchant's own
  // agent pays the 0.00125 NEAR once, the platform never has to.
  await intents.ensureFtStorage(seller).then((r) =>
    !r?.already && say(`   ${C.g}✓${C.x} FT storage registered for ${payee}`),
  ).catch((e) =>
    say(`   ${C.y}⚠${C.x} FT storage registration for ${payee}: ${String(e).slice(0, 120)}`),
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
  if (msg.verifying_contract !== intents.VERIFIER) return { ok: false, why: `venue ${msg.verifying_contract}, not ${intents.VERIFIER}` };
  const transfer = (msg.intents ?? []).find((i) => i?.intent === "transfer" && i?.receiver_id === myAccountId);
  if (!transfer) return { ok: false, why: "no transfer paying me" };
  return { ok: true, amountBase: transfer.tokens?.[intents.TOKEN_ID] ?? "0", buyer: msg.signer_id };
}

// Collect: pull what the settle just earned off the verifier's internal
// ledger into my own wallet — earn → custody, signed by my key, executed
// by me. Earnings stay on-ledger if this fails; the redeem already landed.
// Cross-chain collection (workstream J): my policy says earnings leave on
// another chain. I sign a Sepolia transfer FROM my MPC-derived address TO
// the payee's MPC-derived address — no EVM private key exists on either
// side; v1.signer-prod.testnet (public MPC) signs, not me.
async function settleXchain(seller, payee, amountBase) {
  const pol = policyCfg[seller.accountId] ?? policyCfg.default ?? {};
  if (!pol.xchainPayoutWei) return null;
  try {
    const cs = await import("./chain-sig.mjs");
    const wei = BigInt(pol.xchainPayoutWei);
    const r = await cs.sendEvmTransfer({
      nearAccount: seller, nearAccountId: seller.accountId,
      to: await cs.deriveEvmAddress(payee), weiAmount: wei,
    });
    say(`   ${C.g}✓${C.x} cross-chain settle — MPC signed my ${Number(wei) / 1e18} sepoliaETH to ${payee}'s derived address ${r.to}`);
    say(`   ${C.dim}${r.explorer}${C.x}`);
    return { chain: "sepolia", txHash: r.evmTx, explorer: r.explorer, to: r.to, wei: wei.toString() };
  } catch (e) {
    say(`   ${C.y}⚠${C.x} cross-chain leg failed (NEAR-side settle already landed): ${String(e?.message ?? e).slice(0, 160)}`);
    return null;
  }
}

// A solver's own acceptance check — mirror of the payee's, minus "pays
// me". Trust nothing the mailbox says: the buyer's transfer must pay the
// stated payee (I earn the swap's give asset instead), and a swap must
// exist for me to counter-sign at all.
function solverCheck(p, solverId) {
  if (!p.swap?.signed) return { ok: false, why: "no swap leg to solve" };
  if (p.payee === solverId) return { ok: false, why: "addressed to me — my payee queue owns it" };
  if (Date.parse(p.expiresAt) <= Date.now()) return { ok: false, why: "deadline passed" };
  let msg;
  try { msg = JSON.parse(p.signed.payload.message); } catch { return { ok: false, why: "message unparseable" }; }
  if (msg.verifying_contract !== intents.VERIFIER) return { ok: false, why: `venue ${msg.verifying_contract}, not ${intents.VERIFIER}` };
  const transfer = (msg.intents ?? []).find((i) => i?.intent === "transfer" && i?.receiver_id === p.payee);
  if (!transfer) return { ok: false, why: "no transfer to the stated payee" };
  return { ok: true, amountBase: transfer.tokens?.[intents.TOKEN_ID] ?? "0" };
}

// Collect: pull what the settle just earned off the verifier's internal
// ledger into my own wallet — earn → custody, signed by my key, executed
// by me. Earnings stay on-ledger if this fails; the redeem already landed.
// A solver earns the swap's give asset, not the settlement token.
async function collect(seller, amountBase, tokenId = intents.TOKEN_ID) {
  const isUsd = tokenId === intents.TOKEN_ID;
  const fmt = (v) => (isUsd ? (Number(v) / 1e6).toFixed(2) : (Number(v) / 1e24).toFixed(4));
  // Solver earnings land in the give token — its FT contract needs storage
  // too, not just the settlement token's. Idempotent registration first.
  if (!isUsd) {
    const contract = tokenId.replace(/^nep141:/, "");
    await intents.ensureFtStorage(seller, contract).catch(() => {});
  }
  const withdraw = await intents
    .signWithdrawIntent({ owner: seller, amountBase, tokenId })
    .then((signed) => intents.executeIntents(seller, signed))
    .catch((e) => ({ ok: false, failure: String(e) }));
  if (withdraw.ok) {
    const ledger = await intents.internalBalance(seller.accountId, tokenId).catch(() => null);
    say(`   ${C.g}✓${C.x} collected ${fmt(amountBase)} ${isUsd ? "USDC.e" : tokenId.replace("nep141:", "")} → my wallet (ledger → ${ledger === null ? "?" : fmt(ledger)})`);
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
function solveSwap(p, deciderId, transferAmountBase) {
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
  const minRate = policyFor(policyCfg, deciderId).minUsdcPerWnear ?? 0;
  if (swap.giveTokenId === `nep141:${intents.NET.wnear}` && minRate > 0) {
    const impliedUsdcPerWnear = (Number(getAmt) / 1e6) / (Number(giveAmt) / 1e24);
    if (impliedUsdcPerWnear < minRate) {
      return { ok: false, why: `rate ${impliedUsdcPerWnear.toFixed(3)} USDC/wNEAR < my minimum ${minRate}` };
    }
    say(`   ${C.c}solver policy${C.x} (${deciderId}): ${impliedUsdcPerWnear.toFixed(3)} USDC/wNEAR ≥ my ${minRate} — I'll take the wNEAR`);
  }
  return { ok: true };
}

async function fulfill(p, seller, amountBase, { solver = false } = {}) {
  let exec;
  try {
    if (p.swap) {
      // Who decides the rate is my account's own policy — payee or solver,
      // it is MY liquidity that counter-signs the mirror.
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
      body: JSON.stringify({ status: "failed", result: { failure: exec.failure }, executor: seller.accountId }),
    }).catch(() => {});
    return false;
  }
  say(`   ${C.g}✓${C.x} executed — ${txLink(exec.txHash)}`);

  if (p.redeem?.path && p.redeem?.body) {
    const res = await fetch(new URL(p.redeem.path, API).href, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...p.redeem.body, nearAccountId: p.buyer, intentsTxHash: exec.txHash, intentsExecutor: seller.accountId }),
    });
    const body = await res.json().catch(() => ({}));
    const orderId = body.order?.id ?? body.orderId;
    const receiptUrl = body.order?.receiptUrl ?? body.receiptUrl;
    say(`   ${res.ok ? `${C.g}✓` : `${C.y}✗`}${C.x} redeem ${res.status} — order ${orderId ?? body.status ?? "?"}${receiptUrl ? `  receipt ${receiptUrl}` : ""}`);
    // Hand the redemption back to the buyer through the mailbox (capped).
    const result = { status: res.status, orderId, receiptUrl };
    if (res.ok) {
      const xchain = await settleXchain(seller, p.payee ?? seller.accountId, amountBase);
      if (xchain) result.xchain = xchain;
    }
    if (JSON.stringify(body).length <= 8_000) result.body = body; // fits the mailbox's 10kb limit
    await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ txHash: exec.txHash, status: res.ok ? "settled" : "failed", result, executor: seller.accountId }),
    }).catch(() => {});
    // The payee collects the transfer it earned; a solver collects the
    // swap's give asset — solver ≠ payee on the receipt, and in the wallet.
    if (res.ok) await collect(seller, solver ? p.swap.giveAmount : amountBase, solver ? p.swap.giveTokenId : undefined);
    return res.ok;
  }
  await fetch(`${API}/api/pending-intents/${p.pendingId}/complete`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ txHash: exec.txHash, status: "settled", executor: seller.accountId }),
  }).catch(() => {});
  return true;
}

say(`${C.b}seller agent${C.x}  ·  api: ${API}  ·  payees: ${[...sellers.keys()].join(", ") || "(none — solver only)"}`);
if (solvers.size) say(`${C.c}solver job${C.x}  ·  ${[...solvers.keys()].join(", ")} — racing the open queue for swap intents`);
say(`${C.dim}watching pending-intents + pending-negotiations — I only hold my own key${C.x}`);
say(`${C.dim}heartbeating every ${HEARTBEAT_MS / 1000}s — while I live, offers come to ME (sovereign)${C.x}`);

const attempted = new Map(); // solverId:pendingId → last failed attempt ms (60s cooldown)

for (;;) {
  const seen = new Set(); // dedupe per account+item — different solvers MUST each get their attempt (that's the race)
  for (const [payee, seller] of sellers) {
    await heartbeat(payee).catch(() => {});
    let list;
    try {
      list = await (await fetch(`${API}/api/pending-intents?payee=${payee}`)).json();
    } catch { continue; }
    for (const p of list.pending ?? []) {
      if (seen.has(`${payee}:${p.pendingId}`)) continue;
      seen.add(`${payee}:${p.pendingId}`);
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
  // Open solver queue: swap items broadcast to ANY solver — I race for
  // them regardless of payee. Losers burn a failed execute_intents; the
  // mailbox's first-wins complete() keeps the receipt honest. A failed
  // attempt cools down — spamming execute on an unwinnable item just
  // burns gas.
  for (const [solverId, solver] of solvers) {
    let list;
    try {
      list = await (await fetch(`${API}/api/pending-intents?solver=1`)).json();
    } catch { continue; }
    for (const p of list.pending ?? []) {
      const key = `${solverId}:${p.pendingId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const lastTry = attempted.get(key) ?? 0;
      if (Date.now() - lastTry < 60_000) continue;
      const check = solverCheck(p, solverId);
      if (!check.ok) {
        say(`${C.dim}   solver skip ${p.pendingId}: ${check.why}${C.x}`);
        continue;
      }
      const give = p.swap?.giveAmount ? `${(Number(p.swap.giveAmount) / 1e24).toFixed(4)} ${(p.swap.giveTokenId ?? "?").replace("nep141:", "")}` : "?";
      say(`\n${C.m}━━${C.x} solver ${solverId}: swap ${p.pendingId} — funds ${(Number(check.amountBase) / 1e6).toFixed(2)} USDC.e → ${C.b}${p.payee}${C.x}, I take ${give}`);
      const ok = await fulfill(p, solver, check.amountBase, { solver: true });
      if (ok === false) attempted.set(key, Date.now());
    }
  }
  await new Promise((r) => setTimeout(r, POLL_MS));
}
