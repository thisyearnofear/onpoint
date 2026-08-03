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
 *   - New users get Linq's available-number assignment; replies stay in the
 *     exact inbound chat instead of opening a second conversation.
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

// Redis-backed mission state with a process-local fallback. A Linq chat is
// linked only after the shopper sends the inbound TRACK command. Keeping both
// chat → order and order → public handoff state makes the connection survive
// API restarts and lets the web surface confirm that the phone received it.
const chatOrders = new Map();
const missionStates = new Map();
const processedEventIds = new Map();
const ORDER_TTL_MS = 30 * 60 * 1000;
const ORDER_TTL_SECONDS = Math.floor(ORDER_TTL_MS / 1000);
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of chatOrders) if (now - v.ts > ORDER_TTL_MS) chatOrders.delete(k);
  for (const [k, v] of missionStates) if (now - v.ts > ORDER_TTL_MS) missionStates.delete(k);
  for (const [k, ts] of processedEventIds) if (now - ts > 24 * 60 * 60 * 1000) processedEventIds.delete(k);
}, 5 * 60 * 1000).unref();

const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || 'https://api.onpoint.famile.xyz').replace(/\/$/, '');
const SERVICE_KEY = process.env.SERVICE_API_KEY;

function parseTrackCommand(text) {
  return /^track\s+(op_[0-9a-f-]+)$/i.exec(String(text || '').trim())?.[1] || null;
}

function cardUrlFor(orderId, state) {
  // The iMessage App renders this URL; state is server-driven from the order.
  return `${PUBLIC_BASE}/prava/card/${orderId}`;
}

function missionArtifact({ service, cardUrl }) {
  // iMessage App parts are iMessage-only. RCS/SMS recipients receive the same
  // live mission URL as a rich preview instead of an unsupported app part.
  return service === 'iMessage' ? { cardUrl } : { linkUrl: cardUrl };
}

function maskHandle(handle) {
  const value = String(handle || '');
  const suffix = value.replace(/\D/g, '').slice(-4);
  return suffix ? `•••• ${suffix}` : null;
}

async function readRedisJson(key) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

async function writeRedisJson(key, value) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ORDER_TTL_SECONDS);
  } catch {
    // Process-local state remains available as a best-effort fallback.
  }
}

async function deleteRedisKey(key) {
  const redis = getRedis();
  if (!redis) return;
  try { await redis.del(key); } catch {}
}

async function getActiveChat(chatId) {
  const stored = await readRedisJson(`linq:chat:${chatId}`);
  if (stored) {
    chatOrders.set(chatId, stored);
    return stored;
  }
  return chatOrders.get(chatId) || null;
}

async function setActiveChat(chatId, value) {
  const record = { ...value, ts: Date.now() };
  chatOrders.set(chatId, record);
  await writeRedisJson(`linq:chat:${chatId}`, record);
  return record;
}

async function deleteActiveChat(chatId) {
  chatOrders.delete(chatId);
  await deleteRedisKey(`linq:chat:${chatId}`);
}

async function getMission(orderId) {
  const stored = await readRedisJson(`linq:mission:${orderId}`);
  if (stored) {
    missionStates.set(orderId, stored);
    return stored;
  }
  return missionStates.get(orderId) || null;
}

async function setMission(orderId, value) {
  const record = { ...value, orderId, ts: Date.now() };
  missionStates.set(orderId, record);
  await writeRedisJson(`linq:mission:${orderId}`, record);
  return record;
}

async function ensureMission(orderId) {
  const existing = await getMission(orderId);
  if (existing?.phoneNumber) return existing;

  let assignment;
  try {
    assignment = await linq.getAvailableNumber();
  } catch (error) {
    logger.warn('Linq available-number assignment failed; using configured fallback line', {
      component: 'linq-agent',
      orderId,
      error: error.message,
    });
  }
  return setMission(orderId, {
    status: 'ready',
    phoneNumber: assignment?.phone_number || linq.fromNumber,
    vcfUrl: assignment?.vcf_url || null,
    connected: false,
    maskedHandle: null,
    service: null,
    messageDelivered: false,
  });
}

