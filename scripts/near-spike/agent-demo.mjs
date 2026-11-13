/**
 * OnPoint × NEAR — the agent economy, end to end.
 *
 * A narrated walkthrough of the demo story:
 *   a buying agent NEGOTIATES over multiple rounds (real counters AND a
 *   refusal, sealed by the seller's ed25519 quote signature), HIRES a
 *   styling service the same way, and SETTLES both through the NEAR
 *   Intents verifier — the buyer signs a NEP-413 intent off-chain and
 *   PUBLISHES it; a separate seller-agent process (its own key only)
 *   picks it up and executes it. Two agents, disjoint keys.
 *
 *     try-on fee  → curator.onpoint.testnet   (the hired "stylist")
 *     kit order   → store.onpoint.testnet     (the merchant)
 *
 * Settlement layers, deliberately separate:
 *   · NEP-413 signature = the agent's identity/commitment layer (off-chain)
 *   · Intents verifier  = settlement (internal ledger, atomic)
 *   · FCAK + escrow     = the bounded on-chain budget rail — still shown:
 *                         one over-cap call gets rejected by the contract.
 *
 * Run:
 *   node provision.mjs                # once — creates + funds testnet accounts
 *   node deploy-payforwarder.mjs      # once — deploys the escrow forwarder
 *   node deploy-intents-verifier.mjs  # once — deploys the defuse verifier
 *   node setup-scoped-key.mjs         # once — FCAK scoped to escrow::pay
 *   node seller-agent.mjs             # terminal 2 — the merchant/stylist agent
 *   node agent-demo.mjs               # terminal 1 — the buyer's story below
 *
 * Knobs:
 *   API_URL     default http://localhost:48751 (also works against prod)
 *   RAIL        intents (default — verifier settlement) | near (escrow
 *               forwarder) | paypal (human approves on PayPal)
 *   SKIP_CAP    set to 1 to skip the over-cap rejection beat
 */
import {
  Account,
  JsonRpcProvider,
  KeyPairSigner,
  formatNearAmount,
} from "near-api-js";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as intents from "./intents-lib.mjs";

const API = process.env.API_URL || "http://localhost:48751";
const CREDS_PATH = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");
const PHOTO_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../videos/youcam-demo/assets/person-src.jpg",
);
const photoData = existsSync(PHOTO_PATH)
  ? `data:image/jpeg;base64,${readFileSync(PHOTO_PATH).toString("base64")}`
  : "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAT8n/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqA//2Q==";
const RPC = "https://test.rpc.fastnear.com";
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

// The merchant (kit order) and the hired stylist (try-on service).
const MERCHANT_SLUG = "onpoint-store";
const STYLIST_SLUG = "mo";
// The stylist's referral — mo's payout wallet address. A raw 0x address
// resolves directly (resolveReferralAgent path 1), so the commission row
// actually lands; a bare ref_ code only resolves with prior history.
// Sent via ?referral= (not the X-Referral-Code header) so it survives the
// mailbox replay — redeem.path carries the URL, not headers.
const STYLIST_REFERRAL = "0x181eD62BDdeFa6f8FFCdCa339c28a75454be3532";

// ── tiny presentation kit ──
const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const step = (n, t) => say(`\n${C.b}${C.m}── STEP ${n} ── ${t}${C.x}`);
const agentSays = (s) => say(`${C.c}   agent ›${C.x} ${s}`);
const sellerSays = (s) => say(`${C.y}   seller ›${C.x} ${s}`);
const chain = (s) => say(`${C.g}   chain ›${C.x} ${s}`);
const info = (s) => say(`${C.dim}   ${s}${C.x}`);
const txLink = (h) => `https://testnet.nearblocks.io/txns/${h}`;

// RAIL=intents (default) | near (escrow forwarder) | paypal (human approval)
const RAIL = (process.env.RAIL || "intents").toLowerCase();
const IS_PAYPAL = RAIL === "paypal";
const IS_INTENTS = RAIL === "intents";

let creds = null;
let provider = null;
let agent = null;
let agentFak = null;   // full-access account — signs NEP-413 intents
let scopedKey = null;  // function-call key — the bounded escrow rail
let agentSigner = null;
let FT = "usdc.fakes.testnet";
let nearBalance = async () => null;
let ftBalance = async () => null;
if (!IS_PAYPAL) {
  if (!existsSync(CREDS_PATH)) {
    say(`no credentials — run ${C.b}node provision.mjs${C.x} first`);
    process.exit(1);
  }
  creds = JSON.parse(readFileSync(CREDS_PATH, "utf8"));
  provider = intents.provider;
  nearBalance = async (id) =>
    formatNearAmount(
      (await provider.query({ request_type: "view_account", finality: "final", account_id: id })).amount,
      4,
    );
  ftBalance = async (accountId, contractId, decimals = 6) => {
    const raw = await provider.callFunction({
      contractId,
      method: "ft_balance_of",
      args: { account_id: accountId },
    });
    return Number(raw ?? "0") / 10 ** decimals;
  };
  agent = creds.accounts.agent;
  scopedKey = agent.functionCallKey;
  if (!scopedKey) {
    say(`no scoped key — run ${C.b}node setup-scoped-key.mjs${C.x} first`);
    process.exit(1);
  }
  FT = creds.payForwarder?.ftContract || FT;
  agentFak = intents.accountOf(agent.accountId, agent.secretKey);
  agentSigner = new Account(agent.accountId, provider, KeyPairSigner.fromSecretKey(scopedKey.secretKey));
}

