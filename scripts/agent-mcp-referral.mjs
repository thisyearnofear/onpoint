#!/usr/bin/env node
/**
 * Agent-to-Agent Referral Demo — demonstrates the OnPoint agent commerce
 * referral flow on Celo via the MCP server.
 *
 * Celo Agentic Payments + DeFAI Hackathon — agent-to-agent payments track.
 *
 * Flow:
 *   AGENT A (stylist):
 *     1. browse_curator_directory → find curators
 *     2. browse_storefront → pick 2+ listings
 *     3. create_look → compose listings into a look, get referralCode
 *
 *   AGENT B (buyer):
 *     4. get_look → fetch the look Agent A created
 *     5. buy_item with referralCode → 402 → pay cUSD on Celo → confirm
 *
 *   RESULT:
 *     - Agent A's wallet earns 2.5% of the order value (auto-settled on Celo)
 *     - The curator earns 95% of the order value
 *     - The platform earns 5%
 *     - ERC-8021 attribution tags count toward hackathon leaderboard
 *
 * Usage:
 *   STYLIST_PRIVATE_KEY=0x... BUYER_PRIVATE_KEY=0x... node scripts/agent-mcp-referral.mjs [--dry-run]
 *
 * Env:
 *   STYLIST_PRIVATE_KEY  Agent A's wallet (creates the look, earns commission)
 *   BUYER_PRIVATE_KEY    Agent B's wallet (buys the item, pays cUSD)
 *   MCP_HTTP_URL         MCP server URL (default http://localhost:3001)
 *   ONPOINT_API          API base (default https://api.onpoint.famile.xyz)
 *
 * The MCP server must be running separately:
 *   MCP_HTTP_PORT=3001 pnpm --filter @repo/qwen-mcp start
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { celo } from "viem/chains";

const MCP_URL = (process.env.MCP_HTTP_URL || "http://localhost:3001").replace(/\/$/, "");
const API_BASE = (process.env.ONPOINT_API || "https://api.onpoint.famile.xyz").replace(/\/$/, "");
const DRY_RUN = process.argv.includes("--dry-run");

const CUSD_ADDRESS = "0x765DE816845861e75A25fCA122bb6898B8B1282a";
const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
]);

// ── MCP client (minimal JSON-RPC over HTTP) ────────────────────

let sessionId = null;

async function mcpFetch(body) {
  const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json, text/event-stream",
  };
  if (sessionId) headers["mcp-session-id"] = sessionId;

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  const text = await res.text();
  if (!text || text.trim() === "") {
    return {}; // notifications return no body
  }
  let data;
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    const lines = text.split("\n");
    const dataLines = lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
    data = dataLines.length > 0 ? JSON.parse(dataLines[0]) : {};
  } else {
    data = JSON.parse(text);
  }
  return data;
}

async function mcpCall(toolName, args = {}) {
  const data = await mcpFetch({
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });
  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  if (!data.result?.content?.[0]?.text) return data.result;
  const text = data.result.content[0].text;
  try { return JSON.parse(text); } catch { return text; }
}

async function mcpInitialize() {
  const data = await mcpFetch({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "onpoint-referral-demo", version: "0.1.0" },
    },
  });
  if (data.error) throw new Error(`MCP initialize error: ${JSON.stringify(data.error)}`);

  // Send initialized notification
  await mcpFetch({ jsonrpc: "2.0", method: "notifications/initialized" });
  return data.result;
}

// ── Helpers ────────────────────────────────────────────────────

function fail(msg) { console.error(`✗ ${msg}`); process.exit(1); }
function log(emoji, msg) { console.log(`${emoji} ${msg}`); }
function short(addr) { return `${addr.slice(0, 6)}…${addr.slice(-4)}`; }

// ── Main ───────────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║  OnPoint Agent-to-Agent Referral Demo — Celo Hackathon       ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝\n`);
  console.log(`MCP server: ${MCP_URL}`);
  console.log(`Mode:       ${DRY_RUN ? "DRY RUN (no payment)" : "LIVE (real cUSD)"}\n`);

  // Resolve agent wallets
  const stylistKey = process.env.STYLIST_PRIVATE_KEY;
  const buyerKey = process.env.BUYER_PRIVATE_KEY;
  let stylistAddress = null;
  let buyerAddress = null;
  if (stylistKey) {
    stylistAddress = privateKeyToAccount(stylistKey).address;
  } else if (DRY_RUN) {
    // Deterministic dummy address for dry run
    stylistAddress = "0x1234567890abcdef1234567890abcdef12345678";
  } else {
    fail("STYLIST_PRIVATE_KEY not set (use --dry-run to test without)");
  }
  if (buyerKey) {
    buyerAddress = privateKeyToAccount(buyerKey).address;
  } else if (DRY_RUN) {
    buyerAddress = "0xabcdef1234567890abcdef1234567890abcdef12";
  } else {
    fail("BUYER_PRIVATE_KEY not set (use --dry-run to test without)");
  }

  // Initialize MCP session
  log("🔌", "Initializing MCP session...");
  const init = await mcpInitialize();
  log("✓", `Connected to ${init?.serverInfo?.name || "onpoint-mcp"}\n`);

  // ══════════════════════════════════════════════════════════════
  // AGENT A — STYLIST (creates a look, earns referral commission)
  // ══════════════════════════════════════════════════════════════
  console.log("━".repeat(60));
  console.log("AGENT A — STYLIST");
  console.log(`Wallet: ${short(stylistAddress)}`);
  console.log("━".repeat(60) + "\n");

  // 1. Browse curator directory
  log("📋", "Browsing curator directory...");
  const directory = await mcpCall("browse_curator_directory", { agentPurchasable: true });
  const curators = directory?.curators || [];
  if (curators.length === 0) fail("No agent-purchasable curators found");
  log("✓", `Found ${curators.length} curators\n`);

  // 2. Browse storefront — pick first curator with 2+ purchasable listings
  let curator = null;
  let purchasableListings = [];
  for (const c of curators) {
    const sf = await mcpCall("browse_storefront", { curatorSlug: c.slug });
    const list = (sf?.listings || []).filter((l) => l.agentCommerce?.offers?.length > 0);
    if (list.length >= 2) {
      curator = c;
      purchasableListings = list;
      break;
    }
  }
  if (!curator) fail("No curator with 2+ purchasable listings found");
  log("🛍️", `Selected curator: ${curator.slug} (${purchasableListings.length} purchasable listings)`);
  purchasableListings.slice(0, 3).forEach((l) => {
    const offer = l.agentCommerce.offers[0];
    console.log(`   • ${l.title || l.kit?.club || "item"} — ${offer.priceCusd} cUSD (size ${offer.size})`);
  });
  console.log();

  // 3. Create a look from 2-3 listings
  const listingIds = purchasableListings.slice(0, 3).map((l) => l.id);
  const heroListingId = listingIds[0];
  const heroListing = purchasableListings[0];
  const heroOffer = heroListing.agentCommerce.offers[0];

  log("🎨", `Creating look from ${listingIds.length} listings...`);
  const lookResult = await mcpCall("create_look", {
    title: "Hackathon Agent Fit",
    description: "A look composed by Agent A via the OnPoint MCP server. Agent B can buy any piece and Agent A earns 2.5% referral commission on Celo.",
    listingIds,
    heroListingId,
    agentAddress: stylistAddress,
    tags: ["hackathon", "agent-commerce", "celo"],
    status: "live",
  });

  let lookSlug = null;
  let referralCode = null;
  if (lookResult?.status === "success" && lookResult.look) {
    lookSlug = lookResult.look.slug;
    log("✓", `Look created: ${lookSlug}`);
    log("🔗", `Share URL: ${lookResult.look.shareUrl || `(https://beonpoint.netlify.app/look/${lookSlug})`}`);
    // create_look response doesn't include referralCode — fetch it via get_look
    const lookDetail = await mcpCall("get_look", { slug: lookSlug });
    referralCode = lookDetail?.referralCode || `ref_${stylistAddress.slice(2, 10)}`;
    log("🏷️", `Referral code: ${referralCode}\n`);
  } else if (lookResult?.status === "error") {
    log("⚠️", `create_look returned error: ${JSON.stringify(lookResult).slice(0, 200)}`);
    // Fall back to deriving the referral code from the agent address
    referralCode = `ref_${stylistAddress.slice(2, 10)}`;
    log("ℹ️", `Using derived referral code: ${referralCode}`);
    // Try to find an existing look by this agent
    log("🔍", "Listing looks by this agent...");
    const agentLooks = await mcpCall("list_looks", { agent: stylistAddress, limit: 5 });
    const looks = agentLooks?.looks || [];
    if (looks.length > 0) {
      lookSlug = looks[0].slug;
      log("✓", `Using existing look: ${lookSlug}`);
      const detail = await mcpCall("get_look", { slug: lookSlug });
      referralCode = detail?.referralCode || referralCode;
      log("🏷️", `Referral code: ${referralCode}\n`);
    } else {
      fail("Could not create or find a look for this agent");
    }
  } else {
    log("⚠️", `Unexpected create_look response: ${JSON.stringify(lookResult).slice(0, 200)}`);
    referralCode = `ref_${stylistAddress.slice(2, 10)}`;
  }

  // ══════════════════════════════════════════════════════════════
  // AGENT B — BUYER (buys via the look's referral code)
  // ══════════════════════════════════════════════════════════════
  console.log("━".repeat(60));
  console.log("AGENT B — BUYER");
  console.log(`Wallet: ${short(buyerAddress)}`);
  console.log("━".repeat(60) + "\n");

  // 4. Get the look (Agent B discovers it)
  if (lookSlug) {
    log("🔍", `Fetching look ${lookSlug}...`);
    const look = await mcpCall("get_look", { slug: lookSlug });
    log("✓", `Look: ${look?.title || lookSlug}`);
    log("🏷️", `Referral code from look: ${look?.referralCode || referralCode}\n`);
  }

  // 5. Buy the hero item with the referral code
  log("🛒", `Buying hero item ${heroListing.id} size ${heroOffer.size} with referralCode ${referralCode}...`);
  const buyResult = await mcpCall("buy_item", {
    curatorSlug: curator.slug,
    listingId: heroListing.id,
    size: heroOffer.size,
    quantity: 1,
    referralCode,
  });

  if (buyResult?.status === "payment_required") {
    const challenge = buyResult.challenge;
    const quote = challenge?.quote || challenge;
    const payTo = quote?.payTo;
    const totalCusd = quote?.totalCusd || quote?.priceCusd;
    const dataSuffix = quote?.attribution?.dataSuffix || challenge?.x402?.attribution?.dataSuffix;
    const quoteId = quote?.quoteId || challenge?.quoteId;

    log("💰", `402 challenge: pay ${totalCusd} cUSD to ${payTo}`);
    log("🏷️", `ERC-8021 attribution: ${dataSuffix ? dataSuffix.slice(0, 20) + "..." : "(none)"}`);
    log("📝", `Quote ID: ${quoteId}\n`);

    if (DRY_RUN) {
      log("✓", "Dry run — 402 challenge received with referral code attached. Skipping payment.\n");
    } else {
      if (!buyerKey) fail("BUYER_PRIVATE_KEY not set");
      const account = privateKeyToAccount(buyerKey);
      const wallet = createWalletClient({ account, chain: celo, transport: http() });
      const publicClient = createPublicClient({ chain: celo, transport: http() });

      const amountWei = BigInt(Math.ceil(Number(totalCusd) * 1e18));
      log("💸", `Paying ${totalCusd} cUSD from ${short(account.address)}...`);

      const txData = dataSuffix
        ? encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [payTo, amountWei] }) + dataSuffix.replace(/^0x/, "")
        : undefined;
      const txHash = await wallet.sendTransaction({ to: CUSD_ADDRESS, data: txData });
      log("⏳", `TX sent: ${txHash} — waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      log("✓", `Payment confirmed: https://celoscan.io/tx/${txHash}\n`);

      // Confirm the order
      log("🛒", "Confirming order with paymentTxHash...");
      const buyResult2 = await mcpCall("buy_item", {
        curatorSlug: curator.slug,
        listingId: heroListing.id,
        size: heroOffer.size,
        quantity: 1,
        paymentTxHash: txHash,
        quoteId,
        referralCode,
      });

      if (buyResult2?.status === "success") {
        const order = buyResult2.result?.order || buyResult2.result;
        log("✓", "Order confirmed!\n");
        if (order?.id) log("📦", `Order: ${order.id}`);
        if (order?.payment?.explorerUrl) log("💸", `Buyer payment: ${order.payment.explorerUrl}`);
        if (order?.payout?.explorerUrl) log("🏦", `Curator payout: ${order.payout.explorerUrl}`);
        if (order?.receiptUrl) log("🧾", `Receipt: ${order.receiptUrl}`);
        console.log();
      } else {
        console.error("Order confirmation response:", JSON.stringify(buyResult2, null, 2));
      }
    }
  } else if (buyResult?.status === "success") {
    log("✓", "Order succeeded\n");
  } else {
    console.error("Unexpected buy response:", JSON.stringify(buyResult, null, 2));
  }

  // ══════════════════════════════════════════════════════════════
  // RESULT — referral commission economics
  // ══════════════════════════════════════════════════════════════
  console.log("━".repeat(60));
  console.log("REFERRAL COMMISSION ECONOMICS");
  console.log("━".repeat(60) + "\n");

  const orderValue = Number(heroOffer.priceCusd);
  const commission = orderValue * 0.025;
  const curatorShare = orderValue * 0.95;
  const platformShare = orderValue * 0.05;

  log("💵", `Order value:    ${orderValue.toFixed(2)} cUSD`);
  log("🏦", `Curator (95%):  ${curatorShare.toFixed(2)} cUSD → ${curator.slug}`);
  log("⚙️", `Platform (5%):  ${platformShare.toFixed(2)} cUSD`);
  log("🤝", `Agent A (2.5%): ${commission.toFixed(2)} cUSD → ${short(stylistAddress)}`);
  console.log();
  log("ℹ️", "Agent A's 2.5% commission is auto-settled on Celo every 30 minutes by the payout worker.");
  log("ℹ️", "This is the agent-to-agent payment flow: Agent A creates value (a look), Agent B acts on it (a purchase), and Agent A earns on-chain.");
  log("ℹ️", `View Agent A's earnings: https://beonpoint.netlify.app/agent or GET ${API_BASE}/api/agent/dashboard\n`);

  console.log("✓ Agent-to-agent referral demo complete.\n");
}

main().catch((err) => {
  console.error(`\n✗ Fatal error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
