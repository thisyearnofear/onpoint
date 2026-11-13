/**
 * OnPoint × NEAR — the agent economy, end to end.
 *
 * A narrated walkthrough of the demo story:
 *   a buying agent NEGOTIATES a price, HIRES a styling service, and SETTLES
 *   two different NEAR accounts in stablecoin — with a function-call key
 *   that can only spend what's escrowed, to allow-listed payees, capped
 *   per call. The service provider visibly EARNS its fee on-chain.
 *
 *     try-on fee  → curator.onpoint.testnet   (the hired "stylist")
 *     kit order   → store.onpoint.testnet     (the merchant)
 *
 * Both payments run through escrow.onpoint.testnet::pay, the only method
 * the agent's key is scoped to — spend authority is enforced by consensus.
 *
 * Run:
 *   node provision.mjs            # once — creates + funds the testnet accounts
 *   node deploy-payforwarder.mjs  # once — deploys the escrow forwarder
 *   node setup-scoped-key.mjs     # once — FCAK scoped to escrow::pay + USDC.e escrow
 *   node agent-demo.mjs           # the story below
 *
 * Knobs:
 *   API_URL     default http://localhost:48751 (also works against prod)
 *   RAIL        near (default — the scoped-key story below) | paypal
 *               (human approves on PayPal, agent relays — the PayPal
 *               hackathon demo; needs no NEAR credentials)
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

const API = process.env.API_URL || "http://localhost:48751";
const CREDS_PATH = join(dirname(fileURLToPath(import.meta.url)), "near-credentials.testnet.json");
const PHOTO_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../videos/youcam-demo/assets/person-src.jpg",
);
const photoData = existsSync(PHOTO_PATH)
  ? `data:image/jpeg;base64,${readFileSync(PHOTO_PATH).toString("base64")}`
  : "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAT8n/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqA//2Q==";
const RPC = "https://rpc.testnet.near.org";
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

// The merchant (kit order) and the hired stylist (try-on service).
const MERCHANT_SLUG = "onpoint-store";
const STYLIST_SLUG = "mo";
const LOWBALL_USD = 17; // posted ≈19.23 — below the 0.9 floor, so we get countered

// ── tiny presentation kit ──
const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const step = (n, t) => say(`\n${C.b}${C.m}── STEP ${n} ── ${t}${C.x}`);
const agentSays = (s) => say(`${C.c}   agent ›${C.x} ${s}`);
const merchantSays = (s) => say(`${C.y}   store ›${C.x} ${s}`);
const chain = (s) => say(`${C.g}   chain ›${C.x} ${s}`);
const info = (s) => say(`${C.dim}   ${s}${C.x}`);

// RAIL=near (default — scoped-key stablecoin story) | paypal (human approval)
const RAIL = (process.env.RAIL || "near").toLowerCase();
const IS_PAYPAL = RAIL === "paypal";

let creds = null;
let provider = null;
let agent = null;
let scopedKey = null;
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
  provider = new JsonRpcProvider({ url: RPC });
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
  agentSigner = new Account(agent.accountId, provider, KeyPairSigner.fromSecretKey(scopedKey.secretKey));
}

const post = async (path, body) =>
  (await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

// Pay a NEAR payee in stablecoin through the escrow forwarder — the ONLY
// thing the scoped key can do. Returns { ok, txHash, failure }.
async function payEscrowed({ receiverId, amountBase, symbol = "USDC.e" }) {
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
    // contract panics surface as a thrown ContractExecutionError carrying the result
    const res = err?.transactionResult;
    const receiptFail = (res?.receipts_outcome ?? []).find((r) => r?.outcome?.status?.Failure)?.outcome?.status?.Failure;
    return {
      ok: false,
      txHash: res?.transaction?.hash ?? res?.transaction_outcome?.id,
      failure: receiptFail ?? res?.status?.Failure ?? String(err?.message ?? err).slice(0, 300),
    };
  }
}

say(`${C.b}OnPoint × ${IS_PAYPAL ? "PayPal" : "NEAR"} — ${IS_PAYPAL ? "agentic fashion commerce" : "an agent that negotiates, hires, and settles"}${C.x}`);
info(`api: ${API}  ·  rail: ${RAIL}${IS_PAYPAL ? "" : `  ·  network: ${creds.network}  ·  agent: ${agent.accountId}`}`);
if (!IS_PAYPAL) info(`scoped key: ${scopedKey.publicKey} → ${scopedKey.contractId}::pay only`);
agentSays(IS_PAYPAL
  ? "I have a job: buy a football kit for my human. Let's see what's for sale."
  : "My human wants the NEAR FC kit for the match. Plan: hire a stylist to check fit, haggle on price, pay for both in stablecoin.");

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
// (The NEAR story continues below — this branch exits early.)
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

// snapshot balances lazily per payee so the "earn" beat has a before/after
const before = { escrow: await ftBalance(scopedKey.contractId, FT) };
const payees = { stylist: null, merchant: null };
info(`escrow wallet ${scopedKey.contractId} holds ${before.escrow} USDC.e — that is my whole spendable budget`);

// ── 2. HIRE: pay the stylist's try-on fee → curator.onpoint.testnet ──
step(2, "HIRE the stylist — pay-per-use, agent to agent");
const tryOnRes = await post("/api/agent/try-on", {
  curatorSlug: STYLIST_SLUG,
  listingId: stylistListing.id,
  photoData,
});
const tryOnBody402 = await tryOnRes.json();
const tryOnQuote = tryOnBody402.quote;
const tryOnNear = tryOnQuote?.near;
if (!tryOnNear?.token) { say(`expected a NEAR token try-on quote, got ${tryOnRes.status}: ${JSON.stringify(tryOnBody402)}`); process.exit(1); }
payees.stylist = tryOnNear.accountId;
before.stylist = await ftBalance(payees.stylist, FT);
agentSays(`fit check costs $${tryOnQuote.priceCusd} — payee is ${C.b}${payees.stylist}${C.x} (the stylist's own account)`);
const feePay = await payEscrowed({ receiverId: payees.stylist, amountBase: tryOnNear.token.amount });
if (!feePay.ok) { say(`try-on payment failed on-chain: ${JSON.stringify(feePay.failure)}`); process.exit(1); }
chain(`paid ${tryOnNear.token.display} ${tryOnNear.token.symbol} → ${payees.stylist} via ${scopedKey.contractId}::pay`);
chain(`https://testnet.nearblocks.io/txns/${feePay.txHash}`);
await SLEEP(2500);

const tryOnBody = {
  curatorSlug: STYLIST_SLUG,
  listingId: stylistListing.id,
  photoData,
  nearAccountId: agent.accountId,
  nearTxHash: feePay.txHash,
};
const tryOnFinal = await post("/api/agent/try-on", tryOnBody);
const tryOnResult = await tryOnFinal.json();
if (tryOnFinal.status !== 200) {
  info(`try-on render returned ${tryOnFinal.status} — the fee is still settled on-chain (the hire is what this beat proves)`);
} else {
  const provider = tryOnResult.tryOn?.render?.provider || tryOnResult.provider || "render ok";
  agentSays(`stylist delivered — ${provider}${tryOnResult.polaroid?.webUrl ? ` · polaroid ${tryOnResult.polaroid.webUrl}` : ""}`);
}

// ── 3. NEGOTIATE: lowball the merchant → machine-readable counter-offer ──
step(3, "NEGOTIATE the kit price — offer, counter, accept");
const size = offer?.size || "M";
const orderBody = { listingId: kitListing.id, size, quantity: 1 };
agentSays(`posted price is ~${offer?.priceCusd ?? "?"} USD. I'm offering ${LOWBALL_USD}.`);
const resOffer = await post(`/api/curator/${MERCHANT_SLUG}/order`, { ...orderBody, offerUsd: LOWBALL_USD });

const offerResult = await resOffer.json();
if (resOffer.status !== 409 || offerResult.code !== "OFFER_BELOW_FLOOR") {
  say(`expected a 409 counter-offer, got ${resOffer.status}: ${JSON.stringify(offerResult)}`);
  process.exit(1);
}
merchantSays(`too low — counter-offer: ${C.b}${offerResult.counterOffer.offerUsd} USD${C.x} (their floor, machine-readable)`);
info(`counter: ${JSON.stringify(offerResult.counterOffer)}`);

agentSays(`accepted at ${offerResult.counterOffer.offerUsd} — requesting the payment quote.`);
const res402 = await post(`/api/curator/${MERCHANT_SLUG}/order`, {
  ...orderBody,
  offerUsd: offerResult.counterOffer.offerUsd,
});
const res402Body = await res402.json();
const q = res402Body.quote;
if (res402.status !== 402 || !q) { say(`expected a 402 quote, got ${res402.status}: ${JSON.stringify(res402Body)}`); process.exit(1); }
agentSays(`HTTP 402 — agreed ${q.totalCusd} USD (was ${q.negotiation?.listCusd}). Rails: ${q.paymentRails.join(" + ")}`);
if (!q.near?.token) { say("near token rail not advertised — is NEAR_TOKEN_* configured on the API?"); process.exit(1); }
say(`${C.y}   quote ›${C.x} ${q.quoteId} · ${q.near.token.display} ${q.near.token.symbol} → ${q.near.accountId} via ${q.near.token.contractId}::${q.near.token.method}`);

// ── 4. The contract enforces the cap — over-limit calls fail on-chain ──
if (process.env.SKIP_CAP !== "1") {
  step(4, "Prove the key is bounded — one call can never drain the escrow");
  const overCap = 30_000_000; // 30 USDC.e > MAX_PER_TX (25)
  agentSays(`watch me TRY to move ${overCap / 1e6} USDC.e in one call — the contract caps ${q.near.token.method} at 25.`);
  const cap = await payEscrowed({ receiverId: q.near.accountId, amountBase: overCap });
  if (cap.txHash) chain(`https://testnet.nearblocks.io/txns/${cap.txHash}`);
  if (cap.ok) {
    info(`over-cap call unexpectedly landed (${cap.txHash}) — MAX_PER_TX not enforced?`);
  } else {
    chain(`rejected on-chain: ${JSON.stringify(cap.failure).slice(0, 140)}`);
    agentSays(`bounded twice: per call by the contract cap, in total by the ${before.escrow} USDC.e escrow. That's the whole point of the key.`);
  }
}

// ── 5. SETTLE: pay the agreed amount → store.onpoint.testnet ──
step(5, "SETTLE the order — pay the merchant's own account");
const t = q.near.token;
if (t.contractId !== scopedKey.contractId) {
  say(`scoped key is for ${scopedKey.contractId}, quote asks ${t.contractId} — run setup-scoped-key.mjs`);
  process.exit(1);
}
payees.merchant = q.near.accountId;
before.merchant = await ftBalance(payees.merchant, FT);
const orderPay = await payEscrowed({ receiverId: payees.merchant, amountBase: t.amount });
if (!orderPay.ok) { say(`order payment failed on-chain: ${JSON.stringify(orderPay.failure)}`); process.exit(1); }
chain(`sent ${t.display} ${t.symbol} → ${payees.merchant} (${t.contractId}::${t.method})`);
chain(`https://testnet.nearblocks.io/txns/${orderPay.txHash}`);
await SLEEP(2500);

const res201 = await post(`/api/curator/${MERCHANT_SLUG}/order`, {
  ...orderBody,
  quoteId: q.quoteId, // binds the negotiated price — no need to repeat offerUsd
  nearAccountId: agent.accountId,
  nearTxHash: orderPay.txHash,
});
const order = await res201.json();
if (!order.success) { say(`${C.y}   response ${res201.status}: ${JSON.stringify(order)}${C.x}`); process.exit(1); }
agentSays(`HTTP ${res201.status} — order ${order.order.id.slice(0, 8)} confirmed at ${order.order.totalCusd} USD. ${order.order.payout.status === "settled" ? "The merchant already has the stablecoin." : ""}`);
say(`${C.y}   payment ›${C.x} ${order.order.payment.paymentMethod} · ${order.order.payment.explorerUrl ?? "off-chain"}`);
say(`${C.y}   payout  ›${C.x} ${order.order.payout.status} → ${order.order.payout.to ?? "platform"} ${order.order.payout.amountTokenDisplay ?? order.order.payout.amountNear ?? ""} ${order.order.payout.asset ?? ""}`);
say(`${C.y}   receipt ›${C.x} ${order.order.receiptUrl}`);

// ── 6. Verify on-chain: two payees, two roles, one scoped key ──
step(6, "Verify on-chain — two payees got paid, the provider EARNED");
const after = {
  escrow: await ftBalance(scopedKey.contractId, FT),
  stylist: await ftBalance(payees.stylist, FT),
  merchant: await ftBalance(payees.merchant, FT),
};
chain(`escrow:   ${before.escrow} → ${after.escrow} USDC.e   (−${(before.escrow - after.escrow).toFixed(6)})`);
chain(`stylist   ${payees.stylist}:  ${before.stylist} → ${after.stylist} USDC.e   (+${(after.stylist - before.stylist).toFixed(6)} earned — the hired service)`);
chain(`merchant  ${payees.merchant}:  ${before.merchant} → ${after.merchant} USDC.e   (+${(after.merchant - before.merchant).toFixed(6)} earned — the order)`);

say(`\n${C.b}${C.g}agent economy:${C.x} negotiated → hired → settled programmatically — two NEAR payees, one key that can only spend what's escrowed, to allow-listed payees, capped per call.\n`);
