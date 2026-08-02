/**
 * Linq Agent Route — /linq/*
 *
 * The message-native surface of the OnPoint agent for the Agentic Commerce
 * Hackathon (ADR 0017, docs/PRAVA-HACKATHON.md). Receives Linq iMessage
 * webhooks and orchestrates the rail-specific /prava flow, sending and
 * mutating an iMessage App status card in place.
 *
 * The card mutates through states in one iMessage bubble:
 *   inbound text → session/status card → hosted approval or verification →
 *   credential_ready (REST) or confirmed merchant order (production CLI)
 *
 * Endpoints:
 *   POST /linq/webhook        — Linq inbound (message.received / message.updated
 *                               for tapbacks / phone_number.status_updated).
 *                               Auth: HMAC signature (LINQ_WEBHOOK_SECRET).
 *   GET  /linq/health         — mode + wiring liveness.
 *
 * Compliance (best practices, docs.linqapp.com/getting-started/best-practices):
 *   - Every inbound is opt-out scanned; OPTED_OUT chats are terminal.
 *   - Sends use `to` only; Linq load-balances the pool.
 *   - Inbound-first: the agent only acts after the user messages first.
 *
 * This is the orchestration glue. The actual Linq REST calls live in
 * lib/linq-client.js; the Prava buy-flow in lib/prava-client.js + the
 * /prava facade. In mock mode (no LINQ_API_KEY), sends log to the console
 * so the spine is walkable now.
 */

const express = require('express');
const crypto = require('crypto');
const logger = require('../lib/logger');
const linq = require('../lib/linq-client');
const prava = require('../lib/prava-client');

const router = express.Router();

// ── In-memory conversation state (hackathon scope; Redis/DB for prod) ──
// Maps linq chatId → active prava orderId, so inbound tapbacks/approvals
// route to the right order.
const chatOrders = new Map();
const ORDER_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of chatOrders) if (now - v.ts > ORDER_TTL_MS) chatOrders.delete(k);
}, 5 * 60 * 1000).unref();

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_API_KEY;

function cardUrlFor(orderId, state) {
  // The iMessage App renders this URL; state is server-driven from the order.
  return `${PUBLIC_BASE}/prava/card/${orderId}`;
}

// ── GET /linq/health ─────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    mode: linq.live ? 'live' : 'mock',
    webhookSecretConfigured: !!process.env.LINQ_WEBHOOK_SECRET,
    pravaMode: prava.selfCheck() ? 'self-check' : 'live',
    publicBase: PUBLIC_BASE,
    note: linq.live ? 'Live iMessage sends via Linq.' : 'Mock mode — sends log to console. Set LINQ_API_KEY + LINQ_WEBHOOK_SECRET for live.',
  });
});

// ── POST /linq/webhook — Linq inbound ───────────────────────────────
// Raw body capture for HMAC verification.
router.use('/webhook', express.raw({ type: '*/*', limit: '1mb' }));

router.post('/webhook', async (req, res) => {
  const ok = await linq.verifyWebhook(req.body.toString('utf8'), req.headers);
  if (!ok) {
    logger.warn('Linq webhook signature verification failed', { component: 'linq-agent' });
    return res.status(401).json({ error: 'invalid signature' });
  }

  let event;
  try { event = JSON.parse(req.body.toString('utf8')); }
  catch { return res.status(400).json({ error: 'invalid json' }); }

  const type = event.event_type;
  const eventId = event.event_id; // for dedup (at-least-once delivery)
  logger.info('Linq webhook', { component: 'linq-agent', type, eventId });

  // Always 200 fast; process async so Linq doesn't retry (10s timeout).
  res.status(200).json({ received: true });

  try {
    await handleLinqEvent(event);
  } catch (e) {
    logger.error('Linq event handling failed', { component: 'linq-agent', type, eventId }, e);
  }
});