const post = async (path, body) => {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status !== 429) return res;
    const wait = (Number((await res.clone().json().catch(() => ({}))).retryAfter) || 5) * 1000;
    await SLEEP(wait + 500);
  }
  return fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
};

// Pay a NEAR payee in stablecoin through the escrow forwarder — the ONLY
// thing the scoped key can do. Returns { ok, txHash, failure }.
async function payEscrowed({ receiverId, amountBase }) {
  try {
    const out = await agentSigner.callFunctionRaw({
      contractId: scopedKey.contractId,
      methodName: "pay",
      args: { receiver_id: receiverId, amount: String(amountBase) },
      deposit: "0", // function-call keys cannot attach a deposit — by design
    });
    const txHash = out.transaction?.hash ?? out.transaction_outcome?.id;
    const failed = (out.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure);
    if (failed || out.status?.Failure) {
      return { ok: false, txHash, failure: failed?.outcome?.status?.Failure ?? out.status.Failure };
    }
    return { ok: true, txHash };
  } catch (err) {
    const res = err?.transactionResult;
    const receiptFail = (res?.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure)?.outcome?.status?.Failure;
    return {
      ok: false,
      txHash: res?.transaction?.hash ?? res?.transaction_outcome?.id,
      failure: receiptFail ?? res?.status?.Failure ?? String(err?.message ?? err).slice(0, 300),
    };
  }
}

// ── Intents settlement via the mailbox: the buyer SIGNS and PUBLISHES —
// the seller's OWN agent process (seller-agent.mjs, a separate process
// holding only the payee's key) picks it up and executes it. This script
// never holds a seller key: two agents, disjoint keys, API as mailbox.
async function publishIntent({ path, body, payee, amountBase, who, swap }) {
  const signed = await intents.signTransferIntent({ buyer: agentFak, receiverId: payee, amountBase });
  // Swap funding: the transfer is paid for by a token_diff the seller
  // countersigns (merchant-as-solver). I sign {−giveToken, +settlementToken}
  // — the bundle settles only if the seller mirrors it.
  let signedSwap;
  if (swap) {
    signedSwap = await intents.signTokenDiffIntent({
      signer: agentFak,
      give: { [swap.giveTokenId]: swap.giveAmountBase },
      get: { [intents.TOKEN_ID]: amountBase },
    });
    signedSwap.giveTokenId = swap.giveTokenId; // wire hint for the API's diff check
  }
  const res = await post(path, { ...body, nearAccountId: agent.accountId, signedIntent: signed, ...(signedSwap ? { signedSwap } : {}) });
  const accepted = await res.json();
  if (res.status !== 202) {
    return { ok: false, failure: `mailbox ${res.status}: ${JSON.stringify(accepted).slice(0, 220)}` };
  }
  const pendingId = accepted.pendingId;
  agentSays(`signed + published → ${pendingId}${signedSwap ? " (with my swap diff)" : ""}. waiting for ${who}'s agent to execute it…`);
  const deadline = Date.now() + 90_000;
  let nudged = false;
  while (Date.now() < deadline) {
    await SLEEP(2500);
    const p = await (await fetch(`${API}/api/pending-intents/${pendingId}`)).json().catch(() => null);
    if (p?.status === "settled") return { ok: true, txHash: p.txHash, result: p.result, executor: p.executor };
    if (p?.status === "failed" || p?.status === "expired") {
      return { ok: false, failure: `${p.status}: ${JSON.stringify(p.result ?? {}).slice(0, 200)}` };
    }
    if (!nudged && Date.now() > deadline - 72_000) {
      nudged = true;
      info(`   (${who}'s agent hasn't picked it up — run ${C.b}API_URL=${API} node seller-agent.mjs${C.x}${C.dim} in another terminal)`);
    }
  }
  return { ok: false, failure: `timed out waiting for ${who}'s agent — is seller-agent.mjs running?` };
}

