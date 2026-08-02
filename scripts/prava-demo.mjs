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
 *   3. Amount    — binding quote in production CLI; fixture amount in self-check
 *   4. Authorize — (folded into POST /prava/order — payment session + payment_url)
 *   5. Approve   — POST /prava/order/:id/poll  (passkey approval → single-use token+cryptogram)
 *   6. Checkout — POST /prava/order/:id/checkout → fixture order id in self-check;
 *                 real order id only when run against the production CLI
 *   7. Prove     — GET  /prava/card/:id           (mutating iMessage App card)
 *
 * In self-check only, it also validates the REST fixture response shape.
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
const LIVE = process.argv.includes("--live");
// Default runs must be deterministic even when the shell has Prava credentials.
if (!LIVE) {
  delete process.env.PRAVA_SECRET_KEY;
  delete process.env.PRAVA_PUBLISHABLE_KEY;
  delete process.env.PRAVA_AGENT_LINKED;
}
// CommonJS route modules from the API.
const pravaCard = require("../apps/api/routes/prava-card.js");
const pravaSandbox = require("../apps/api/routes/prava-sandbox.js");
const pravaFacade = require("../apps/api/routes/prava-facade.js");
const linqAgent = require("../apps/api/routes/linq-agent.js");

// In self-check mode no service key is configured; set a throwaway so the
// service-key-gated facades accept our calls.
process.env.SERVICE_API_KEY = process.env.SERVICE_API_KEY || "demo-key";
const SERVICE_KEY = process.env.SERVICE_API_KEY;

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
  const read = async (r, path, text = false) => {
    const body = text ? await r.text() : await r.json();
    if (!r.ok) throw new Error(`${path} failed ${r.status}: ${text ? body : JSON.stringify(body)}`);
    return body;
  };
  const post = (p, body) => fetch(`${base}${p}`, {
    method: "POST", headers, body: JSON.stringify(body || {}),
  }).then((r) => read(r, p));
  const get = (p) => fetch(`${base}${p}`, { headers }).then((r) => read(r, p));
  const getText = (p) => fetch(`${base}${p}`).then((r) => read(r, p, true));

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  OnPoint × Prava × Linq — Agent Outfitter demo               ║");
  console.log("║  “Discover, try on, and prepare a scoped checkout.”        ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  // ── Health ────────────────────────────────────────────────────────
  log("0 · Health");
  const ph = await get("/prava/health");
  const selfCheck = ph.mode === "self-check";
  const restRail = ph.mode === "sandbox-rest" || ph.mode === "live-rest";
  const lh = await get("/linq/health");
  ok("Prava mode", ph.mode);
  sub("transport", ph.transport);
  if (selfCheck) {
    sub("evidence level", "deterministic fixture — validates orchestration, not a transaction");
  }
  ok("Linq mode", lh.mode);
  sub("prava (from Linq lens)", lh.pravaMode);

  // ── 1. Discover ───────────────────────────────────────────────────
  log("1 · Discover (UCP fashion merchants via Prava)");
  const search = await post("/prava/search", { query: "black legging rooftop brunch" });
  ok("merchants found", (search.results || []).length);
  const top = search.results?.[0];
  sub("top result", `${top?.title} — ${top?.merchant}`);

  // ── 2+3+4. Order (quote + payment session) ───────────────────────
  log(selfCheck
    ? "2 · Create self-check order — deterministic quote + session fixtures"
    : restRail
      ? "2 · Create real Prava REST session from the discovered listed price"
    : "2 · Create order — binding quote + payment session");
  const order = await post("/prava/order", { query: "black legging rooftop brunch" });
  ok("order", order.orderId);
  sub("merchant", order.merchant?.name);
  sub(selfCheck ? "fixture total" : restRail ? "sandbox session amount" : "binding total", `${order.totalAmount} ${order.currency}`);
  sub("requested ceiling", `$${order.trust?.spendCeilingUsd}`);
  sub("requested merchant", order.trust?.merchantScope?.merchant);
  sub("payment_url present", !!order.paymentUrl);
  sub("checkout_session_id", order.checkoutSessionId);

  // ── 2b. Try on (IDM-VTON on the UCP garment + person photo) ──────
  log("3 · Try-on — IDM-VTON on the garment + your photo (before checkout)");
  const tr = await post(`/prava/order/${order.orderId}/try-on`, {
    photoUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b1293a.jpg?auto=format&fit=crop&w=600&q=60",
  });
  const tryOnUrl = tr.tryOnUrl || null;
  ok("try-on render", tryOnUrl ? "rendered" : "none");
  sub("provider", tr.provider);
  sub("state", tr.order?.state);

  // ── 5. Approve (passkey) ──────────────────────────────────────────
  log(selfCheck
    ? "4 · Approval fixture — no passkey or credential"
    : restRail
      ? "4 · Poll hosted card/device flow"
      : "4 · Approve — owner passkey returns single-use tokenized credentials");
  const ap = await post(`/prava/order/${order.orderId}/poll`, {});
  ok("state", ap.state);
  ok("payment status", ap.paymentStatus);
  sub("evidence", selfCheck
    ? "fixture state only — no passkey or credential"
    : ap.state === "credential_ready"
      ? "sandbox credential held server-side; external checkout not attempted"
      : ap.state === "approved" ? "credential held server-side" : "no credential issued");

  // ── 6. Checkout ──────────────────────────────────────────────────
  let co = { order };
  if (restRail) {
    log("5 · REST boundary — external checkout required");
    sub("state", ap.state);
    sub("result", "no checkout or report-status call made");
  } else if (ap.state === "approved" || (selfCheck && ap.state === "self_check_approved")) {
    log(selfCheck
      ? "5 · Checkout — deterministic shop_checkout fixture (no transaction)"
      : "5 · Checkout — production CLI shop_checkout");
    co = await post(`/prava/order/${order.orderId}/checkout`, {});
    ok("state", co.state);
    ok(selfCheck ? "fixture id" : "Prava order id",
      selfCheck ? co.order?.selfCheckOrderId : co.order?.orderIdPrava);
    sub("credential scope", co.order?.trust?.credentialScope);
  } else {
    log("5 · Checkout not run");
    sub("reason", `session state is ${ap.state}`);
  }

  // ── 7. Prove — the mutating iMessage App card ────────────────────
  log("6 · Prove — the mutating iMessage App card");
  const card = await getText(`/prava/card/${order.orderId}`);
  ok("card renders try-on", card.includes("How it looks on you"));
  ok("card shows requested ceiling", card.includes(`$${order.trust.spendCeilingUsd}`));
  if (selfCheck) {
    ok("card labels self-check", card.includes("Self-check completed"));
    ok("card disclaims transaction", card.includes("No credential, payment, or merchant order"));
  } else {
    ok("card avoids merchant confirmation", !card.includes("Your stylist bought it for you"));
  }
  console.log(`\n  🔗 iMessage App card URL:  ${process.env.PUBLIC_BASE_URL || "https://api.onpoint.famile.xyz"}/prava/card/${order.orderId}`);

  // ── Sandbox fallback (live-demo safety net) ──────────────────────
  if (selfCheck) {
    log("7 · Sandbox contract self-check — mocked response shape only");
    const sh = await get("/prava/sandbox/health");
    sub("sandbox mode", sh.mode);
    const session = await post("/prava/sandbox/order", {
      totalAmount: order.totalAmount,
      merchantName: order.merchant?.name,
      merchantUrl: order.merchant?.url,
    });
    ok("fixture session", session.sessionId);
    sub("fixture iframe_url present", !!session.iframeUrl);
    const result = await get(`/prava/sandbox/order/${session.sessionId}/result`);
    ok("fixture payment-result state", result.status);
    sub("credential material remains server-side", !result.token && !result.transactions);
    const report = await post(`/prava/sandbox/order/${session.sessionId}/report`, { status: "APPROVED" });
    ok("fixture report state", report.status);
  } else {
    log("7 · Sandbox fixture contract");
    sub("skipped", "live mode never reports a fabricated processor outcome");
  }

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
        text: `Your OnPoint stylist found ${order.merchant?.name}. Requested total ${order.totalAmount} ${order.currency}. Open the status card for the next step.`,
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
        subcaption: `${order.merchant?.name} · $${order.totalAmount} ${order.currency} — Prava status`,
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
  console.log(selfCheck
    ? "Self-check complete — orchestration validated with deterministic fixtures; no transaction claimed."
    : restRail
      ? "Live check complete — real session path exercised; no checkout, processor outcome, or merchant order claimed."
      : "Live CLI check complete — see the state and order evidence above.");
  console.log("═══════════════════════════════════════════════════════════════\n");

  server.close(() => process.exit(0));
}

main().catch((e) => {
  console.error("\n✖ Demo failed:", e);
  process.exit(1);
});
