#!/usr/bin/env node
/**
 * Reference MCP Agent — drives real on-chain transactions on Celo via the
 * OnPoint MCP server. Built for the Celo Agentic Payments + DeFAI Hackathon.
 *
 * This script demonstrates the full agent commerce loop through MCP tools:
 *   1. browse_curator_directory → find agent-purchasable curators
 *   2. browse_storefront → select a listing with agent commerce offers
 *   3. try_on → x402 challenge → pay cUSD on Celo → get try-on render
 *   4. buy_item → x402 challenge → pay cUSD on Celo → confirm order
 *
 * Every transaction carries the ERC-8021 attribution dataSuffix for
 * hackathon leaderboard credit.
 *
 * Usage:
 *   AGENT_PRIVATE_KEY=0x... node scripts/agent-mcp-buyer.mjs [--dry-run]
 *
 * Env:
 *   AGENT_PRIVATE_KEY  wallet of the buying agent (needs cUSD + CELO for gas)
 *   ONPOINT_API        API base (default https://api.onpoint.famile.xyz)
 *   MCP_HTTP_URL       MCP server HTTP URL (default http://localhost:3001)
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
import fs from "fs";
import path from "path";

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

async function mcpCall(toolName, args = {}) {
  const body = {
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 1e9),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

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

  // Capture session ID from initialize or subsequent responses
  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  const text = await res.text();
  // MCP Streamable HTTP may return SSE (text/event-stream) or plain JSON
  let data;
  if (!text || text.trim() === "") {
    return {}; // notifications return no body
  }
  if (res.headers.get("content-type")?.includes("text/event-stream")) {
    // Parse SSE: lines starting with "data: "
    const lines = text.split("\n");
    const dataLines = lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
    data = dataLines.length > 0 ? JSON.parse(dataLines[0]) : {};
  } else {
    data = JSON.parse(text);
  }

  if (data.error) throw new Error(`MCP error: ${JSON.stringify(data.error)}`);
  if (!data.result?.content?.[0]?.text) return data.result;
  const resultText = data.result.content[0].text;
  try {
    return JSON.parse(resultText);
  } catch {
    return resultText;
  }
}

async function mcpInitialize() {
  const body = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "onpoint-mcp-buyer", version: "0.1.0" },
    },
  };

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
    },
    body: JSON.stringify(body),
  });

  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  const text = await res.text();
  let data;
  if (!text || text.trim() === "") {
    data = {};
  } else if (res.headers.get("content-type")?.includes("text/event-stream")) {
    const lines = text.split("\n");
    const dataLines = lines.filter((l) => l.startsWith("data: ")).map((l) => l.slice(6));
    data = dataLines.length > 0 ? JSON.parse(dataLines[0]) : {};
  } else {
    data = JSON.parse(text);
  }

  if (data.error) throw new Error(`MCP initialize error: ${JSON.stringify(data.error)}`);

  // Send initialized notification
  await fetch(MCP_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json, text/event-stream",
      ...(sessionId ? { "mcp-session-id": sessionId } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
  });

  return data.result;
}

// ── Helpers ────────────────────────────────────────────────────

function fail(message) {
  console.error(`✗ ${message}`);
  process.exit(1);
}

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

// ── Main flow ──────────────────────────────────────────────────

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║  OnPoint MCP Agent — Celo Agentic Payments Hackathon     ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝\n`);
  console.log(`MCP server: ${MCP_URL}`);
  console.log(`API base:   ${API_BASE}`);
  console.log(`Mode:       ${DRY_RUN ? "DRY RUN (no payment)" : "LIVE (real cUSD)"}\n`);

  // Initialize MCP session
  log("🔌", "Initializing MCP session...");
  const initResult = await mcpInitialize();
  log("✓", `Connected to ${initResult?.serverInfo?.name || "onpoint-mcp"} v${initResult?.serverInfo?.version || "?"}`);

  // ── 1. Browse curator directory ──────────────────────────────
  log("📋", "Browsing curator directory (agentPurchasable=true)...");
  const directory = await mcpCall("browse_curator_directory", { agentPurchasable: true });
  const curators = directory?.curators || [];
  if (curators.length === 0) fail("No agent-purchasable curators found");
  log("✓", `Found ${curators.length} agent-purchasable curators:`);
  curators.slice(0, 5).forEach((c) => {
    console.log(`   • ${c.slug} — ${c.name || "unnamed"} (${c.liveListingCount || 0} live listings)`);
  });

  // ── 2. Browse first curator's storefront ─────────────────────
  const curator = curators[0];
  log("🛍️", `Browsing storefront for ${curator.slug}...`);
  const storefront = await mcpCall("browse_storefront", { curatorSlug: curator.slug });
  const listings = (storefront?.listings || []).filter((l) => l.agentCommerce?.offers?.length > 0);
  if (listings.length === 0) fail(`No purchasable listings on ${curator.slug}`);
  const listing = listings[0];
  const offer = listing.agentCommerce.offers[0];
  log("✓", `Selected: ${listing.title || listing.kit?.club || "item"} — size ${offer.size}, ${offer.priceCusd} cUSD`);

  // ── 3. Try-on (x402 paid) ────────────────────────────────────
  const photoPath = path.resolve(import.meta.dirname, "../apps/web/public/assets/4Model.jpg");
  if (fs.existsSync(photoPath)) {
    const photoBuffer = fs.readFileSync(photoPath);
    const photoData = `data:image/jpeg;base64,${photoBuffer.toString("base64")}`;
    log("📸", `Requesting try-on for ${curator.slug}/${listing.id}...`);
    const tryOnResult = await mcpCall("try_on", {
      curatorSlug: curator.slug,
      listingId: listing.id,
      photoData,
    });

    if (tryOnResult?.status === "payment_required") {
      const challenge = tryOnResult.challenge;
      const quote = challenge?.quote || challenge;
      const payTo = quote?.payTo;
      const priceCusd = quote?.priceCusd || challenge?.x402?.priceCusd;
      const dataSuffix = quote?.attribution?.dataSuffix || challenge?.x402?.attribution?.dataSuffix;

      log("💰", `Try-on 402 challenge: pay ${priceCusd} cUSD to ${payTo}`);
      if (dataSuffix) log("🏷️", `ERC-8021 attribution dataSuffix: ${dataSuffix.slice(0, 20)}...`);

      if (DRY_RUN) {
        log("✓", "Dry run — try-on 402 challenge received. Skipping payment.");
      } else {
        const privateKey = process.env.AGENT_PRIVATE_KEY;
        if (!privateKey) fail("AGENT_PRIVATE_KEY not set (use --dry-run to test without paying)");
        const account = privateKeyToAccount(privateKey);
        const wallet = createWalletClient({ account, chain: celo, transport: http() });
        const publicClient = createPublicClient({ chain: celo, transport: http() });

        const amountWei = BigInt(Math.ceil(Number(priceCusd) * 1e18));
        log("💸", `Paying ${priceCusd} cUSD from ${account.address}...`);

        const txData = dataSuffix
          ? encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [payTo, amountWei] }) + dataSuffix.replace(/^0x/, "")
          : undefined;
        const txHash = await wallet.sendTransaction({ to: CUSD_ADDRESS, data: txData });
        log("⏳", `TX sent: ${txHash} — waiting for confirmation...`);
        await publicClient.waitForTransactionReceipt({ hash: txHash });
        log("✓", `Payment confirmed: https://celoscan.io/tx/${txHash}`);

        // Re-call try_on with paymentTxHash
        log("📸", "Re-requesting try-on with paymentTxHash...");
        const tryOnResult2 = await mcpCall("try_on", {
          curatorSlug: curator.slug,
          listingId: listing.id,
          photoData,
          paymentTxHash: txHash,
        });
        if (tryOnResult?.status === "success" || tryOnResult2?.result) {
          const result = tryOnResult2?.result || tryOnResult2;
          log("✓", `Try-on succeeded! Fit: ${JSON.stringify(result?.fitSignal || result?.fit || "n/a")}`);
          if (result?.imageUrl || result?.renderUrl) log("🖼️", `Render: ${result.imageUrl || result.renderUrl}`);
          if (result?.polaroid?.imageUrl) log("📸", `Polaroid: ${result.polaroid.imageUrl}`);
        }
      }
    } else if (tryOnResult?.status === "success") {
      log("✓", "Try-on succeeded (free tier or already paid)");
    }
  } else {
    log("⚠️", `Person photo not found at ${photoPath}, skipping try-on`);
  }

  // ── 4. Buy item (x402 paid) ──────────────────────────────────
  log("🛒", `Requesting order for ${curator.slug}/${listing.id} size ${offer.size}...`);
  const buyResult = await mcpCall("buy_item", {
    curatorSlug: curator.slug,
    listingId: listing.id,
    size: offer.size,
    quantity: 1,
  });

  if (buyResult?.status === "payment_required") {
    const challenge = buyResult.challenge;
    const quote = challenge?.quote || challenge;
    const payTo = quote?.payTo;
    const totalCusd = quote?.totalCusd || quote?.priceCusd;
    const dataSuffix = quote?.attribution?.dataSuffix || challenge?.x402?.attribution?.dataSuffix;
    const quoteId = quote?.quoteId || challenge?.quoteId;

    log("💰", `Order 402 challenge: pay ${totalCusd} cUSD to ${payTo}`);
    if (dataSuffix) log("🏷️", `ERC-8021 attribution dataSuffix: ${dataSuffix.slice(0, 20)}...`);
    if (quoteId) log("📝", `Quote ID: ${quoteId}`);

    if (DRY_RUN) {
      log("✓", "Dry run — order 402 challenge received. Skipping payment.");
      log("✓", "Dry run complete. MCP server is working. Set AGENT_PRIVATE_KEY and re-run to buy.");
    } else {
      const privateKey = process.env.AGENT_PRIVATE_KEY;
      if (!privateKey) fail("AGENT_PRIVATE_KEY not set (use --dry-run to test without paying)");
      const account = privateKeyToAccount(privateKey);
      const wallet = createWalletClient({ account, chain: celo, transport: http() });
      const publicClient = createPublicClient({ chain: celo, transport: http() });

      const amountWei = BigInt(Math.ceil(Number(totalCusd) * 1e18));
      log("💸", `Paying ${totalCusd} cUSD from ${account.address}...`);

      const txData = dataSuffix
        ? encodeFunctionData({ abi: ERC20_ABI, functionName: "transfer", args: [payTo, amountWei] }) + dataSuffix.replace(/^0x/, "")
        : undefined;
      const txHash = await wallet.sendTransaction({ to: CUSD_ADDRESS, data: txData });
      log("⏳", `TX sent: ${txHash} — waiting for confirmation...`);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      log("✓", `Payment confirmed: https://celoscan.io/tx/${txHash}`);

      // Re-call buy_item with paymentTxHash + quoteId
      log("🛒", "Confirming order with paymentTxHash...");
      const buyResult2 = await mcpCall("buy_item", {
        curatorSlug: curator.slug,
        listingId: listing.id,
        size: offer.size,
        quantity: 1,
        paymentTxHash: txHash,
        quoteId,
      });

      if (buyResult2?.status === "success") {
        const order = buyResult2.result?.order || buyResult2.result;
        log("✓", "Order confirmed!");
        if (order?.id) log("📦", `Order: ${order.id}`);
        if (order?.payment?.explorerUrl) log("💸", `Buyer payment: ${order.payment.explorerUrl}`);
        if (order?.payout?.explorerUrl) log("🏦", `Curator payout: ${order.payout.explorerUrl}`);
        if (order?.receiptUrl) log("🧾", `Receipt: ${order.receiptUrl}`);
      } else {
        console.error("Order confirmation response:", JSON.stringify(buyResult2, null, 2));
      }
    }
  } else if (buyResult?.status === "success") {
    log("✓", "Order succeeded");
  } else {
    console.error("Unexpected buy response:", JSON.stringify(buyResult, null, 2));
  }

  // ── 5. Check earnings ────────────────────────────────────────
  log("📊", `Checking earnings for ${curator.slug}...`);
  const earnings = await mcpCall("check_earnings", { curatorSlug: curator.slug });
  log("✓", `Earnings ledger retrieved (${JSON.stringify(earnings).slice(0, 100)}...)`);

  console.log("\n✓ MCP agent flow complete.\n");
}

main().catch((err) => {
  console.error(`\n✗ Fatal error: ${err.message}`);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