// ── Negotiation driver: open a session, haggle until accepted ──
// Returns { quoteToken, agreedUsd, transcript: [{actor, usd, note}] }.
// Sovereign sellers answer asynchronously — a 202 pending_seller means the
// offer is with the seller's OWN process (seller-agent.mjs); we poll the
// session until it answers (or the hosted fallback kicks in).
async function negotiate({ slug, scope, listingId, size, quantity, offers }) {
  const transcript = [];
  const pollSession = async (sessionId) => {
    const deadline = Date.now() + 60_000;
    let nudged = false;
    for (;;) {
      const snap = await (await fetch(`${API}/api/curator/${slug}/negotiate/${sessionId}`)).json().catch(() => null);
      if (!snap || snap.status !== "pending_seller") return snap;
      if (!nudged) {
        nudged = true;
        info(`   (the seller's OWN agent is deciding — waiting; run ${C.b}API_URL=${API} node seller-agent.mjs${C.x}${C.dim} in another terminal)`);
      }
      if (Date.now() > deadline) return { status: "pending_seller", timedOut: true };
      await SLEEP(2000);
    }
  };
  for (let attempt = 0; attempt < 3; attempt++) {
    const openOffer = offers[attempt] ?? offers[offers.length - 1];
    const open = await post(`/api/curator/${slug}/negotiate`, {
      scope, listingId, size, quantity: quantity ?? 1,
      offerUsd: openOffer, nearAccountId: agent.accountId,
    });
    let body = await open.json();
    if (open.status !== 200 && open.status !== 202) return { error: `negotiate open ${open.status}: ${JSON.stringify(body)}` };
    transcript.push({ actor: "buyer", usd: openOffer });
    const sessionId = body.sessionId;
    if (open.status === 202) {
      body = await pollSession(sessionId);
      if (body?.timedOut) return { error: "timed out waiting for the seller's agent", transcript };
      if (!body) return { error: "session poll failed", transcript };
    }
    if (body.status === "rejected") {
      transcript.push({ actor: "seller", note: `refused — ${body.reasoning || body.status}`, status: "rejected" });
      continue; // reopen with a better offer
    }
    let guard = 0;
    while (body.status === "countered" && guard++ < 8) {
      const counter = body.counterOffer?.offerUsd;
      transcript.push({ actor: "seller", usd: counter, note: body.reasoning });
      // Buyer policy: meet the ask when it's within ~15% of our last bid,
      // else creep up halfway — never bidding past their ask.
      const lastBid = transcript.filter((t) => t.actor === "buyer").at(-1).usd;
      const meet = counter != null && counter <= lastBid * 1.15;
      const nxt = meet ? null : Number(Math.min(counter, lastBid + Math.max(0.01, (counter - lastBid) * 0.5)).toFixed(2));
      await SLEEP(2500); // stay under the API rate limit between rounds
      const r = await post(`/api/curator/${slug}/negotiate/${sessionId}`,
        nxt === null || body.round >= 4 ? { action: "accept" } : { offerUsd: nxt });
      body = await r.json();
      if (nxt === null || body.round >= 4) transcript.push({ actor: "buyer", note: "accept" });
      else transcript.push({ actor: "buyer", usd: nxt });
      if (r.status === 202) {
        body = await pollSession(sessionId);
        if (body?.timedOut) return { error: "timed out waiting for the seller's agent", transcript };
        if (!body) return { error: "session poll failed", transcript };
      }
    }
    if (body.status === "accepted") {
      return { quoteToken: body.quoteToken, agreedUsd: body.agreedUsd ?? body.agreedCusd, sessionId, transcript };
    }
    if (body.status === "rejected") {
      transcript.push({ actor: "seller", note: `refused — ${body.reasoning || "walked"}`, status: "rejected" });
      continue;
    }
    return { error: `negotiation ended ${body.status}: ${JSON.stringify(body).slice(0, 200)}`, transcript };
  }
  return { error: "seller refused all offers", transcript };
}

say(`${C.b}OnPoint × ${IS_PAYPAL ? "PayPal" : "NEAR"} — ${IS_PAYPAL ? "agentic fashion commerce" : "agents that bargain, hire, and settle"}${C.x}`);
info(`api: ${API}  ·  rail: ${RAIL}${IS_PAYPAL ? "" : `  ·  network: ${creds.network}  ·  agent: ${agent.accountId}`}`);
if (!IS_PAYPAL) {
  info(`scoped key: ${scopedKey.publicKey} → ${scopedKey.contractId}::pay only (bounded budget rail)`);
  if (IS_INTENTS) info(`intents verifier: ${intents.VERIFIER} (unmodified defuse wasm — no official testnet deploy)`);
}
agentSays(IS_PAYPAL
  ? "I have a job: buy a football kit for my human. Let's see what's for sale."
  : "My human wants the NEAR FC kit for the match. Plan: hire a stylist to check fit, haggle the price down, settle both with signed intents.");

// ── 1. Discover the offers ──
step(1, "Discover two services — a stylist and a merchant");
const [moStore, kitStore] = await Promise.all([
  fetch(`${API}/api/curator/${STYLIST_SLUG}/storefront`).then((r) => r.json()),
  fetch(`${API}/api/curator/${MERCHANT_SLUG}/storefront`).then((r) => r.json()),
]);
const stylistListing = moStore.listings?.find((l) => l.status === "live") || moStore.listings?.[0];
const kitListing = kitStore.listings?.[0];
if (!stylistListing || !kitListing) { say("missing demo listings — check storefronts"); process.exit(1); }
const offer = kitListing.agentCommerce?.offers?.find((o) => o.stock > 0) || kitListing.agentCommerce?.offers?.[0];
agentSays(`"${kitListing.title}" at ${MERCHANT_SLUG} — ${offer ? `${offer.priceKes} KES (~${offer.priceCusd} USD), size ${offer.size} in stock` : "browsable"}`);
agentSays(`"${STYLIST_SLUG}" runs a try-on service — I'll hire them to check fit first.`);
info(`kit listing: ${kitListing.id}  ·  stylist listing: ${stylistListing.id}`);

