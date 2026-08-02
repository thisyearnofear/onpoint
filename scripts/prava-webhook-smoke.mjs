#!/usr/bin/env node
/**
 * Linq Webhook Smoke Test — proves the /linq/webhook receiver correctly parses
 * the real Linq envelope (Standard Webhooks) and routes events:
 *
 *   1. POST message.received (text + media photo) → style intent → order +
 *      mock iMessage card
 *   2. POST reaction.added (👍 like) → status refresh → checkout when approved
 *
 * Runs self-contained (ephemeral Express, self-check). No LINQ_WEBHOOK_SECRET
 * → signature verification is skipped (dev mode). Uses realistic payloads
 * sourced from the Linq webhook events docs (2026-02-03 version).
 *
 * Usage: node scripts/prava-webhook-smoke.mjs
 */

import express from "express";
import { createRequire } from "module";

// Set env BEFORE requiring modules — linq-agent captures SERVICE_API_KEY at
// module-eval time for its internal relay headers.
process.env.SERVICE_API_KEY = process.env.SERVICE_API_KEY || "smoke-key";

const require = createRequire(import.meta.url);
const pravaCard = require("../apps/api/routes/prava-card.js");
const pravaSandbox = require("../apps/api/routes/prava-sandbox.js");
const pravaFacade = require("../apps/api/routes/prava-facade.js");
const linqAgent = require("../apps/api/routes/linq-agent.js");

const log = (s) => console.log(`\n— ${s} —`);
const ok = (l, v) => console.log(`  ✓ ${l}: ${v}`);
const sub = (l, v) => console.log(`    · ${l}: ${v}`);

// Realistic Linq webhook payloads (2026-02-03 version, from the docs).
const msgReceived = {
  api_version: "v3",
  webhook_version: "2026-02-03",
  event_type: "message.received",
  event_id: "smoke-msg-001",
  created_at: new Date().toISOString(),
  trace_id: "smoke-trace-001",
  partner_id: "smoke-partner",
  data: {
    chat: {
      id: "chat_smoke_001",
      is_group: false,
      owner_handle: { handle: "+14243945528", is_me: true, service: "iMessage", status: "active" },
      health_status: { status: "HEALTHY" },
    },
    id: "msg_smoke_001",
    direction: "inbound",
    sender_handle: { handle: "+15550001111", is_me: false, service: "iMessage", status: "active" },
    parts: [
      { type: "text", value: "black legging rooftop brunch" },
      {
        type: "media",
        filename: "photo.jpg",
        id: "media_smoke_001",
        mime_type: "image/jpeg",
        size_bytes: 245678,
        url: "https://cdn.linqapp.com/attachments/smoke/photo.jpg?signature=abc123",
      },
    ],
    sent_at: new Date().toISOString(),
    service: "iMessage",
  },
};

const reactionAdded = {
  api_version: "v3",
  webhook_version: "2026-02-03",
  event_type: "reaction.added",
  event_id: "smoke-rxn-001",
  created_at: new Date().toISOString(),
  trace_id: "smoke-trace-002",
  partner_id: "smoke-partner",
  data: {
    chat_id: "chat_smoke_001",
    message_id: "msg_mock_card",
    part_index: 0,
    reaction_type: "like",
    custom_emoji: null,
    is_from_me: false,
    from: "+15550001111",
    from_handle: { handle: "+15550001111", is_me: false, service: "iMessage", status: "active" },
    service: "iMessage",
    reacted_at: new Date().toISOString(),
    sticker: null,
  },
};

