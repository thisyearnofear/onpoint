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
const { getRedis } = require('../lib/redis');

const router = express.Router();

// ── In-memory conversation state (hackathon scope; Redis/DB for prod) ──
// Maps linq chatId → active prava orderId, so inbound tapbacks/approvals
// route to the right order.
const chatOrders = new Map();
const processedEventIds = new Map();
const ORDER_TTL_MS = 30 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of chatOrders) if (now - v.ts > ORDER_TTL_MS) chatOrders.delete(k);
  for (const [k, ts] of processedEventIds) if (now - ts > 24 * 60 * 60 * 1000) processedEventIds.delete(k);
}, 5 * 60 * 1000).unref();

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_API_KEY;

function cardUrlFor(orderId, state) {
  // The iMessage App renders this URL; state is server-driven from the order.
  return `${PUBLIC_BASE}/prava/card/${orderId}`;
}

// Linq delivers webhooks at least once. Claim each event before processing so
// a retry cannot create a second binding quote or Prava payment session. Redis
// makes this durable across API restarts; the in-memory set is a safe fallback.
async function claimEvent(eventId) {
  if (!eventId) return true;
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.set(`linq:event:${eventId}`, '1', 'EX', 86_400, 'NX') === 'OK';
    } catch {
      // Fall through to process-local protection.
    }
  }
  if (processedEventIds.has(eventId)) return false;
  processedEventIds.set(eventId, Date.now());
  return true;
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
  const eventId = event.event_id;
  logger.info('Linq webhook', { component: 'linq-agent', type, eventId });

  if (!(await claimEvent(eventId))) {
    return res.status(200).json({ received: true, duplicate: true });
  }

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

  // ── reaction.added: 👍 tapback on the active card → status refresh ─
  if (type === 'reaction.added') {
    const p = parseInbound(event);
    if (p.reactionType === 'like' && !p.isFromMe) {
      logger.info('👍 tapback received — refreshing order status', { component: 'linq-agent', chatId: p.chatId });
      await handleStatusRefresh(p.chatId, p);
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

    const active = chatOrders.get(p.chatId);
    if (active) {
      if (p.photo) {
        await continueActiveOrder(active, { photo: p.photo, fitDecision: 'try_on_completed' });
        return;
      }
      if (/^(skip(?:\s+(?:fit|try-?on))?|continue without try-?on)$/i.test(p.text || '')) {
        await continueActiveOrder(active, { fitDecision: 'continue_without_try_on' });
        return;
      }
      if (!/^new\s*:/i.test(p.text || '')) {
        await linq.sendMessage({
          to: p.from,
          text: 'Your binding quote is ready. Send a photo for a fit check, or reply SKIP FIT to request Prava permission without one.',
        });
        return;
      }
      chatOrders.delete(p.chatId);
      p.text = p.text.replace(/^new\s*:\s*/i, '');
    }

    // Otherwise treat the text as a new style intent.
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

  // Prepare a binding quote first. No Prava payment session exists yet.
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

  if (order.tryOnUrl) {
    const sessionOrder = await pravaStartSession(order.orderId, 'try_on_completed');
    Object.assign(order, sessionOrder);
  }

  // Send the amount + requested-controls card (with try-on render if available)
  // and the relevant hosted-flow URL.
  const cardUrl = cardUrlFor(order.orderId, order.state);
  // Linq requires an imessage_app part to be the only part, so send a text
  // intro first, then the card bubble as a second message.
  const approvalCopy = order.selfCheck
    ? 'This is a deterministic fixture; no credential, payment, or merchant order will occur.'
    : !order.paymentUrl
      ? 'Send a photo for a fit check, or reply SKIP FIT. No Prava permission session has been created yet.'
    : order.restMode
      ? 'Open Prava’s hosted sandbox flow, then 👍 the card to refresh its status. No real money is used.'
      : 'Approve the spend with your passkey, then 👍 the card to refresh its status.';
  await linq.sendMessage({
    to: from,
    text: ` Styled "${text}" — found ${order.merchant?.name}. Requested total ${order.totalAmount} ${order.currency}. ${approvalCopy}`,
  });
  const sent = await linq.sendMessage({
    to: from,
    cardUrl,
    cardImageUrl: order.tryOnUrl || undefined,
    caption: 'OnPoint Stylist',
    subcaption: `${order.merchant?.name || '—'} · $${order.totalAmount} ${order.currency} — tap 👍 to refresh`,
  });
  // Stash the iMessage message id so a 👍 tapback can mutate this card in place.
  if (sent?.messageId) chatOrders.get(chatId).messageId = sent.messageId;
}

async function continueActiveOrder(active, { photo, fitDecision }) {
  let order = await pravaGetOrder(active.orderId);
  if (photo) {
    const tr = await pravaTryOn(active.orderId, photo);
    order = tr.order || tr;
  }
  order = await pravaStartSession(active.orderId, fitDecision);
  active.ts = Date.now();
  if (active.messageId) {
    const updated = await linq.updateMessage({
      messageId: active.messageId,
      cardUrl: cardUrlFor(active.orderId, order.state),
      cardImageUrl: order.tryOnUrl || undefined,
      caption: 'OnPoint Stylist',
      subcaption: `${order.merchant?.name || 'Merchant'} · $${order.totalAmount} ${order.currency} — Prava permission requested`,
    });
    active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
  }
  await linq.sendMessage({
    to: active.from,
    text: order.restMode
      ? 'Fit choice recorded. Open the Prava hosted sandbox flow from the status card, then tap 👍 to refresh.'
      : 'Fit choice recorded. Approve the exact merchant and ceiling with your passkey, then tap 👍 to refresh.',
  });
}

// 👍 tapback refreshes observed Prava state. Hosted verification/passkey—not
// the reaction—is the payment authorization.
async function handleStatusRefresh(chatId, tapback) {
  const active = chatOrders.get(chatId);
  if (!active) return;
  if (active.messageId && tapback.messageId !== active.messageId) {
    logger.info('Ignoring reaction on a stale Linq card', { component: 'linq-agent', chatId });
    return;
  }
  const { orderId } = active;

  const current = await pravaGetOrder(orderId);
  if (!current.paymentUrl && (current.state === 'quoted' || current.state === 'try_on_ready')) {
    if (active.messageId) {
      const updated = await linq.updateMessage({
        messageId: active.messageId,
        cardUrl: cardUrlFor(orderId, current.state),
        cardImageUrl: current.tryOnUrl || undefined,
        caption: 'OnPoint Stylist',
        subcaption: 'Quote ready — send a photo or reply SKIP FIT before permission',
      });
      active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
    }
    return;
  }

  // Poll the facade. Production CLI checkout proceeds only after real approval.
  // REST sandbox stops at credential_ready until an external checkout supplies
  // a real processor outcome; self-check remains explicitly fixture-only.
  const poll = await pravaPollOrder(orderId);
  if (poll.state !== 'approved' && poll.state !== 'self_check_approved') {
    if (active.messageId) {
      const updated = await linq.updateMessage({
        messageId: active.messageId,
        cardUrl: cardUrlFor(orderId, poll.state),
        caption: 'OnPoint Stylist',
        subcaption: poll.state === 'credential_ready'
          ? 'Test credential ready — external checkout outcome required'
          : poll.state === 'checkout_unknown'
            ? 'Checkout outcome unknown — stopped without retry'
            : 'Awaiting hosted verification',
      });
      active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
    }
    return;
  }
  const result = await pravaCheckoutOrder(orderId);
  const state = result.state === 'confirmed' ||
    result.state === 'sandbox_completed' ||
    result.state === 'self_check_completed' ||
    result.state === 'checkout_unknown' ||
    result.state === 'failed'
    ? result.state
    : result.state;

  // Mutate the card in place — the bubble flips to "Order placed".
  if (active.messageId) {
    const updated = await linq.updateMessage({
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
          : state === 'checkout_unknown'
            ? 'Checkout outcome unknown — stopped without retry'
            : state === 'failed'
              ? 'Checkout failed'
              : 'Awaiting hosted verification',
    });
    active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
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

async function readPravaResponse(response) {
  const body = await response.json();
  if (!response.ok) {
    const err = new Error(body.error || `Prava facade failed with HTTP ${response.status}`);
    err.code = body.code;
    err.context = body.context;
    err.status = response.status;
    throw err;
  }
  return body;
}

async function pravaOrderFromIntent(text) {
  const r = await fetch(internalBase() + '/order', {
    method: 'POST', headers,
    body: JSON.stringify({ query: text }),
  });
  return readPravaResponse(r);
}
async function pravaGetOrder(orderId) {
  const r = await fetch(`${internalBase()}/order/${orderId}`, { headers });
  return readPravaResponse(r);
}
async function pravaStartSession(orderId, fitDecision) {
  const r = await fetch(`${internalBase()}/order/${orderId}/session`, {
    method: 'POST', headers,
    body: JSON.stringify({ fitDecision }),
  });
  return readPravaResponse(r);
}
async function pravaTryOn(orderId, photo) {
  const r = await fetch(`${internalBase()}/order/${orderId}/try-on`, {
    method: 'POST', headers,
    body: JSON.stringify(photo), // { photoData } | { photoUrl }
  });
  return readPravaResponse(r);
}
async function pravaPollOrder(orderId) {
  const r = await fetch(`${internalBase()}/order/${orderId}/poll`, { method: 'POST', headers });
  return readPravaResponse(r);
}
async function pravaCheckoutOrder(orderId) {
  const r = await fetch(`${internalBase()}/order/${orderId}/checkout`, { method: 'POST', headers });
  return readPravaResponse(r);
}

async function safeGetChat(chatId) {
  if (!linq.live || !chatId) return {};
  try { return await linq.getChat({ chatId }); } catch { return {}; }
}

module.exports = router;
// Test helper: read the active order for a chat (shared in-memory store).
module.exports.getChatOrder = function (chatId) { return chatOrders.get(chatId) || null; };