// ── PayPal rail: the human approves, the agent relays ──
if (IS_PAYPAL) {
  step(2, "Check fit first (paid try-on rail)");
  const tryOnRes = await post("/api/agent/try-on", {
    curatorSlug: MERCHANT_SLUG,
    listingId: kitListing.id,
    photoData,
  });
  const tryOnQuote = (await tryOnRes.json()).quote;
  if (tryOnQuote?.paypal) {
    agentSays(`fit check costs ${tryOnQuote.priceCusd} cUSD — or $${tryOnQuote.paypal.amountUsd} via PayPal ${tryOnQuote.paypal.env}`);
    info(`try-on PayPal order → ${tryOnQuote.paypal.orderId}`);
  } else {
    info("no paypal rail advertised on the try-on quote — continuing to the order demo");
  }

  step(3, "Request the order quote → HTTP 402");
  const size = offer?.size || "M";
  const orderBody = { listingId: kitListing.id, size, quantity: 1 };
  const res402 = await post(`/api/curator/${MERCHANT_SLUG}/order`, orderBody);
  const res402Body = await res402.json();
  const q = res402Body.quote;
  if (!q?.paypal) { say(`paypal rail not advertised (status ${res402.status}) — is PAYPAL_CLIENT_ID/SECRET configured on the API?`); process.exit(1); }
  agentSays(`HTTP 402 — the server quotes me ${q.totalCusd} cUSD, payable via: ${q.paymentRails.join(" + ")}`);
  say(`${C.y}   quote ›${C.x} ${q.quoteId} · $${q.paypal.amountUsd} via PayPal ${q.paypal.env} → order ${q.paypal.orderId}`);

  step(4, "Human approves on PayPal");
  say(`${C.y}   approve ›${C.x} ${q.paypal.approveUrl}`);
  info(`send that URL to the payer. Once approved, re-run with PAYPAL_ORDER_ID=${q.paypal.orderId} or paste the id below.`);
  const paypalOrderId = process.env.PAYPAL_ORDER_ID
    || (await new Promise((resolve) => {
      process.stdout.write(`${C.c}   paypal order id › ${C.x}`);
      process.stdin.once("data", (d) => resolve(d.toString().trim()));
    }))
    || q.paypal.orderId;
  agentSays(`relaying approval — order ${paypalOrderId}`);

  step(5, "Re-POST with payment proof → order confirmed");
  const res201 = await post(`/api/curator/${MERCHANT_SLUG}/order`, {
    ...orderBody,
    quoteId: q.quoteId,
    paypalOrderId,
  });
  const order = await res201.json();
  if (!order.success) { say(`${C.y}   response ${res201.status}: ${JSON.stringify(order)}${C.x}`); process.exit(1); }
  agentSays(`HTTP ${res201.status} — order ${order.order.id.slice(0, 8)} confirmed.`);
  say(`${C.y}   payment ›${C.x} ${order.order.payment.paymentMethod} · ${order.order.payment.explorerUrl ?? "off-chain"}`);
  say(`${C.y}   payout  ›${C.x} ${order.order.payout.status} → ${order.order.payout.to ?? "platform"} ${order.order.payout.amountNear ?? ""} ${order.order.payout.asset ?? ""}`);
  say(`${C.y}   receipt ›${C.x} ${order.order.receiptUrl}`);
  say(`\n${C.b}${C.g}loop closed:${C.x} agent paid → platform captured (curator payout reconciled) → receipt issued — one proof, zero custodial steps.\n`);
  process.exit(0);
}

// ── Fund the Intents wallet (one deposit covers both settlements) ──
let before = {};
if (IS_INTENTS) {
  const needBase = 17_500_000; // ~kit price + service fee, base units
  const internal = await intents.internalBalance(agent.accountId);
  if (internal < BigInt(needBase)) {
    step("·", "Fund the Intents wallet — deposit into the verifier's ledger");
    const wallet = BigInt(Math.round((await ftBalance(agent.accountId, FT)) * 1e6));
    const shortfall = BigInt(needBase) - internal;
    const depAmount = shortfall > wallet ? wallet : shortfall;
    if (depAmount <= 0n) {
      info(`wallet empty and ledger short ${Number(shortfall) / 1e6} USDC.e — faucet the agent or lower spend`);
    } else {
      const dep = await intents.deposit(agentFak, depAmount);
      chain(`deposited ${Number(depAmount) / 1e6} USDC.e → ${intents.VERIFIER} internal ledger`);
      chain(txLink(dep.txHash));
    }
    info(`internal balance now ${Number(await intents.internalBalance(agent.accountId)) / 1e6} USDC.e`);
  } else {
    info(`intents wallet already holds ${Number(internal) / 1e6} USDC.e`);
  }
  before.internal = await intents.internalBalance(agent.accountId);
}

