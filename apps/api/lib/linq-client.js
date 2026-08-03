/**
 * Linq Client — iMessage/RCS/SMS messaging for the OnPoint agent.
 *
 * Wraps the Linq Partner REST API (api.linqapp.com/api/partner/v3) so the
 * agent can send text + iMessage App cards, receive inbound webhooks, and
 * stay compliant with Linq's deliverability best practices
 * (https://docs.linqapp.com/getting-started/best-practices/).
 *
 * Two modes (mirrors the Prava/OKX self-check pattern):
 *   • Mock (default, LINQ_API_KEY unset) — logs sends/updates to the console
 *     so the agent orchestration is walkable without Linq creds/a number.
 *   • Live (LINQ_API_KEY set) — real iMessage sends + in-place card updates.
 *
 * Compliance baked in:
 *   - scanOptOut() on every inbound; OPTED_OUT chats are terminal.
 *   - new contacts are assigned with `/v3/available_number`.
 *   - replies stay inside the inbound chat via `/v3/chats/:id/messages`.
 *   - canSendToChat() checks health_status + line reputation before sending.
 *   - Inbound-first + contact-card sharing helpers.
 *
 * NOTE: exact field shapes for the `imessage_app` part and webhook payloads
 * are confirmed against the Linq /v3 API reference + the @linqapp/sdk (Node)
 * once creds are issued; the structure below matches the published best
 * practices and the iMessage Apps overview. TODOs mark spots to finalize.
 */

const logger = require('./logger');

const BASE = process.env.LINQ_API_BASE || 'https://api.linqapp.com/api/partner';
const API_KEY = process.env.LINQ_API_KEY;
const WEBHOOK_SECRET = process.env.LINQ_WEBHOOK_SECRET; // for HMAC verification
// Fallback for mock mode and temporary API failures. Live onboarding asks Linq
// for the healthiest available line rather than pinning this value.
const FROM_NUMBER = process.env.LINQ_FROM_NUMBER || '+14243945528';

// iMessage app identity for the OnPoint Stylist Messages extension. The card
// "becomes" this app; recipients without the extension installed still see
// the static layout card (captions + preview image) when interactive=false.
// TODO: replace team_id/bundle_id with the real shipping extension once the
// Messages app is registered with Apple.
const APP_NAME = process.env.LINQ_APP_NAME || 'OnPoint Stylist';
const APP_TEAM_ID = process.env.LINQ_APP_TEAM_ID || 'ONPOINT001'; // 10 uppercase alphanumeric
const APP_BUNDLE_ID = process.env.LINQ_APP_BUNDLE_ID || 'com.onpoint.stylist.MessageExtension';

// Build a spec-compliant imessage_app part. Linq requires:
//   - app.{name, team_id(10 upper alnum), bundle_id (no ':')}
//   - url (absolute https)
//   - layout with ≥1 of caption/subcaption/trailing_*/image_url
//   - the imessage_app part is the ONLY part in the message
// fallback_text must avoid dates/times/addresses/phone numbers or the card
// silently degrades to a plain text bubble.
function imessageAppPart({ cardUrl, cardImageUrl, caption, subcaption }) {
  const layout = {
    caption: caption || APP_NAME,
    subcaption: subcaption || 'Styling…',
  };
  if (cardImageUrl) layout.image_url = cardImageUrl;
  return {
    type: 'imessage_app',
    app: { name: APP_NAME, team_id: APP_TEAM_ID, bundle_id: APP_BUNDLE_ID },
    url: cardUrl,
    fallback_text: 'Open in OnPoint Stylist',
    interactive: false, // always render the static card (no installed extension yet)
    layout,
  };
}

// Tests and local demos can force deterministic mock behavior even when a
// developer shell has a real LINQ_API_KEY exported. Production remains live
// whenever credentials are present unless this explicit opt-in is set.
const mock = process.env.LINQ_MOCK === '1' || !API_KEY;
const live = !!API_KEY && !mock;

// ── Opt-out compliance ──────────────────────────────────────────────
// Linq does NOT suppress these for us — we scan every inbound ourselves.
const OPT_OUT_KEYWORDS = ['STOP', 'UNSUBSCRIBE', 'OPTOUT', 'CANCEL', 'END', 'QUIT'];
const OPT_IN_KEYWORDS = ['START', 'OPTIN', 'UNSTOP'];

