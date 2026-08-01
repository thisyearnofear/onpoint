#!/usr/bin/env node
/**
 * Prava + Linq End-to-End Demo — Agentic Commerce Hackathon (ADR 0017).
 *
 * Walks the full agent-checkout spine in one run, so it doubles as:
 *   • the demo-video script (each step prints a narrative line), and
 *   • a judge-runnable proof (no external deps; self-check mode by default).
 *
 * Flow:
 *   1. Discover  — POST /prava/search        (UCP fashion merchants)
 *   2. Try on    — POST /prava/order/:id/try-on  (IDM-VTON on the garment + person)
 *   3. Quote     — (folded into POST /prava/order — binding total + checkout_session)
 *   4. Authorize — (folded into POST /prava/order — payment session + payment_url)
 *   5. Approve   — POST /prava/order/:id/poll  (passkey approval → single-use token+cryptogram)
 *   6. Checkout — POST /prava/order/:id/checkout → real order id (shop_checkout w/ creds)
 *   7. Prove     — GET  /prava/card/:id           (mutating iMessage App card)
 *
 * Then the SDK/API REST sandbox fallback (live-demo safety net):
 *   create session → poll result → report APPROVED → completed.
 *
 * If LINQ_API_KEY + LINQ_DEMO_TO are set, it also sends a REAL iMessage App
 * card to that number (the live Linq leg). Otherwise the Linq send is skipped.
 *
 * Usage:
 *   node scripts/prava-demo.mjs
 *   LINQ_DEMO_TO=+1YOURNUMBER node scripts/prava-demo.mjs --live
 *
 * Self-contained: boots an ephemeral Express app mounting the real route
 * modules (apps/api/routes/*), so it runs anywhere without the full API
 * server (no DB/Redis). In self-check mode it needs no Prava/Linq creds.
 */

import express from "express";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
// CommonJS route modules from the API.
const pravaCard = require("../apps/api/routes/prava-card.js");
const pravaSandbox = require("../apps/api/routes/prava-sandbox.js");
const pravaFacade = require("../apps/api/routes/prava-facade.js");
const linqAgent = require("../apps/api/routes/linq-agent.js");

// In self-check mode no service key is configured; set a throwaway so the
// service-key-gated facades accept our calls.
process.env.SERVICE_API_KEY = process.env.SERVICE_API_KEY || "demo-key";
const SERVICE_KEY = process.env.SERVICE_API_KEY;

const LIVE = process.argv.includes("--live");
const LINQ_DEMO_TO = process.env.LINQ_DEMO_TO || null;

const log = (step, ...rest) => console.log(`\n— ${step} —`);
const ok = (label, value) => console.log(`  ✓ ${label}: ${value}`);
const sub = (label, value) => console.log(`    · ${label}: ${value}`);