const escrowBefore = await ftBalance(scopedKey.contractId, FT);
info(`escrow wallet ${scopedKey.contractId} holds ${escrowBefore} USDC.e — the bounded budget rail stays live too`);

// ── Optional swap funding: pay the kit with wNEAR via token_diff ──
// The merchant acts as its own solver — I sign {give wNEAR, get USDC.e},
// it countersigns the mirror if the rate clears ITS policy, and one
// execute_intents settles swap + payment atomically.
const SWAP_FUNDING = process.env.SWAP_FUNDING === "1";
const WNEAR_ID = "nep141:wrap.testnet";
const WNEAR_CONTRACT = "wrap.testnet";
const SWAP_RATE_USDC_PER_WNEAR = Number(process.env.SWAP_RATE_USDC_PER_WNEAR || "6");
if (SWAP_FUNDING && IS_INTENTS) {
  const WNEAR_UNIT = BigInt("1000000000000000000000000"); // 1e24
  const TARGET_WNEAR = WNEAR_UNIT * 6n;
  const wInternal = await intents.internalBalance(agent.accountId, WNEAR_ID);
  const short = TARGET_WNEAR - wInternal;
  if (short > 0n) {
    step("·", "Fund the swap leg — wrap NEAR and deposit wNEAR into the verifier");
    await agentFak.callFunctionRaw({
      contractId: WNEAR_CONTRACT, methodName: "storage_deposit",
      args: { account_id: agent.accountId }, gas: "30000000000000", deposit: "1250000000000000000000",
    }).catch(() => {});
    const state = await intents.provider.query({ request_type: "view_account", account_id: agent.accountId, finality: "final" });
    const spendable = BigInt(state.amount) - WNEAR_UNIT; // keep ~1 NEAR for gas
    const wrap = short < spendable ? short : spendable;
    if (wrap <= 0n) {
      info(`not enough NEAR to top up wNEAR — the seller solves from existing wNEAR if it can`);
    } else {
      const w = await agentFak.callFunctionRaw({
        contractId: WNEAR_CONTRACT, methodName: "near_deposit", args: {},
        gas: "30000000000000", deposit: wrap.toString(),
      });
      chain(`wrapped ${Number(wrap) / 1e24} NEAR → wNEAR (${txLink(w.transaction?.hash)})`);
      await agentFak.callFunctionRaw({
        contractId: WNEAR_CONTRACT, methodName: "storage_deposit",
        args: { account_id: intents.VERIFIER }, gas: "30000000000000", deposit: "1250000000000000000000",
      }).catch(() => {});
      const dep = await agentFak.callFunctionRaw({
        contractId: WNEAR_CONTRACT, methodName: "ft_transfer_call",
        args: { receiver_id: intents.VERIFIER, amount: wrap.toString(), msg: "" },
        gas: "100000000000000", deposit: "1",
      });
      chain(`deposited ${Number(wrap) / 1e24} wNEAR → ${intents.VERIFIER} ledger (${txLink(dep.transaction?.hash)})`);
    }
  }
  info(`agent wNEAR in verifier ledger: ${Number(await intents.internalBalance(agent.accountId, WNEAR_ID)) / 1e24}`);
}

const payees = { stylist: "curator.onpoint.testnet", merchant: "store.onpoint.testnet" };
for (const [k, id] of Object.entries(payees)) {
  // For intents, "earned" is ledger+wallet: the seller-agent auto-collects
  // each settle via ft_withdraw, so the fee may sit on the ledger OR in the
  // payee's wallet when we read — the combined delta is the truth either way.
  before[k] = IS_INTENTS
    ? { ledger: Number(await intents.internalBalance(id)) / 1e6, wallet: await ftBalance(id, FT) }
    : await ftBalance(id, FT);
}

// ── 2. HIRE: negotiate the stylist's fee, settle it via an intent ──
step(2, "HIRE the stylist — negotiate a fee, then the stylist executes my intent");
const tryOnBodyBase = { curatorSlug: STYLIST_SLUG, listingId: stylistListing.id, photoData };

let tryOnQuoteToken = null;
let tryOnNego = null;
if (IS_INTENTS) {
  tryOnNego = await negotiate({
    slug: STYLIST_SLUG, scope: "tryon", listingId: stylistListing.id,
    offers: [0.01, 0.02, 0.03],
  });
  for (const t of tryOnNego.transcript) {
    if (t.actor === "buyer") agentSays(t.usd ? `offer $${t.usd}` : t.note);
    else sellerSays(t.usd ? `asks $${t.usd}${t.note ? ` — "${String(t.note).slice(0, 110)}"` : ""}` : (t.note || "…"));
  }
  if (tryOnNego.error) { say(`try-on negotiation failed: ${tryOnNego.error}`); process.exit(1); }
  tryOnQuoteToken = tryOnNego.quoteToken;
  agentSays(`deal — signed quote token from ${tryOnNego.quoteToken.signer?.accountId ?? "the stylist"} (${tryOnNego.quoteToken.payload?.agreedCusd} USD, scope tryon)`);
}