function scanOptOut(text) {
  if (!text) return false;
  const trimmed = text.trim();
  // Linq's health model matches these exact, case-sensitive whole messages.
  // Avoid substring checks: "weekend" must not become an accidental END.
  if (OPT_OUT_KEYWORDS.includes(trimmed)) return true;
  const intent = /(stop|don't|do not|quit)\s+(messag|text|contact)|leave me alone|stop messaging/i.test(text);
  return intent;
}

function scanOptIn(text) {
  if (!text) return false;
  return OPT_IN_KEYWORDS.includes(text.trim());
}

// ── Webhook signature verification (Standard Webhooks) ──────────────
// Linq follows the Standard Webhooks spec. Headers:
//   webhook-id, webhook-timestamp, webhook-signature (v1,{base64} format)
// Signed content: "{webhook-id}.{webhook-timestamp}.{rawBody}"
// Secret: whsec_-prefixed base64 (strip prefix, base64-decode → key bytes)
// Legacy fallback: X-Webhook-Signature (hex HMAC-SHA256 over raw body).
async function verifyWebhook(rawBody, headers = {}) {
  if (!WEBHOOK_SECRET) return true; // dev: skip when no secret set
  try {
    const { createHmac, timingSafeEqual } = await import('node:crypto');

    // Standard Webhooks path.
    const msgId = headers['webhook-id'];
    const ts = headers['webhook-timestamp'];
    const sigHeader = headers['webhook-signature'];
    if (msgId && ts && sigHeader) {
      // Replay protection: reject >5 min old.
      const ageSec = Math.abs(Date.now() / 1000 - parseInt(ts, 10));
      if (ageSec > 300) return false;
      const secretStr = WEBHOOK_SECRET.startsWith('whsec_') ? WEBHOOK_SECRET.slice(6) : WEBHOOK_SECRET;
      const keyBytes = Buffer.from(secretStr, 'base64');
      const signedContent = `${msgId}.${ts}.${rawBody}`;
      const expected = createHmac('sha256', keyBytes).update(signedContent).digest('base64');
      return sigHeader.split(' ').some((sig) => {
        if (!sig.startsWith('v1,')) return false;
        try {
          return timingSafeEqual(Buffer.from(expected, 'base64'), Buffer.from(sig.slice(3), 'base64'));
        } catch { return false; }
      });
    }

    // Legacy path (X-Webhook-Signature, hex HMAC-SHA256 over raw body).
    const legacySig = headers['x-webhook-signature'];
    if (legacySig) {
      const expected = createHmac('sha256', WEBHOOK_SECRET).update(rawBody).digest('hex');
      try {
        return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(legacySig, 'hex'));
      } catch { return false; }
    }

    return false;
  } catch {
    return false;
  }
}

// ── Send gate: health + reputation ───────────────────────────────────
// Before any outbound, check the chat health_status + line reputation.
// OPTED_OUT / BLOCKED are terminal → hard stop. CRITICAL → hard stop.
// AT_RISK → allow but flag (best practice: "slow or pause", not a hard
// block; on a single sandbox line we can't migrate off it, so we send
// with a warning rather than deadlocking the demo). The chat's
// health_status.status is available directly on the /v3/chats response.
function canSendToChat({ health_status, reputation } = {}) {
  // Accept either { status: "OPTED_OUT" } or the bare string.
  const st = typeof health_status === 'string' ? health_status : (health_status?.status || health_status?.health_status?.status);
  if (st === 'OPTED_OUT' || st === 'BLOCKED') return { ok: false, reason: 'chat_' + st.toLowerCase() };
  if (reputation === 'CRITICAL' || st === 'CRITICAL') return { ok: false, reason: 'line_critical' };
  if (st === 'AT_RISK') return { ok: true, reason: 'at_risk_slow', warn: true };
  return { ok: true };
}