async function main() {
  const app = express();
  app.use(express.json());
  // Match server.js mount ordering: card → sandbox → facade → linq.
  app.use("/prava/card", pravaCard);
  app.use("/prava/sandbox", pravaSandbox);
  app.use("/prava", pravaFacade);
  app.use("/linq", linqAgent);

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const base = `http://localhost:${server.address().port}`;
  const headers = { "x-service-key": SERVICE_KEY, "Content-Type": "application/json" };
  const post = (p, body) =>
    fetch(`${base}${p}`, { method: "POST", headers, body: JSON.stringify(body || {}) }).then((r) => r.json());
  const get = (p) => fetch(`${base}${p}`, { headers }).then((r) => r.json());
  const getText = (p) => fetch(`${base}${p}`).then((r) => r.text());

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  OnPoint × Prava × Linq — Agent Outfitter demo               ║");
  console.log("║  “Your iMessage stylist: discovers, tries on, and buys.”   ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // ── Health ────────────────────────────────────────────────────────
  log("0 · Health");
  const ph = await get("/prava/health");
  const lh = await get("/linq/health");
  ok("Prava mode", ph.mode);
  sub("transport", ph.transport);
  ok("Linq mode", lh.mode);
  sub("prava (from Linq lens)", lh.pravaMode);

  // ── 1. Discover ───────────────────────────────────────────────────
  log("1 · Discover (UCP fashion merchants via Prava)");
  const search = await post("/prava/search", { query: "black legging rooftop brunch" });
  ok("merchants found", (search.results || []).length);
  const top = search.results?.[0];
  sub("top result", `${top?.title} — ${top?.merchant}`);

  // ── 2+3+4. Order (quote + payment session) ───────────────────────
  log("2 · Create order — quote (binding total) + payment session (passkey)");
  const order = await post("/prava/order", { query: "black legging rooftop brunch" });
  ok("order", order.orderId);
  sub("merchant", order.merchant?.name);
  sub("total (binding)", `${order.totalAmount} ${order.currency}`);
  sub("spend ceiling", `$${order.trust?.spendCeilingUsd}`);
  sub("merchant-locked", order.trust?.merchantScope?.locked);
  sub("payment_url present", !!order.paymentUrl);
  sub("checkout_session_id", order.checkoutSessionId);

  // ── 2b. Try on (IDM-VTON on the UCP garment + person photo) ──────
  log("3 · Try-on — IDM-VTON on the garment + your photo (try-on-before-agent-buys)");
  const tr = await post(`/prava/order/${order.orderId}/try-on`, {
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b1293a.jpg?auto=format&fit=crop&w=600&q=60",
  });
  const tryOnUrl = tr.tryOnUrl || null;
  ok("try-on render", tryOnUrl ? "rendered" : "none");
  sub("provider", tr.provider);
  sub("state", tr.order?.state);

  // ── 5. Approve (passkey) ──────────────────────────────────────────
  log("4 · Approve — owner passkey (poll returns single-use tokenized credentials)");
  const ap = await post(`/prava/order/${order.orderId}/poll`, {});
  ok("state", ap.state);
  ok("payment status", ap.paymentStatus);
  sub("credentials captured", ap.state === "approved" ? "yes (token + cryptogram held server-side)" : "no");

  // ── 6. Checkout (shop_checkout — places the real order) ──────────
  log("5 · Checkout — agent completes the purchase with the captured credentials (Prava shop_checkout)");
  const co = await post(`/prava/order/${order.orderId}/checkout`, {});
  ok("state", co.state);
  ok("Prava order id", co.order?.orderIdPrava || "(none)");
  sub("credential scope", co.order?.trust?.credentialScope);

  // ── 7. Prove — the mutating iMessage App card ────────────────────
  log("6 · Prove — the mutating iMessage App card");
  const card = await getText(`/prava/card/${order.orderId}`);
  ok("card renders try-on", card.includes("How it looks on you"));
  ok("card shows spend ceiling", card.includes(`up to $${order.trust.spendCeilingUsd}`));
  ok("card shows confirmed order", card.includes("Order placed"));
  ok("card shows Prava order no", card.includes(co.order.orderIdPrava));
  console.log(`\n  🔗 iMessage App card URL:  ${process.env.PUBLIC_BASE_URL || "https://api.onpoint.famile.xyz"}/prava/card/${order.orderId}`);

  // ── Sandbox fallback (live-demo safety net) ──────────────────────
  log("7 · Sandbox fallback — REST session → passkey → credential → report → completed");
  const sh = await get("/prava/sandbox/health");
  sub("sandbox mode", sh.mode);
  const session = await post("/prava/sandbox/order", {
    totalAmount: order.totalAmount,
    merchantName: order.merchant?.name,
    merchantUrl: order.merchant?.url,
  });
  ok("session", session.sessionId);
  sub("iframe_url present", !!session.iframeUrl);
  const result = await get(`/prava/sandbox/order/${session.sessionId}/result`);
  ok("payment result", result.status);
  sub("one-time token", result.transactions?.[0]?.line_items?.[0]?.token);
  const report = await post(`/prava/sandbox/order/${session.sessionId}/report`, {
    txnRefId: "tli_mock_001",
    status: "APPROVED",
  });
  ok("final status", report.status);

  // ── Live Linq send (optional) ────────────────────────────────────
  if (LIVE && LINQ_DEMO_TO) {
    log("8 · Live Linq send — real iMessage App card to your phone");
    const linq = require("../apps/api/lib/linq-client.js");
    if (!linq.live) {
      sub("skipped", "LINQ_API_KEY not set — run with the key in env to send live");
    } else {
      const cardUrl = `${process.env.PUBLIC_BASE_URL || "https://api.onpoint.famile.xyz"}/prava/card/${order.orderId}`;
      // Linq requires an imessage_app part to be the only part, so send a
      // text intro first, then the card bubble as a second message.
      const intro = await linq.sendMessage({
        to: LINQ_DEMO_TO,
        text: `Your OnPoint stylist styled "${"black legging rooftop brunch"}" — found ${order.merchant?.name}. Total ${order.totalAmount} ${order.currency}. Approve the spend with your passkey, then 👍 the card to confirm.`,
      });
      ok("intro iMessage sent", intro.messageId ? `message ${intro.messageId}` : "(mock)");
      sub("chat id", intro.chatId);
      sub("line health", intro.healthStatus);
      const card = await linq.sendMessage({
        to: LINQ_DEMO_TO,
        cardUrl,
        // Only attach the preview image when it's a real render — the
        // self-check placeholder is a Linq-unreachable URL, and Linq fetches
        // image_url at send time (rejects if unreachable). Captions-only is a
        // valid card.
        cardImageUrl: tr.provider && tr.provider !== 'self-check-placeholder' ? tryOnUrl : undefined,
        caption: "OnPoint Stylist",
        subcaption: `${order.merchant?.name} · $${order.totalAmount} ${order.currency} — tap 👍 to approve`,
      });
      ok("card iMessage sent", card.messageId ? `message ${card.messageId}` : "(mock)");
      sub("card url", cardUrl);
      sub("card image", (tr.provider && tr.provider !== 'self-check-placeholder') ? tryOnUrl : "captions-only (placeholder)");
      sub("line health", card.healthStatus);
    }
  } else {
    log("8 · Live Linq send");
    sub("skipped", "pass --live + LINQ_DEMO_TO=+1... to send a real iMessage card");
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("Demo complete — end-to-end agent checkout: discover → try-on →");
  console.log("quote → authorize → approve → checkout → confirmed + card.");
  console.log("═══════════════════════════════════════════════════════════════\n");

  server.close(() => process.exit(0));
}

main().catch((e) => {
  console.error("\n✖ Demo failed:", e);
  process.exit(1);
});
