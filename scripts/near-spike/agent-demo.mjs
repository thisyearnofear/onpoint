/**
 * OnPoint × NEAR — agent commerce, end to end.
 *
 * A narrated walkthrough of the demo story:
 *   an agent discovers a payable offer, checks fit, pays the curator
 *   DIRECTLY in NEAR, and gets a receipt — all on-chain.
 *
 * Run:
 *   node provision.mjs      # once — creates + funds the testnet accounts
 *   node agent-demo.mjs     # the story below
 *
 * Knobs:
 *   API_URL     default http://localhost:48751 (also works against prod)
 *   LISTING_ID  default reads the first offer from the onpoint-store storefront
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
const RPC = "https://rpc.testnet.near.org";
const SLEEP = (ms) => new Promise((r) => setTimeout(r, ms));

// ── tiny presentation kit ──
const C = { dim: "\x1b[2m", b: "\x1b[1m", g: "\x1b[32m", c: "\x1b[36m", y: "\x1b[33m", m: "\x1b[35m", x: "\x1b[0m" };
const say = (s) => console.log(s);
const step = (n, t) => say(`\n${C.b}${C.m}── STEP ${n} ── ${t}${C.x}`);
const agentSays = (s) => say(`${C.c}   agent ›${C.x} ${s}`);
const chain = (s) => say(`${C.g}   chain ›${C.x} ${s}`);
const info = (s) => say(`${C.dim}   ${s}${C.x}`);

// RAIL=near (default, wallet-funded) | paypal (human approves, agent relays)
const RAIL = (process.env.RAIL || "near").toLowerCase();
const IS_PAYPAL = RAIL === "paypal";

let creds = null;
let provider = null;
let nearBalance = async () => null;
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
}
const post = async (path, body) =>
  (await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }));

say(`${C.b}OnPoint × ${IS_PAYPAL ? "PayPal" : "NEAR"} — agentic fashion commerce${C.x}`);
info(`api: ${API}  ·  rail: ${RAIL}${IS_PAYPAL ? "" : `  ·  network: ${creds.network}  ·  agent: ${creds.accounts.agent.accountId}`}`);
agentSays("I have a job: buy a football kit for my human. Let's see what's for sale.");

// ── 1. Discover the offer ──
step(1, "Discover a payable offer");
const storefront = await (await fetch(`${API}/api/curator/onpoint-store/storefront`)).json();
const listing = storefront.listings?.[0];
if (!listing) { say("no listings on onpoint-store storefront"); process.exit(1); }
const offer = listing.agentCommerce?.offers?.find((o) => o.stock > 0) || listing.agentCommerce?.offers?.[0];
agentSays(`found "${listing.title || listing.kit?.club + ' kit'}" — ${offer ? `${offer.priceKes} KES, ${offer.stock} in stock (size ${offer.size})` : "browsable"}`);
info(`storefront: ${API}/api/curator/onpoint-store/storefront`);
const LISTING_ID = process.env.LISTING_ID || listing.id;

// ── 2. Optional fit check (the paid try-on rail) ──
step(2, "Check fit first (paid try-on rail)");
const tryOnRes = await post("/api/agent/try-on", {
  curatorSlug: "onpoint-store",
  listingId: LISTING_ID,
  photoData:
    "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQBAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhADEAAAAT8n/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AqA//2Q==",
});
const tryOnQuote = (await tryOnRes.json()).quote;
const tryOnRail = IS_PAYPAL ? tryOnQuote.paypal : tryOnQuote.near;
if (tryOnRail) {
  agentSays(
    IS_PAYPAL
      ? `fit check costs ${tryOnQuote.priceCusd} cUSD — or $${tryOnRail.amountUsd} via PayPal ${tryOnRail.env}`
      : `fit check costs ${tryOnQuote.priceCusd} cUSD — or ${tryOnRail.amountNear} NEAR on the ${tryOnRail.network} rail`,
  );
  info(IS_PAYPAL
    ? `try-on PayPal order → ${tryOnRail.orderId}`
    : `try-on NEAR quote → ${tryOnRail.accountId} · ${tryOnRail.amountYocto} yocto`);
} else {
  info(`no ${RAIL} rail advertised on the try-on quote — continuing to the order demo`);
}

// ── 3. Request the order quote ──
step(3, "Request the order quote → HTTP 402");
const size = offer?.size || "M";
const res402 = await post(`/api/curator/onpoint-store/order`, {
  listingId: LISTING_ID, size, quantity: 1,
});
const res402Body = await res402.json();
const q = res402Body.quote;
if (!q) { say(`expected a 402 quote, got: ${JSON.stringify(res402Body)}`); process.exit(1); }
agentSays(`HTTP ${res402.status} — the server quotes me ${q.totalCusd} cUSD, payable via: ${q.paymentRails.join(" + ")}`);
if (IS_PAYPAL && !q.paypal) { say("paypal rail not advertised — is PAYPAL_CLIENT_ID/SECRET configured on the API?"); process.exit(1); }
if (!IS_PAYPAL && !q.near) { say("near rail not advertised — is NEAR_USD_PRICE + a payout account configured?"); process.exit(1); }
say(`${C.y}   quote ›${C.x} ${q.quoteId} · ${IS_PAYPAL
  ? `$${q.paypal.amountUsd} via PayPal ${q.paypal.env} → order ${q.paypal.orderId}`
  : `${q.near.amountNear} NEAR → ${q.near.accountId} (${q.near.payoutModel})`}`);

// ── 4. Pay on the chosen rail ──
let proofBody;
let before = null;
let agent = null;
if (IS_PAYPAL) {
  step(4, "Human approves on PayPal");
  say(`${C.y}   approve ›${C.x} ${q.paypal.approveUrl}`);
  info(`send that URL to the payer. Once approved, re-run with PAYPAL_ORDER_ID=${q.paypal.orderId} or paste the id below.`);
  const paypalOrderId = process.env.PAYPAL_ORDER_ID
    || (await new Promise((resolve) => {
      process.stdout.write(`${C.c}   paypal order id › ${C.x}`);
      process.stdin.once("data", (d) => resolve(d.toString().trim()));
    }))
    || q.paypal.orderId;
  proofBody = { paypalOrderId };
  agentSays(`relaying approval — order ${paypalOrderId}`);
} else {
  step(4, "Pay on NEAR testnet");
  agent = creds.accounts.agent;
  before = { agent: await nearBalance(agent.accountId), store: await nearBalance(q.near.accountId) };
  info(`balances before — agent ${before.agent} Ⓝ · curator ${before.store} Ⓝ`);
  const signer = new Account(agent.accountId, provider, KeyPairSigner.fromSecretKey(agent.secretKey));
  const payOut = await signer.transfer({ receiverId: q.near.accountId, amount: q.near.amountYocto });
  const txHash = payOut.transaction?.hash ?? payOut.transaction_outcome?.id;
  chain(`sent ${q.near.amountNear} NEAR → ${q.near.accountId}`);
  chain(`https://testnet.nearblocks.io/txns/${txHash}`);
  await SLEEP(2500);
  proofBody = { nearAccountId: agent.accountId, nearTxHash: txHash };
}

// ── 5. Re-POST with proof → order confirmed ──
step(5, "Re-POST with payment proof → order confirmed");
const res201 = await post(`/api/curator/onpoint-store/order`, {
  listingId: LISTING_ID, size, quantity: 1, quoteId: q.quoteId,
  ...proofBody,
});
const order = await res201.json();
if (!order.success) { say(`${C.y}   response ${res201.status}: ${JSON.stringify(order)}${C.x}`); process.exit(1); }
agentSays(`HTTP ${res201.status} — order ${order.order.id.slice(0, 8)} confirmed. ${order.order.payout.status === "settled" ? "The curator already has my NEAR." : ""}`);
say(`${C.y}   payment ›${C.x} ${order.order.payment.paymentMethod} · ${order.order.payment.explorerUrl ?? "off-chain"}`);
say(`${C.y}   payout  ›${C.x} ${order.order.payout.status} → ${order.order.payout.to ?? "platform"} ${order.order.payout.amountNear ?? order.order.payout.asset ?? ""}`);
say(`${C.y}   receipt ›${C.x} ${order.order.receiptUrl}`);

// ── 6. On-chain after state ──
if (!IS_PAYPAL) {
  step(6, "Verify on-chain");
  const after = { agent: await nearBalance(agent.accountId), store: await nearBalance(q.near.accountId) };
  chain(`agent:   ${before.agent} Ⓝ  →  ${after.agent} Ⓝ`);
  chain(`curator: ${before.store} Ⓝ  →  ${after.store} Ⓝ   (+${(after.store - before.store).toFixed(4)} Ⓝ direct)`);
}

say(`\n${C.b}${C.g}loop closed:${C.x} agent paid → ${IS_PAYPAL ? "platform captured (curator payout reconciled)" : "curator settled"} → receipt issued — one proof, zero custodial steps.\n`);