// ── Parse the Linq envelope into a normalized inbound message ────────
// Handles both webhook versions (2026-02-03 and 2025-01-01).
function parseInbound(event) {
  const d = event.data || {};
  const type = event.event_type;
  const v = event.webhook_version;

  if (type === 'reaction.added' || type === 'reaction.removed') {
    return {
      type, chatId: d.chat_id, from: d.from || d.from_handle?.handle,
      reactionType: d.reaction_type, messageId: d.message_id, isFromMe: d.is_from_me,
    };
  }

  if (type === 'phone_number.status_updated') {
    return { type, phoneNumber: d.phone_number, newStatus: d.new_status, newReputation: d.new_reputation };
  }

  // message.received / message.sent / message.delivered / message.read
  const chatId = d.chat?.id || d.chat_id;
  const from = d.sender_handle?.handle || d.from;
  const parts = d.parts || d.message?.parts || [];
  const text = parts.filter((p) => p.type === 'text').map((p) => p.value).join(' ').trim();
  const mediaParts = parts.filter((p) => p.type === 'media' && /^image\//i.test(p.mime_type || ''));
  const photo = mediaParts[0]
    ? { photoUrl: mediaParts[0].url, mime: mediaParts[0].mime_type }
    : null;
  const direction = d.direction || (d.is_from_me === false ? 'inbound' : 'outbound');
  return { type, chatId, from, text, photo, direction, version: v };
}

async function handleLinqEvent(event) {
  const type = event.event_type;
  const d = event.data || {};

  // ── phone_number.status_updated: line reputation changed ───────────
  if (type === 'phone_number.status_updated') {
    logger.warn('Line reputation changed', {
      component: 'linq-agent',
      number: d.phone_number, status: d.new_status, reputation: d.new_reputation,
    });
    return;
  }

  // ── reaction.added: 👍 tapback on a card → approval ────────────────
  if (type === 'reaction.added') {
    const p = parseInbound(event);
    if (p.reactionType === 'like' && !p.isFromMe) {
      logger.info('👍 tapback received — approving order', { component: 'linq-agent', chatId: p.chatId });
      await handleApproval(p.chatId, p);
    }
    return;
  }

  // ── message.received: inbound text + optional photo ───────────────
  if (type === 'message.received') {
    const p = parseInbound(event);
    if (p.direction !== 'inbound') return;

    if (!p.text && !p.photo) return;

    // Opt-out compliance — terminal.
    if (p.text && linq.scanOptOut(p.text)) {
      logger.warn('Opt-out detected — halting outbound', { component: 'linq-agent', chatId: p.chatId, from: p.from });
      chatOrders.delete(p.chatId);
      return;
    }

    // Otherwise treat the text as a style intent → start the buy-flow.
    await handleStyleIntent(p.chatId, p.from, p.text || 'style this for me', p.photo);
    return;
  }

}

// ── Style intent → search → quote → payment session → (try-on) → card ─
async function handleStyleIntent(chatId, from, text, photo) {
  // Gate on chat health.
  const health = await safeGetChat(chatId);
  const gate = linq.canSendToChat(health);
  if (!gate.ok) {
    logger.warn('Send gated by health', { component: 'linq-agent', chatId, reason: gate.reason });
    return;
  }

  // Create the order via the /prava facade (internal call). Self-check mode
  // resolves a fixture merchant+total automatically.
  const order = await pravaOrderFromIntent(text);

  // If the inbound message carried a person photo (Linq media part), run
  // IDM-VTON on the UCP garment image before checkout.
  if (photo) {
    try {
      const tr = await pravaTryOn(order.orderId, photo);
      order.tryOnUrl = tr.tryOnUrl;
      order.state = tr.order?.state || order.state;
    } catch (e) {
      logger.warn('Try-on failed; continuing to quote without render', { component: 'linq-agent', error: e.message });
    }
  }

  chatOrders.set(chatId, { orderId: order.orderId, from, messageId: null, ts: Date.now() });

  // Send the amount + requested-controls card (with try-on render if available)
  // and the relevant hosted-flow URL.
  const cardUrl = cardUrlFor(order.orderId, order.state);
  // Linq requires an imessage_app part to be the only part, so send a text
  // intro first, then the card bubble as a second message.
  const approvalCopy = order.selfCheck
    ? 'This is a deterministic fixture; no credential, payment, or merchant order will occur.'
    : order.restMode
      ? 'Open Prava’s hosted sandbox flow, then 👍 the card to continue. No real money is used.'
      : 'Approve the spend with your passkey, then 👍 the card to confirm.';
  await linq.sendMessage({
    to: from,
    text: ` Styled "${text}" — found ${order.merchant?.name}. Requested total ${order.totalAmount} ${order.currency}. ${approvalCopy}`,
  });
  const sent = await linq.sendMessage({
    to: from,
    cardUrl,
    cardImageUrl: order.tryOnUrl || undefined,
    caption: 'OnPoint Stylist',
    subcaption: `${order.merchant?.name || '—'} · $${order.totalAmount} ${order.currency} — tap 👍 to approve`,
  });
  // Stash the iMessage message id so a 👍 tapback can mutate this card in place.
  if (sent?.messageId) chatOrders.get(chatId).messageId = sent.messageId;
}

// 👍 tapback → run checkout on the (approved) order, mutate card to confirmed.
async function handleApproval(chatId, _tapback) {
  const active = chatOrders.get(chatId);
  if (!active) return;
  const { orderId } = active;

  // Poll the facade. Production CLI checkout proceeds only after real approval.
  // REST sandbox stops at credential_ready until an external checkout supplies
  // a real processor outcome; self-check remains explicitly fixture-only.
  const poll = await pravaPollOrder(orderId);
  if (poll.state !== 'approved' && poll.state !== 'self_check_approved') {
    if (active.messageId) {
      await linq.updateMessage({
        messageId: active.messageId,
        cardUrl: cardUrlFor(orderId, poll.state),
        caption: 'OnPoint Stylist',
        subcaption: poll.state === 'credential_ready'
          ? 'Test credential ready — external checkout outcome required'
          : 'Awaiting approval',
      });
    }
    return;
  }
  const result = await pravaCheckoutOrder(orderId);
  const state = result.state === 'confirmed' ||
    result.state === 'sandbox_completed' ||
    result.state === 'self_check_completed'
    ? result.state
    : 'awaiting_approval';

  // Mutate the card in place — the bubble flips to "Order placed".
  if (active.messageId) {
    await linq.updateMessage({
      messageId: active.messageId,
      cardUrl: cardUrlFor(orderId, state),
      cardImageUrl: result.order?.tryOnUrl || undefined,
      caption: 'OnPoint Stylist',
      subcaption: state === 'confirmed' && result.order?.orderIdPrava
        ? `✓ Order placed — Prava ${result.order.orderIdPrava}`
        : state === 'sandbox_completed'
          ? '✓ Prava sandbox completed — no merchant charge'
          : state === 'self_check_completed'
            ? '✓ Self-check completed — no transaction'
          : 'Awaiting approval',
    });
  }

  if (state === 'confirmed' || state === 'sandbox_completed' || state === 'self_check_completed') {
    await linq.sendMessage({
      to: active.from,
      text: state === 'sandbox_completed'
        ? '✓ Prava sandbox lifecycle completed: test credential issued and outcome reported. No merchant charge was made.'
        : state === 'self_check_completed'
          ? '✓ Self-check completed with deterministic fixtures. No credential, payment, or merchant order occurred.'
        : result.order?.orderIdPrava
        ? `✓ Ordered. Prava order ${result.order.orderIdPrava}.`
        : '✓ Confirmed.',
    });
    chatOrders.delete(chatId);
  }
}

// ── Internal /prava facade calls (localhost relay, service-key) ──────
// PORT is read lazily so tests/the ephemeral demo can set it after boot.
function internalBase() {
  return `http://localhost:${process.env.PORT || 48751}/prava`;
}
const headers = { 'x-service-key': SERVICE_KEY || '', 'Content-Type': 'application/json' };

async function pravaOrderFromIntent(text) {
  const r = await fetch(internalBase() + '/order', {
    method: 'POST', headers,
    body: JSON.stringify({ query: text }),
  });
  return r.json();
}
async function pravaTryOn(orderId, photo) {
  const r = await fetch(`${internalBase()}/order/${orderId}/try-on`, {
    method: 'POST', headers,
    body: JSON.stringify(photo), // { photoData } | { photoUrl }
  });
  return r.json();
}
async function pravaPollOrder(orderId) {
  const r = await fetch(`${internalBase()}/order/${orderId}/poll`, { method: 'POST', headers });
  return r.json();
}
async function pravaCheckoutOrder(orderId) {
  const r = await fetch(`${internalBase()}/order/${orderId}/checkout`, { method: 'POST', headers });
  return r.json();
}

async function safeGetChat(chatId) {
  if (!linq.live || !chatId) return {};
  try { return await linq.getChat({ chatId }); } catch { return {}; }
}

module.exports = router;
// Test helper: read the active order for a chat (shared in-memory store).
module.exports.getChatOrder = function (chatId) { return chatOrders.get(chatId) || null; };