const tryOnRes = await post("/api/agent/try-on", {
  ...tryOnBodyBase,
  ...(tryOnQuoteToken ? { quoteToken: tryOnQuoteToken } : {}),
});
const tryOnBody402 = await tryOnRes.json();
const tryOnQuote = tryOnBody402.quote;
if (!tryOnQuote) { say(`expected a 402 try-on quote, got ${tryOnRes.status}: ${JSON.stringify(tryOnBody402).slice(0, 300)}`); process.exit(1); }
payees.stylist = IS_INTENTS ? tryOnQuote.intents?.payTo : tryOnQuote.near?.accountId;
if (!payees.stylist) { say(`no NEAR payee on the try-on quote: ${JSON.stringify(tryOnQuote).slice(0, 300)}`); process.exit(1); }

let tryOnResult = null;
let tryOnStatus = 0;
if (IS_INTENTS) {
  const iq = tryOnQuote.intents;
  if (!iq) { say(`no intents rail on try-on quote — is NEAR_INTENTS_VERIFIER configured on the API?`); process.exit(1); }
  agentSays(`fit fee: ${iq.display} ${iq.symbol} → ${C.b}${iq.payTo}${C.x}. I sign + publish the intent — the stylist's own agent settles it.`);
  const fee = await publishIntent({
    path: "/api/agent/try-on",
    body: { ...tryOnBodyBase, ...(tryOnQuoteToken ? { quoteToken: tryOnQuoteToken } : {}) },
    payee: iq.payTo, amountBase: iq.amount, who: "the stylist",
  });
  if (!fee.ok) { say(`stylist intent failed: ${fee.failure}`); process.exit(1); }
  chain(`stylist ${iq.payTo} executed my signed intent — ${iq.display} ${iq.symbol} moved on the verifier`);
  chain(txLink(fee.txHash));
  tryOnResult = fee.result?.body ?? null;
  tryOnStatus = fee.result?.status ?? 200;
} else {
  const t = tryOnQuote.near?.token;
  if (!t) { say(`expected a NEAR token try-on quote, got ${JSON.stringify(tryOnQuote).slice(0, 300)}`); process.exit(1); }
  const feePay = await payEscrowed({ receiverId: payees.stylist, amountBase: t.amount });
  if (!feePay.ok) { say(`try-on payment failed on-chain: ${JSON.stringify(feePay.failure)}`); process.exit(1); }
  chain(`paid ${t.display} ${t.symbol} → ${payees.stylist} via ${scopedKey.contractId}::pay`);
  chain(txLink(feePay.txHash));
  await SLEEP(2500);
  const tryOnFinal = await post("/api/agent/try-on", {
    ...tryOnBodyBase,
    ...(tryOnQuoteToken ? { quoteToken: tryOnQuoteToken } : {}),
    nearAccountId: agent.accountId, nearTxHash: feePay.txHash,
  });
  tryOnResult = await tryOnFinal.json();
  tryOnStatus = tryOnFinal.status;
}
if (tryOnStatus !== 200 || !tryOnResult) {
  info(`try-on render returned ${tryOnStatus} — the fee is still settled on-chain (the hire is what this beat proves)`);
} else {
  const rprovider = tryOnResult.tryOn?.render?.provider || tryOnResult.provider || "render ok";
  agentSays(`stylist delivered — ${rprovider}${tryOnResult.polaroid?.webUrl ? ` · polaroid ${tryOnResult.polaroid.webUrl}` : ""}`);
}

// ── 3. NEGOTIATE the kit — multi-round, with a refusal visible ──
step(3, "NEGOTIATE the kit — lowball → refusal → counter-rounds → signed token");
const size = offer?.size || "L";
agentSays(`posted ~${offer?.priceCusd ?? "?"} USD${tryOnNego ? " — and the store can see I just paid their stylist" : ""}.`);
const kitNego = await negotiate({
  slug: MERCHANT_SLUG, scope: "order", listingId: kitListing.id, size, quantity: 1,
  offers: [8, 14, 16], // session 1 lowballs hard → a real refusal, then we come back serious
});
for (const t of kitNego.transcript ?? []) {
  if (t.actor === "buyer") agentSays(t.usd ? `offer $${t.usd}` : t.note);
  else sellerSays(t.usd ? `asks $${t.usd}${t.note ? ` — "${String(t.note).slice(0, 110)}"` : ""}` : (t.note || "…"));
}
if (kitNego.error) { say(`kit negotiation failed: ${kitNego.error}`); process.exit(1); }
const kitToken = kitNego.quoteToken;
agentSays(`deal — the seller signed {listing, size, agreed ${kitToken.payload?.agreedCusd} USD, session, expiry} with its own key.`);
info(`token signer ${kitToken.signer?.accountId} · pubkey ${kitToken.signer?.publicKey?.slice(0, 24)}… — verifiable off-chain vs the payee's on-chain key`);