function missionView(mission) {
  return {
    status: mission.status,
    mode: linq.live ? 'live' : 'mock',
    phoneNumber: mission.phoneNumber,
    vcfUrl: mission.vcfUrl || null,
    message: `TRACK ${mission.orderId}`,
    connected: !!mission.connected,
    maskedHandle: mission.maskedHandle || null,
    service: mission.service || null,
    messageDelivered: !!mission.messageDelivered,
    updatedAt: new Date(mission.ts).toISOString(),
  };
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
    phoneNumber: linq.fromNumber,
    note: linq.live ? 'Live iMessage sends via Linq.' : 'Mock mode — sends log to console. Set LINQ_API_KEY + LINQ_WEBHOOK_SECRET for live.',
  });
});

// ── GET /linq/mission/:orderId — inbound-first phone handoff ────────
// Validates the unguessable order, asks Linq for the healthiest available
// onboarding line once, and returns only public/masked connection state.
router.get('/mission/:orderId', async (req, res) => {
  try {
    await pravaGetOrder(req.params.orderId);
    const mission = await ensureMission(req.params.orderId);
    res.set('Cache-Control', 'no-store');
    return res.json(missionView(mission));
  } catch (error) {
    return res.status(error.status === 404 ? 404 : 502).json({
      error: error.status === 404 ? 'Mission not found or expired' : 'Linq handoff is temporarily unavailable',
    });
  }
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
  const ownerNumber = d.chat?.owner_handle?.handle || d.recipient_handle?.handle || null;
  const parts = d.parts || d.message?.parts || [];
  const text = parts.filter((p) => p.type === 'text').map((p) => p.value).join(' ').trim();
  const mediaParts = parts.filter((p) => p.type === 'media' && /^image\//i.test(p.mime_type || ''));
  const photo = mediaParts[0]
    ? { photoUrl: mediaParts[0].url, mime: mediaParts[0].mime_type }
    : null;
  const direction = d.direction || (d.is_from_me === false ? 'inbound' : 'outbound');
  return {
    type,
    chatId,
    messageId: d.id || d.message?.id || null,
    from,
    ownerNumber,
    text,
    photo,
    direction,
    service: d.service || null,
    version: v,
  };
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

  // Delivery truth comes from Linq's asynchronous lifecycle webhooks, not
  // from the send request being accepted.
  if (type === 'message.delivered' || type === 'message.failed') {
    const p = parseInbound(event);
    const active = await getActiveChat(p.chatId);
    if (!active || !p.messageId || active.messageId !== p.messageId) return;
    const mission = await getMission(active.orderId);
    if (!mission) return;
    await setMission(active.orderId, {
      ...mission,
      status: type === 'message.delivered' ? 'delivered' : 'delivery_failed',
      messageDelivered: type === 'message.delivered',
    });
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
      const active = await getActiveChat(p.chatId);
      if (active?.orderId) {
        const mission = await getMission(active.orderId);
        if (mission) await setMission(active.orderId, { ...mission, status: 'opted_out' });
      }
      await deleteActiveChat(p.chatId);
      return;
    }

    // Link the exact web mission only after the shopper explicitly sends the
    // prefilled TRACK command. This stays inbound-first and creates no second
    // quote or Prava permission session.
    const trackedOrderId = parseTrackCommand(p.text);
    if (trackedOrderId) {
      try {
        await attachExistingOrder(p, trackedOrderId);
      } catch (error) {
        logger.warn('Linq mission handoff could not resolve order', { component: 'linq-agent', orderId: trackedOrderId }, error);
        await linq.sendToChat({
          chatId: p.chatId,
          text: 'That mission link is unavailable or expired. Start a new search on OnPoint and open Messages from its live commerce stack.',
          idempotencyKey: `onpoint:${trackedOrderId}:unavailable`,
        });
      }
      return;
    }

    const active = await getActiveChat(p.chatId);
    if (active) {
      if (p.photo) {
        await continueActiveOrder(p.chatId, active, { photo: p.photo, fitDecision: 'try_on_completed' });
        return;
      }
      if (/^(skip(?:\s+(?:fit|try-?on))?|continue without try-?on)$/i.test(p.text || '')) {
        await continueActiveOrder(p.chatId, active, { fitDecision: 'continue_without_try_on' });
        return;
      }
      if (!/^new\s*:/i.test(p.text || '')) {
        await linq.sendToChat({
          chatId: p.chatId,
          text: 'Your binding quote is ready. Send a photo for a fit check, or reply SKIP FIT to request Prava permission without one.',
        });
        return;
      }
      await deleteActiveChat(p.chatId);
      p.text = p.text.replace(/^new\s*:\s*/i, '');
    }

    // Otherwise treat the text as a new style intent.
    await handleStyleIntent(p.chatId, p.from, p.text || 'style this for me', p.photo, p.service);
    return;
  }

}

async function attachExistingOrder(inbound, orderId) {
  const { chatId, messageId: inboundMessageId, from, ownerNumber, service } = inbound;
  const handoffAttempt = inboundMessageId || orderId;
  const order = await pravaGetOrder(orderId);
  const mission = await ensureMission(orderId);
  if (mission.phoneNumber && ownerNumber && mission.phoneNumber !== ownerNumber) {
    const error = new Error('Mission was opened with a different OnPoint line');
    error.status = 409;
    throw error;
  }

  const health = await safeGetChat(chatId);
  const gate = await sendGate(health);
  if (!gate.ok) {
    logger.warn('Linq mission link gated by chat health', { component: 'linq-agent', chatId, reason: gate.reason });
    return;
  }

  let active = await setActiveChat(chatId, {
    orderId,
    messageId: null,
    service: service || health?.service || null,
    maskedHandle: maskHandle(from),
  });
  await setMission(orderId, {
    ...mission,
    status: 'connected',
    connected: true,
    maskedHandle: maskHandle(from),
    service: service || health?.service || null,
    messageDelivered: false,
  });

  await linq.sendToChat({
    chatId,
    text: `Mission linked. ${order.merchant?.name || 'Merchant'} · ${order.totalAmount} ${order.currency}. Prava approval remains on its hosted surface; 👍 refreshes status only.`,
    idempotencyKey: `onpoint:${orderId}:${handoffAttempt}:linked`,
  });
  const sent = await linq.sendToChat({
    chatId,
    ...missionArtifact({
      service: active.service,
      cardUrl: cardUrlFor(orderId, order.state),
    }),
    cardImageUrl: order.tryOnUrl || undefined,
    caption: 'OnPoint Stylist',
    subcaption: `${order.merchant?.name || 'Merchant'} · ${order.totalAmount} ${order.currency} — 👍 refreshes status`,
    idempotencyKey: `onpoint:${orderId}:${handoffAttempt}:card:${order.state}`,
  });
  if (sent?.messageId) active = await setActiveChat(chatId, { ...active, messageId: sent.messageId });
  await setMission(orderId, {
    ...(await getMission(orderId)),
    status: 'sent',
    messageDelivered: false,
  });
}

// ── Style intent → search → quote → payment session → (try-on) → card ─
async function handleStyleIntent(chatId, from, text, photo, service) {
  // Gate on chat health.
  const health = await safeGetChat(chatId);
  const gate = await sendGate(health);
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

  let active = await setActiveChat(chatId, {
    orderId: order.orderId,
    messageId: null,
    service: service || health?.service || null,
    maskedHandle: maskHandle(from),
  });

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
  await linq.sendToChat({
    chatId,
    text: ` Styled "${text}" — found ${order.merchant?.name}. Requested total ${order.totalAmount} ${order.currency}. ${approvalCopy}`,
    idempotencyKey: `onpoint:${order.orderId}:quote`,
  });
  const sent = await linq.sendToChat({
    chatId,
    ...missionArtifact({ service: active.service, cardUrl }),
    cardImageUrl: order.tryOnUrl || undefined,
    caption: 'OnPoint Stylist',
    subcaption: `${order.merchant?.name || '—'} · $${order.totalAmount} ${order.currency} — tap 👍 to refresh`,
    idempotencyKey: `onpoint:${order.orderId}:card:${order.state}`,
  });
  // Stash the iMessage message id so a 👍 tapback can mutate this card in place.
  if (sent?.messageId) active = await setActiveChat(chatId, { ...active, messageId: sent.messageId });
}

async function continueActiveOrder(chatId, active, { photo, fitDecision }) {
  let order = await pravaGetOrder(active.orderId);
  if (photo) {
    const tr = await pravaTryOn(active.orderId, photo);
    order = tr.order || tr;
  }
  order = await pravaStartSession(active.orderId, fitDecision);
  active = await setActiveChat(chatId, active);
  if (active.messageId && active.service === 'iMessage') {
    const updated = await linq.updateMessage({
      messageId: active.messageId,
      cardUrl: cardUrlFor(active.orderId, order.state),
      cardImageUrl: order.tryOnUrl || undefined,
      caption: 'OnPoint Stylist',
      subcaption: `${order.merchant?.name || 'Merchant'} · $${order.totalAmount} ${order.currency} — Prava permission requested`,
    });
    active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
    active = await setActiveChat(chatId, active);
  }
  await linq.sendToChat({
    chatId,
    text: order.restMode
      ? 'Fit choice recorded. Open the Prava hosted sandbox flow from the status card, then tap 👍 to refresh.'
      : 'Fit choice recorded. Approve the exact merchant and ceiling with your passkey, then tap 👍 to refresh.',
  });
}

// 👍 tapback refreshes observed Prava state. Hosted verification/passkey—not
// the reaction—is the payment authorization.
async function handleStatusRefresh(chatId, tapback) {
  let active = await getActiveChat(chatId);
  if (!active) return;
  if (active.messageId && tapback.messageId !== active.messageId) {
    logger.info('Ignoring reaction on a stale Linq card', { component: 'linq-agent', chatId });
    return;
  }
  const { orderId } = active;

  const current = await pravaGetOrder(orderId);
  if (!current.paymentUrl && (current.state === 'quoted' || current.state === 'try_on_ready')) {
    if (active.messageId && active.service === 'iMessage') {
      const updated = await linq.updateMessage({
        messageId: active.messageId,
        cardUrl: cardUrlFor(orderId, current.state),
        cardImageUrl: current.tryOnUrl || undefined,
        caption: 'OnPoint Stylist',
        subcaption: 'Quote ready — send a photo or reply SKIP FIT before permission',
      });
      active.messageId = updated?.chat?.message?.id || updated?.message?.id || updated?.id || active.messageId;
      active = await setActiveChat(chatId, active);
    }
    return;
  }

  // Poll the facade. Production CLI checkout proceeds only after real approval.
  // REST sandbox stops at credential_ready until an external checkout supplies
  // a real processor outcome; self-check remains explicitly fixture-only.
  const poll = await pravaPollOrder(orderId);
  if (poll.state !== 'approved' && poll.state !== 'self_check_approved') {
    if (active.messageId && active.service === 'iMessage') {
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
      active = await setActiveChat(chatId, active);
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
  if (active.messageId && active.service === 'iMessage') {
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
    active = await setActiveChat(chatId, active);
  }

  if (state === 'confirmed' || state === 'sandbox_completed' || state === 'self_check_completed') {
    await linq.sendToChat({
      chatId,
      text: state === 'sandbox_completed'
        ? '✓ Prava sandbox lifecycle completed: test credential issued and outcome reported. No merchant charge was made.'
        : state === 'self_check_completed'
          ? '✓ Self-check completed with deterministic fixtures. No credential, payment, or merchant order occurred.'
        : result.order?.orderIdPrava
        ? `✓ Ordered. Prava order ${result.order.orderIdPrava}.`
        : '✓ Confirmed.',
    });
    const mission = await getMission(orderId);
    if (mission) await setMission(orderId, { ...mission, status: 'completed', messageDelivered: true });
    await deleteActiveChat(chatId);
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

async function sendGate(chat = {}) {
  let reputation;
  if (linq.live) {
    try {
      const owner = chat?.handles?.find((handle) => handle.is_me)?.handle;
      const response = await linq.listPhoneNumbers();
      const numbers = response?.phone_numbers || response?.data || [];
      const line = numbers.find((entry) =>
        (entry.phone_number || entry.number || entry.handle) === owner,
      );
      reputation = line?.reputation;
    } catch {
      // Chat health remains the authoritative per-conversation safety gate.
    }
  }
  return linq.canSendToChat({
    health_status: chat?.health_status,
    reputation,
  });
}

module.exports = router;
// Test helpers.
module.exports.getChatOrder = getActiveChat;
module.exports.parseTrackCommand = parseTrackCommand;
module.exports.maskHandle = maskHandle;
