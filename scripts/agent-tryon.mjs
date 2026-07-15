#!/usr/bin/env node
/**
 * Reference Try-On Agent — executes a real paid try-on on Celo mainnet.
 *
 * Flow:
 *   1. POST /api/agent/try-on {curatorSlug, listingId, photoData}  → 402
 *   2. Transfer cUSD fee to payTo (with attribution dataSuffix)
 *   3. Re-POST with paymentTxHash                                    → 200 + render
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node scripts/agent-tryon.mjs [--curator nia] [--listing <id>]
 *
 * Env:
 *   AGENT_PRIVATE_KEY  wallet paying the try-on fee (needs cUSD + CELO for gas)
 *   ONPOINT_API        API base (default https://api.onpoint.famile.xyz)
 */

import { createWalletClient, createPublicClient, http, parseAbi, encodeFunctionData } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";
import fs from "fs";
import path from "path";

const API_BASE = (process.env.ONPOINT_API || "https://api.onpoint.famile.xyz").replace(/\/$/, "");
const PRIVATE_KEY = process.env.AGENT_PRIVATE_KEY;

if (!PRIVATE_KEY || !/^0x[0-9a-fA-F]{64}$/.test(PRIVATE_KEY)) {
  console.error("✗ AGENT_PRIVATE_KEY not set or invalid (need 0x + 64 hex chars)");
  process.exit(1);
}

const curatorArgIdx = process.argv.indexOf("--curator");
const CURATOR_SLUG = curatorArgIdx > -1 ? process.argv[curatorArgIdx + 1] : "nia";
const listingArgIdx = process.argv.indexOf("--listing");
const LISTING_ID = listingArgIdx > -1 ? process.argv[listingArgIdx + 1] : null;
const lookArgIdx = process.argv.indexOf("--look");
const LOOK_SLUG = lookArgIdx > -1 ? process.argv[lookArgIdx + 1] : null;

const account = privateKeyToAccount(PRIVATE_KEY);
const walletClient = createWalletClient({ account, chain: celo, transport: http() });
const publicClient = createPublicClient({ chain: celo, transport: http() });

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

async function api(p, init) {
  const res = await fetch(`${API_BASE}${p}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

// ── 0. Load a person photo ─────────────────────────────────────
const photoPath = path.resolve(import.meta.dirname, "../apps/web/public/assets/4Model.jpg");
if (!fs.existsSync(photoPath)) fail(`Person photo not found: ${photoPath}`);
const photoBuffer = fs.readFileSync(photoPath);
const photoData = `data:image/jpeg;base64,${photoBuffer.toString("base64")}`;
console.log(`→ Loaded person photo (${(photoBuffer.length / 1024).toFixed(0)} KB)`);

// ── 1. Browse storefront to find a listing ─────────────────────
let listingId = LISTING_ID;
if (!listingId) {
  console.log(`→ Browsing ${CURATOR_SLUG} storefront...`);
  const sf = await api(`/api/curator/${CURATOR_SLUG}/storefront`);
  if (sf.status !== 200) fail(`Storefront unavailable (HTTP ${sf.status})`);
  const listings = sf.body.listings || [];
  if (listings.length === 0) fail("No listings found");
  listingId = listings[0].id;
  console.log(`  Selected listing: ${listingId} — ${listings[0].title || listings[0].name || "?"}`);
}

// ── 2. Request try-on → expect 402 ─────────────────────────────
console.log(`\n→ Requesting try-on for ${CURATOR_SLUG}/${listingId}${LOOK_SLUG ? ` (look: ${LOOK_SLUG})` : ""}...`);
const tryOnBody = { curatorSlug: CURATOR_SLUG, listingId, photoData };
if (LOOK_SLUG) tryOnBody.lookSlug = LOOK_SLUG;
const tryOnRes = await api("/api/agent/try-on", {
  method: "POST",
  body: JSON.stringify(tryOnBody),
});

if (tryOnRes.status !== 402) {
  fail(`Expected 402, got ${tryOnRes.status}: ${JSON.stringify(tryOnRes.body).slice(0, 200)}`);
}

const quote = tryOnRes.body.quote;
const accepts = tryOnRes.body.accepts?.[0] || tryOnRes.body.x402?.accepts?.[0];
const payTo = quote?.payTo || accepts?.payTo;
const priceCusd = quote?.priceCusd || accepts?.priceCusd;
const dataSuffix = quote?.attribution?.dataSuffix;

console.log(`  402 challenge: pay ${priceCusd} cUSD to ${payTo}`);
console.log(`  Attribution dataSuffix: ${dataSuffix || "(none)"}`);

if (!payTo || !priceCusd) fail("Missing payTo or priceCusd in 402 response");

// ── 3. Check cUSD balance ──────────────────────────────────────
const balanceWei = await publicClient.readContract({
  address: CUSD_ADDRESS,
  abi: ERC20_ABI,
  functionName: "balanceOf",
  args: [account.address],
});
const balanceCusd = Number(balanceWei) / 1e18;
console.log(`  Wallet cUSD balance: ${balanceCusd.toFixed(4)}`);

const needed = Number(priceCusd);
if (balanceCusd < needed) {
  fail(`Insufficient cUSD: need ${needed}, have ${balanceCusd.toFixed(4)}`);
}

// ── 4. Transfer cUSD with attribution dataSuffix ───────────────
const amountWei = BigInt(Math.ceil(needed * 1e18));
console.log(`\n→ Transferring ${needed} cUSD (${amountWei} wei) to ${payTo}...`);

const txData = dataSuffix
  ? encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "transfer",
      args: [payTo, amountWei],
    }) + dataSuffix.replace(/^0x/, "")
  : undefined;

const txHash = await walletClient.sendTransaction({
  to: CUSD_ADDRESS,
  data: txData,
});

console.log(`  TX sent: ${txHash}`);

// Wait for confirmation
console.log(`  Waiting for confirmation...`);
const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
console.log(`  Confirmed in block ${receipt.blockNumber}, status: ${receipt.status}`);

// ── 5. Re-POST with paymentTxHash → expect 200 ─────────────────
console.log(`\n→ Re-posting try-on with paymentTxHash...`);
const confirmBody = { curatorSlug: CURATOR_SLUG, listingId, photoData, paymentTxHash: txHash };
if (LOOK_SLUG) confirmBody.lookSlug = LOOK_SLUG;
const result = await api("/api/agent/try-on", {
  method: "POST",
  body: JSON.stringify(confirmBody),
});

if (result.status === 200) {
  console.log(`\n✓ Try-on succeeded!`);
  console.log(`  Fit signal: ${JSON.stringify(result.body.fitSignal || result.body.fit || "n/a")}`);
  console.log(`  Render URL: ${result.body.imageUrl || result.body.renderUrl || "n/a"}`);
  console.log(`  Polaroid: ${JSON.stringify(result.body.polaroid || "n/a")}`);
  console.log(`  Receipt: ${result.body.receiptId || result.body.receiptUrl || "n/a"}`);
  if (result.body.shareCard) {
    console.log(`  Share card: ${result.body.shareCard.imageUrl || "n/a"}`);
  }
  console.log(`\n  Payment TX: https://celoscan.io/tx/${txHash}`);
} else {
  console.error(`\n✗ Try-on failed (HTTP ${result.status})`);
  console.error(JSON.stringify(result.body, null, 2).slice(0, 500));
  console.error(`\n  Payment TX: https://celoscan.io/tx/${txHash}`);
  process.exit(1);
}