// ── 4. The contract enforces the cap — over-limit calls fail on-chain ──
if (process.env.SKIP_CAP !== "1") {
  step(4, "Prove the scoped key stays bounded — one call can never drain the escrow");
  agentSays(`watch me TRY to move 30 USDC.e in one escrow call — the contract caps pay() at 25.`);
  const cap = await payEscrowed({ receiverId: payees.merchant, amountBase: 30_000_000 });
  if (cap.txHash) chain(txLink(cap.txHash));
  if (cap.ok) {
    info(`over-cap call unexpectedly landed (${cap.txHash}) — MAX_PER_TX not enforced?`);
  } else {
    chain(`rejected on-chain: ${JSON.stringify(cap.failure).slice(0, 140)}`);
    agentSays(`bounded twice: per call by the contract cap, in total by the ${escrowBefore} USDC.e escrow. That key can only ever spend what's escrowed.`);
  }
}

// ── 5. SETTLE the order — the merchant executes my signed intent ──
step(5, "SETTLE the order — buyer signs the intent, the seller executes it");
const orderBody = { listingId: kitListing.id, size, quantity: 1 };
const res402 = await post(`/api/curator/${MERCHANT_SLUG}/order`, {
  ...orderBody,
  quoteToken: kitToken, // first presentation mints the 402 at the signed price
});
const res402Body = await res402.json();
const q = res402Body.quote;
if (res402.status !== 402 || !q) { say(`expected a 402 quote, got ${res402.status}: ${JSON.stringify(res402Body).slice(0, 300)}`); process.exit(1); }
agentSays(`HTTP 402 — agreed ${q.totalCusd} USD (posted ${q.negotiation?.listCusd ?? "—"}). Rails: ${q.paymentRails.join(" + ")}`);
info(`quoteId ${q.quoteId} — the agreed price is bound in the id itself`);

let order = null;
let orderStatus = 0;
let xchainResult = null;
if (IS_INTENTS) {
  const iq = q.intents;
  if (!iq) { say(`no intents rail on the order quote — is NEAR_INTENTS_VERIFIER configured on the API?`); process.exit(1); }
  const useSwap = SWAP_FUNDING;
  let swap;
  if (useSwap) {
    // Buy the settlement token with wNEAR: give (amountUsdc / myRate)
    // wNEAR for the full amount the transfer needs. The merchant decides
    // whether to counter-sign — the swap + payment is one atomic bundle.
    // Units: amount is USDC.e base (6dp) → wNEAR base (24dp): ×1e18 / rate.
    const giveWnear = (BigInt(iq.amount) * 10n ** 18n * 1000n) / BigInt(Math.round(SWAP_RATE_USDC_PER_WNEAR * 1000));
    swap = { giveTokenId: WNEAR_ID, giveAmountBase: giveWnear.toString() };
    agentSays(`signing: {give ${(Number(giveWnear) / 1e24).toFixed(3)} wNEAR, get ${iq.display} USDC.e} + transfer → ${iq.payTo} — ANY solver can countersign my diff and take the wNEAR, or nothing settles`);
  } else {
    agentSays(`signing: transfer ${iq.amount} base of ${iq.tokenId} → ${iq.payTo}, verified by ${iq.verifier}`);
  }
  const pay = await publishIntent({
    path: `/api/curator/${MERCHANT_SLUG}/order?referral=${STYLIST_REFERRAL}`,
    body: { ...orderBody, quoteToken: kitToken },
    payee: iq.payTo, amountBase: iq.amount, who: "the merchant", swap,
  });
  if (!pay.ok) { say(`merchant intent failed: ${pay.failure}`); process.exit(1); }
  const solverWon = pay.executor && pay.executor !== iq.payTo;
  if (solverWon) {
    chain(`${pay.executor} won the solver race — it counter-signed my diff, executed the bundle, and fronted ${iq.display} ${iq.symbol} to ${iq.payTo} with its own liquidity, atomically`);
    agentSays(`a solver I never hired settled my order — solver ≠ payee, and the payee still got paid because my signed intent says so`);
  } else {
    chain(`${pay.executor ?? iq.payTo} executed the intent${useSwap ? " — its signature funded the USDC.e leg from my wNEAR, atomically" : ` — ${iq.display} ${iq.symbol} settled atomically on the verifier`}`);
  }
  chain(txLink(pay.txHash));
  order = pay.result?.body ?? null;
  orderStatus = pay.result?.status ?? 0;
  xchainResult = pay.result?.xchain ?? null;
} else {
  const t = q.near?.token;
  if (!t) { say("near token rail not advertised — is NEAR_TOKEN_* configured on the API?"); process.exit(1); }
  if (t.contractId !== scopedKey.contractId) {
    say(`scoped key is for ${scopedKey.contractId}, quote asks ${t.contractId} — run setup-scoped-key.mjs`);
    process.exit(1);
  }
  const orderPay = await payEscrowed({ receiverId: q.near.accountId, amountBase: t.amount });
  if (!orderPay.ok) { say(`order payment failed on-chain: ${JSON.stringify(orderPay.failure)}`); process.exit(1); }
  chain(`sent ${t.display} ${t.symbol} → ${q.near.accountId} (${t.contractId}::${t.method})`);
  chain(txLink(orderPay.txHash));
  await SLEEP(2500);
  const res201 = await post(`/api/curator/${MERCHANT_SLUG}/order?referral=${STYLIST_REFERRAL}`, {
    ...orderBody,
    quoteToken: kitToken, // the seller's signed commitment — quoteId alone re-floors and 409s on bundle-discounted prices
    quoteId: q.quoteId, nearAccountId: agent.accountId, nearTxHash: orderPay.txHash,
  });
  order = await res201.json();
  orderStatus = res201.status;
}
if (!order?.success) { say(`${C.y}   response ${orderStatus}: ${JSON.stringify(order ?? {}).slice(0, 400)}${C.x}`); process.exit(1); }
agentSays(`HTTP ${orderStatus} — order ${order.order.id.slice(0, 8)} confirmed at ${order.order.totalCusd} USD.`);
say(`${C.y}   payment ›${C.x} ${order.order.payment.paymentMethod} · ${order.order.payment.explorerUrl ?? "off-chain"}`);
say(`${C.y}   payout  ›${C.x} ${order.order.payout.status} → ${order.order.payout.to ?? "platform"} ${order.order.payout.amountTokenDisplay ?? order.order.payout.amountNear ?? ""} ${order.order.payout.asset ?? ""}`);
say(`${C.y}   receipt ›${C.x} ${order.order.receiptUrl}`);
if (xchainResult) {
  agentSays(`and the settlement hopped chains — the payee's earnings land on Sepolia at an address derived from its NEAR account via MPC. No Ethereum key exists anywhere.`);
  say(`${C.g}   xchain ›${C.x} ${xchainResult.explorer}`);
}
if (order.order.referralCode) {
  agentSays(`and the stylist who got me here earns too — ${order.order.referralCode} pays them 2.5% on the sale they drove (referral ledger — off-chain, unlike the on-chain settle).`);
}

