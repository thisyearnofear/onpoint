#!/usr/bin/env node
/**
 * Reference Buyer Agent — end-to-end proof that an external agent can buy
 * from an OnPoint curator storefront on Celo mainnet.
 *
 * Flow (exactly what any third-party agent would do):
 *   1. Discover  — GET  /api/curator/directory
 *   2. Browse    — GET  /api/curator/:slug/storefront (agentCommerce offers)
 *   3. Quote     — POST /api/curator/:slug/order            → HTTP 402
 *   4. Pay       — cUSD transfer to quote.payTo on Celo (own wallet)
 *   5. Confirm   — POST /api/curator/:slug/order + txHash   → HTTP 201
 *
 * The 201 response includes Celoscan links for the buyer's payment AND the
 * curator's payout — verifiable third-party on-chain activity.
 *
 * Usage:
 *   BUYER_PRIVATE_KEY=0x... node scripts/agent-buyer.mjs [--curator slug] [--dry-run]
 *
 * Env:
 *   BUYER_PRIVATE_KEY  wallet of the buying agent (needs cUSD + CELO for gas)
 *   ONPOINT_API        API base (default https://api.onpoint.famile.xyz)
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const API_BASE = (process.env.ONPOINT_API || "https://api.onpoint.famile.xyz").replace(/\/$/, "");
const DRY_RUN = process.argv.includes("--dry-run");
const curatorArgIdx = process.argv.indexOf("--curator");
const CURATOR_SLUG = curatorArgIdx > -1 ? process.argv[curatorArgIdx + 1] : null;

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

async function api(path, init) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

// ── 1. Discover ──────────────────────────────────────────────
console.log(`→ Discovering curators via ${API_BASE}/api/curator/directory`);
const directory = await api("/api/curator/directory");
if (directory.status !== 200) fail(`Directory unavailable (HTTP ${directory.status})`);

const candidates = (directory.body.curators || []).filter((c) =>
  CURATOR_SLUG ? c.slug === CURATOR_SLUG : c.agentCommerceEnabled,
);
if (candidates.length === 0) {
  fail(CURATOR_SLUG
    ? `Curator "${CURATOR_SLUG}" not found in directory`
    : "No curators with agent commerce enabled — a curator needs a payout wallet first");
}

// ── 2. Browse — first curator with a purchasable offer ───────
let curator = null;
let listing = null;
let offer = null;
let storefrontMeta = null;

for (const candidate of candidates) {
  const storefront = await api(`/api/curator/${candidate.slug}/storefront`);
  if (storefront.status !== 200) continue;

  const purchasable = (storefront.body.listings || []).find(
    (l) => l.agentCommerce?.offers?.length > 0,
  );
  if (purchasable) {
    curator = storefront.body.curator;
    listing = purchasable;
    offer = purchasable.agentCommerce.offers[0];
    storefrontMeta = storefront.body.meta.agentCommerce;
    break;
  }
}
if (!listing) fail("No purchasable listings found on any agent-enabled storefront");

console.log(`→ Selected: ${listing.kit.club} ${listing.kit.kitType} (${offer.size}) ` +
  `from ${curator.name} — ${offer.priceCusd} cUSD (KES ${offer.priceKes})`);

// ── 3. Quote — expect HTTP 402 ────────────────────────────────
const orderBody = { listingId: listing.id, size: offer.size, quantity: 1, agentId: "reference-buyer" };
const quoteRes = await api(`/api/curator/${curator.slug}/order`, {
  method: "POST",
  body: JSON.stringify(orderBody),
});
if (quoteRes.status !== 402) {
  fail(`Expected 402 payment challenge, got HTTP ${quoteRes.status}: ${JSON.stringify(quoteRes.body)}`);
}
const quote = quoteRes.body.quote;
const requirements = quoteRes.body.accepts?.[0];
console.log(`→ 402 challenge: pay ${quote.totalCusd} cUSD to ${quote.payTo} on chain ${quote.chainId}`);

if (DRY_RUN) {
  console.log("✓ Dry run complete — storefront is agent-purchasable. Set BUYER_PRIVATE_KEY and re-run to buy.");
  process.exit(0);
}

// ── 4. Pay — cUSD transfer from the buyer's own wallet ───────
const privateKey = process.env.BUYER_PRIVATE_KEY;
if (!privateKey) fail("BUYER_PRIVATE_KEY not set (use --dry-run to test without paying)");

const account = privateKeyToAccount(privateKey);
const wallet = createWalletClient({ account, chain: celo, transport: http() });
const publicClient = createPublicClient({ chain: celo, transport: http() });

const amountWei = BigInt(requirements.maxAmountRequired);
const balance = await publicClient.readContract({
  address: requirements.asset,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account.address],
});
if (balance < amountWei) {
  fail(`Insufficient cUSD: have ${balance}, need ${amountWei} (wallet ${account.address})`);
}

console.log(`→ Paying from ${account.address}…`);
const txHash = await wallet.writeContract({
  address: requirements.asset,
  abi: ERC20_ABI,
  functionName: "transfer",
  args: [quote.payTo, amountWei],
});
console.log(`→ Payment sent: https://celoscan.io/tx/${txHash} — waiting for confirmation`);
await publicClient.waitForTransactionReceipt({ hash: txHash });

// ── 5. Confirm — re-POST with payment proof ──────────────────
const confirmRes = await api(`/api/curator/${curator.slug}/order`, {
  method: "POST",
  body: JSON.stringify({ ...orderBody, paymentTxHash: txHash }),
});
if (confirmRes.status !== 201) {
  fail(`Order confirmation failed (HTTP ${confirmRes.status}): ${JSON.stringify(confirmRes.body)}`);
}

const order = confirmRes.body.order;
console.log("✓ Order confirmed");
console.log(`  Order:          ${order.id} — ${order.item}`);
console.log(`  Buyer payment:  ${order.payment.explorerUrl}`);
console.log(order.payout.txHash
  ? `  Curator payout: ${order.payout.explorerUrl} (${order.payout.amountCusd} cUSD → ${order.payout.to})`
  : `  Curator payout: pending (to ${order.payout.to})`);
if (order.receiptUrl) console.log(`  Receipt:        ${order.receiptUrl}`);
else if (order.receiptId) console.log(`  Receipt:        ${order.receiptId}`);