// ── REST call ────────────────────────────────────────────────────────
async function v3(method, path, body) {
  if (!live) {
    logger.info('[linq mock] ' + method + ' ' + path, { component: 'linq-client', body });
    const id = 'msg_mock_' + Math.random().toString(36).slice(2, 10);
    if (method === 'GET' && path === '/v3/available_number') {
      return { phone_number: FROM_NUMBER, vcf_url: null, mocked: true };
    }
    if (method === 'GET' && /^\/v3\/chats\//.test(path)) {
      return { id: path.split('/').pop(), health_status: { status: 'HEALTHY' }, service: 'iMessage', mocked: true };
    }
    if (method === 'GET' && path === '/v3/phone_numbers') {
      return { phone_numbers: [{ phone_number: FROM_NUMBER, reputation: 'HEALTHY' }], mocked: true };
    }
    if (method === 'POST' && /^\/v3\/chats\/[^/]+\/messages$/.test(path)) {
      return { chat_id: path.split('/')[3], message: { id }, mocked: true };
    }
    if (method === 'POST' && path === '/v3/messages') {
      return { chat_id: 'chat_mock_' + Math.random().toString(36).slice(2, 8), messages: [{ id }], mocked: true };
    }
    // Create-chat/update-card compatibility for focused unit tests.
    return { chat: { id: 'chat_mock_' + Math.random().toString(36).slice(2, 8), health_status: { status: 'OK' }, message: { id } }, mocked: true };
  }
  const r = await fetch(BASE + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
  if (!r.ok) {
    throw new Error('Linq ' + method + ' ' + path + ' failed ' + r.status + ': ' + text);
  }
  return json;
}

// ── Send a message (text and/or iMessage App card) ───────────────────
// Uses POST /v3/messages with `to` and no `from`, allowing Linq to reuse a
// healthy chat or select/fail over to the best line. Inbound webhook handlers
// should prefer sendToChat() because they already have the exact chat ID.
// Parts use { type, value } — text value is the string; the iMessage App
// value is the card URL (exact imessage_app field set confirmed from docs).
// Returns { chatId, messageId, healthStatus, raw } so callers can mutate the
// card in place via updateMessage({ messageId }).
//
// Linq constraint: an imessage_app part MUST be the only part in a message.
// So when cardUrl is given we send the card alone; otherwise we send text.
// Callers that want a text intro + a card should send two messages.
async function sendMessage({ to, text, linkUrl, cardUrl, cardImageUrl, caption, subcaption, idempotencyKey } = {}) {
  let parts;
  if (cardUrl) {
    parts = [imessageAppPart({ cardUrl, cardImageUrl, caption, subcaption })];
  } else if (linkUrl) {
    parts = [{ type: 'link', value: linkUrl }];
  } else if (text) {
    parts = [{ type: 'text', value: text }];
  } else {
    throw new Error('sendMessage requires either text or cardUrl');
  }
  const message = { parts };
  if (idempotencyKey) message.idempotency_key = idempotencyKey;
  const raw = await v3('POST', '/v3/messages', { to: [to], message });
  return {
    chatId: raw?.chat_id || raw?.chat?.id || null,
    messageId: raw?.messages?.[0]?.id || raw?.message?.id || raw?.chat?.message?.id || null,
    healthStatus: raw?.chat?.health_status?.status || raw?.chat?.health_status || null,
    raw,
  };
}

// Reply inside the chat that produced an inbound webhook. This preserves the
// user's chosen line/protocol and avoids opening a second conversation.
async function sendToChat({ chatId, text, linkUrl, cardUrl, cardImageUrl, caption, subcaption, idempotencyKey } = {}) {
  if (!chatId) throw new Error('sendToChat requires chatId');
  let parts;
  if (cardUrl) {
    parts = [imessageAppPart({ cardUrl, cardImageUrl, caption, subcaption })];
  } else if (linkUrl) {
    parts = [{ type: 'link', value: linkUrl }];
  } else if (text) {
    parts = [{ type: 'text', value: text }];
  } else {
    throw new Error('sendToChat requires either text or cardUrl');
  }
  const message = { parts };
  if (idempotencyKey) message.idempotency_key = idempotencyKey;
  const raw = await v3('POST', `/v3/chats/${encodeURIComponent(chatId)}/messages`, { message });
  return {
    chatId: raw?.chat_id || chatId,
    messageId: raw?.message?.id || null,
    raw,
  };
}

// ── Update a card in place (mutating bubble state machine) ───────────
// POST /v3/messages/{messageId}/update replaces the delivered card rather
// than posting a second bubble. Only url/fallback_text/interactive/layout
// change; the app identity is fixed for the life of the card. The update is
// delivered as a new message with its own id — re-update using the new id.
async function updateMessage({ messageId, cardUrl, cardImageUrl, caption, subcaption }) {
  const layout = {
    caption: caption || APP_NAME,
    subcaption: subcaption || 'Updated',
  };
  if (cardImageUrl) layout.image_url = cardImageUrl;
  return v3('POST', '/v3/messages/' + messageId + '/update', {
    url: cardUrl,
    fallback_text: 'Open in OnPoint Stylist',
    interactive: false,
    layout,
  });
}

// ── Contact card (onboarding) ────────────────────────────────────────
// Create once per line (POST), later changes via PATCH. Share via the
// dedicated endpoint after ≥1 outbound message; re-share ~once/day.
async function shareContactCard({ chatId }) {
  return v3('POST', '/v3/chats/' + chatId + '/share_contact_card');
}

// ── Chat + line health reads ─────────────────────────────────────────
async function getChat({ chatId }) {
  return v3('GET', '/v3/chats/' + chatId);
}
async function listPhoneNumbers() {
  return v3('GET', '/v3/phone_numbers');
}

// ── Onboarding a NEW user (the only valid use of available_number) ───
async function getAvailableNumber() {
  return v3('GET', '/v3/available_number');
}

module.exports = {
  live,
  fromNumber: FROM_NUMBER,
  scanOptOut,
  scanOptIn,
  verifyWebhook,
  canSendToChat,
  sendMessage,
  sendToChat,
  updateMessage,
  shareContactCard,
  getChat,
  listPhoneNumbers,
  getAvailableNumber,
};