// ── 6. Verify on-chain: the verifier's ledger shows who earned what ──
step(6, "Verify on-chain — two payees earned, on two different settlements");
if (IS_INTENTS) {
  await SLEEP(3000); // let the sellers' in-flight ft_withdraw receipts land —
  // the wallet credit applies a block or two after the ledger debit
  const after = {
    internal: Number(await intents.internalBalance(agent.accountId)) / 1e6,
  };
  for (const [k, id] of Object.entries(payees)) {
    after[k] = { ledger: Number(await intents.internalBalance(id)) / 1e6, wallet: await ftBalance(id, FT) };
  }
  chain(`agent    intents-ledger: ${Number(before.internal) / 1e6} → ${after.internal} USDC.e`);
  chain(`stylist  ${payees.stylist}:  +${((after.stylist.wallet - before.stylist.wallet) + (after.stylist.ledger - before.stylist.ledger)).toFixed(6)} USDC.e earned — ledger ${before.stylist.ledger} → ${after.stylist.ledger}, wallet ${before.stylist.wallet} → ${after.stylist.wallet} (its own agent withdrew)`);
  chain(`merchant ${payees.merchant}:  +${((after.merchant.wallet - before.merchant.wallet) + (after.merchant.ledger - before.merchant.ledger)).toFixed(6)} USDC.e earned — ledger ${before.merchant.ledger} → ${after.merchant.ledger}, wallet ${before.merchant.wallet} → ${after.merchant.wallet} (its own agent withdrew)`);
  if (SWAP_FUNDING) {
    const wAgent = Number(await intents.internalBalance(agent.accountId, WNEAR_ID)) / 1e24;
    const wMerchant = Number(await intents.internalBalance(payees.merchant, WNEAR_ID)) / 1e24;
    chain(`swap leg — agent wNEAR now ${wAgent}, merchant wNEAR ${wMerchant}: the payment settled as USDC.e but I funded it with wNEAR, atomically`);
  }
  info(`verifier ${intents.VERIFIER} holds the ledger — each payee collects with a signed ft_withdraw of its own`);
} else {
  const after = {
    escrow: await ftBalance(scopedKey.contractId, FT),
    stylist: await ftBalance(payees.stylist, FT),
    merchant: await ftBalance(payees.merchant, FT),
  };
  chain(`escrow:   ${escrowBefore} → ${after.escrow} USDC.e   (−${(escrowBefore - after.escrow).toFixed(6)})`);
  chain(`stylist   ${payees.stylist}:  ${before.stylist} → ${after.stylist} USDC.e   (+${(after.stylist - before.stylist).toFixed(6)} earned — the hired service)`);
  chain(`merchant  ${payees.merchant}:  ${before.merchant} → ${after.merchant} USDC.e   (+${(after.merchant - before.merchant).toFixed(6)} earned — the order)`);
}

say(`\n${C.b}${C.g}agent economy:${C.x} bargained over rounds (with a refusal) → hired a stylist the same way → published signed intents that each seller's own agent picked up and executed — two processes, disjoint keys — plus a scoped key that provably can't overspend.\n`);