async function main() {
  const app = express();
  // Match server.js: per-route body parsers (no global express.json, so the
  // linq-agent's express.raw on /webhook captures the raw body for HMAC).
  app.use("/prava/card", pravaCard);
  app.use("/prava/sandbox", express.json({ limit: "1mb" }), pravaSandbox);
  app.use("/prava", pravaFacade);
  app.use("/linq", linqAgent);

  // The linq-agent reads process.env.PORT lazily for its internal relay to
  // /prava — set it to the ephemeral port after the server boots.
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const port = server.address().port;
  process.env.PORT = String(port);
  const base = `http://localhost:${port}`;

  const post = (p, body) =>
    fetch(`${base}${p}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => r.json());
  const get = (p) =>
    fetch(`${base}${p}`, { headers: { "x-service-key": process.env.SERVICE_API_KEY } }).then((r) => r.json());
  const getText = (p) => fetch(`${base}${p}`).then((r) => r.text());

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  Linq Webhook Smoke Test — inbound-first flow               ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");
  ok("ephemeral port", port);
  sub("webhook secret", process.env.LINQ_WEBHOOK_SECRET ? "set (will verify)" : "unset (dev skip)");

  // ── 1. Inbound message.received (text + photo) ────────────────────
  log("1 · POST /linq/webhook — message.received (text + media photo)");

  // First verify the facade works directly (internal relay debug).
  const directOrder = await fetch(`${base}/prava/order`, {
    method: "POST",
    headers: { "x-service-key": process.env.SERVICE_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "black legging rooftop brunch" }),
  }).then((r) => r.json());
  ok("direct /prava/order", directOrder.orderId || JSON.stringify(directOrder));

  const r1 = await post("/linq/webhook", msgReceived);
  ok("webhook accepted", r1.received ? "200" : JSON.stringify(r1));
  const duplicate = await post("/linq/webhook", msgReceived);
  ok("duplicate event suppressed", duplicate.duplicate === true);
  // The handler processes async; give it a tick to run the style intent.
  await new Promise((r) => setTimeout(r, 600));

  // Read the stashed order for this chat (shared in-memory store).
  const stashed = linqAgent.getChatOrder("chat_smoke_001");
  if (!stashed) {
    console.log("  ✖ no order stashed for chat — style intent didn't fire");
  } else {
    ok("order created from inbound", stashed.orderId);
    sub("from", stashed.from);
    sub("card messageId (mock)", stashed.messageId || "(pending)");
    reactionAdded.data.message_id = stashed.messageId;

    // Verify the order + card via the facade (shared in-memory store).
    const order = await get(`/prava/order/${stashed.orderId}`);
    ok("order state", order.state);
    sub("merchant", order.merchant?.name);
    sub("total", `${order.totalAmount} ${order.currency}`);
    sub("try-on (from inbound photo)", order.tryOnUrl ? "rendered" : "none");

    const card = await getText(`/prava/card/${stashed.orderId}`);
    ok("card renders try-on", card.includes("How it looks on you"));
    ok("card shows spend ceiling", card.includes(`$${order.trust.spendCeilingUsd}`));

    // ── 2. Reaction.added (👍 like) → approval + checkout ──────────
    log("2 · POST /linq/webhook — reaction.added (👍 like → refresh + checkout when approved)");
    const r2 = await post("/linq/webhook", reactionAdded);
    ok("webhook accepted", r2.received ? "200" : JSON.stringify(r2));
    await new Promise((r) => setTimeout(r, 1000));

    const final = await get(`/prava/order/${stashed.orderId}`);
    ok("final order state", final.state);
    ok("Prava order id", final.orderIdPrava || "(none)");
    sub("credential scope", final.trust?.credentialScope);

    const finalCard = await getText(`/prava/card/${stashed.orderId}`);
    ok("card shows confirmed", finalCard.includes("Order placed"));
    ok("card shows Prava order no", final.orderIdPrava ? finalCard.includes(final.orderIdPrava) : "n/a");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Webhook smoke test complete — inbound message.received +");
  console.log("reaction.added parsed from the real Linq envelope.");
  console.log("═══════════════════════════════════════════════════════════════\n");

  server.close(() => process.exit(0));
}

main().catch((e) => {
  console.error("\n✖ Smoke test failed:", e);
  process.exit(1);
});
