#!/usr/bin/env node
/**
 * onpoint-spectrum — Runway iMessage worker over Photon Spectrum (ADR 0022).
 *
 * Primary Runway line. Replaces the Linq path (routes/linq-agent.js, kept
 * dormant as fallback) with Spectrum's managed iMessage provider over the
 * streaming model (app.messages) — no webhooks.
 *
 *   inbound text        → engine.handleInbound({ chatId, text })
 *   inbound image/*     → content.read() → data URL → handleInbound({ imageDataUrl })
 *   outbound intents    → text / card (image attachment + rich link) / link
 *
 * chatId is `spectrum:<space.id>` so Spectrum state can never collide with
 * Linq chat IDs in Redis. Photo bytes are never logged or persisted (§5).
 *
 * Required env (shared/api/.env on Hetzner):
 *   SPECTRUM_PROJECT_ID, SPECTRUM_PROJECT_SECRET
 * Optional:
 *   REDIS_URL — dedupe store (in-memory fallback)
 */

// PM2 cwd is /opt/onpoint; apps/api/.env is the symlink to shared/api/.env.
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const engine = require('./lib/runway/engine');
const { getRedis } = require('./lib/redis');
const logger = require('./lib/logger');

const DEDUPE_TTL_S = 86_400;
const DEDUPE_PREFIX = 'runway:spectrum:seen:';
const dedupeMemory = new Set();

function maskSender(sender) {
  const value = String(sender?.id || '');
  const suffix = value.replace(/\D/g, '').slice(-4);
  return suffix ? `•••• ${suffix}` : 'unknown';
}

/** Claim a message id once per 24h. Redis-backed with in-memory fallback. */
async function claimMessage(messageId) {
  const key = `${DEDUPE_PREFIX}${messageId}`;
  const redis = getRedis();
  if (redis) {
    try {
      return (await redis.set(key, '1', 'EX', DEDUPE_TTL_S, 'NX')) === 'OK';
    } catch {
      // fall through to memory — never drop the message on a Redis blip
    }
  }
  if (dedupeMemory.has(key)) return false;
  dedupeMemory.add(key);
  if (dedupeMemory.size > 10_000) dedupeMemory.clear();
  return true;
}

/**
 * Map an inbound Spectrum message to engine input. Returns { text } for text
 * content, { imageDataUrl } for image/* attachments, or null to skip.
 * `read()` is only called for image attachments — bytes never leave memory.
 */
async function messageToEngineInput(message) {
  const content = message.content || {};
  if (content.type === 'text' && typeof content.text === 'string') {
    return { text: content.text };
  }
  if (content.type === 'attachment' && /^image\//i.test(content.mimeType || '')) {
    const buf = Buffer.from(await content.read());
    return { imageDataUrl: `data:${content.mimeType};base64,${buf.toString('base64')}` };
  }
  return null;
}

/** Send engine intents into a space, in order. `sdk` supplies { attachment, richlink }. */
async function renderIntents(space, intents, sdk) {
  for (const intent of intents) {
    if (intent.type === 'card') {
      await space.send(sdk.attachment(new URL(intent.cardImageUrl)));
      await space.send(sdk.richlink(intent.cardUrl));
    } else if (intent.type === 'link') {
      await space.send(sdk.richlink(intent.url));
    } else {
      await space.send(intent.text);
    }
  }
}

async function handleMessage(space, message, sdk) {
  if (message.direction === 'outbound') return;
  if (message.platform !== 'imessage') return;
  if (!(await claimMessage(message.id))) return;

  const chatId = `spectrum:${space.id}`;
  const input = await messageToEngineInput(message);
  if (!input) return;

  if (input.imageDataUrl) {
    // Typing indicator while the judge works — deliberate on-camera beat.
    await space.responding(async () => {
      const intents = await engine.handleInbound({ chatId, imageDataUrl: input.imageDataUrl });
      await renderIntents(space, intents, sdk);
    });
    return;
  }

  const intents = await engine.handleInbound({ chatId, text: input.text });
  await renderIntents(space, intents, sdk);
}

/**
 * Serialise work per key across parallel callers: tasks for the same key run
 * in order; different keys run concurrently. `chains` maps key → tail promise
 * and is cleaned up when the tail settles.
 */
function enqueueSerial(chains, key, task) {
  const prev = chains.get(key) || Promise.resolve();
  const next = prev.then(() => task());
  chains.set(key, next);
  next.finally(() => {
    if (chains.get(key) === next) chains.delete(key);
  });
  return next;
}

async function main() {
  if (!process.env.SPECTRUM_PROJECT_ID || !process.env.SPECTRUM_PROJECT_SECRET) {
    logger.error('spectrum-runway: SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET are required', { component: 'spectrum-runway' });
    process.exit(1);
  }

  // spectrum-ts is ESM-only; this worker is CJS like the rest of apps/api.
  const sdk = await import('spectrum-ts');
  const { imessage } = await import('spectrum-ts/providers/imessage');

  const app = await sdk.Spectrum({ providers: [imessage.config()] });
  logger.info('spectrum-runway: listening', { component: 'spectrum-runway' });

  const stop = async () => {
    try {
      await app.stop();
    } finally {
      process.exit(0);
    }
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);

  // Per-space serial chains: one chat's slow judging never blocks another's.
  const chains = new Map();
  for await (const [space, message] of app.messages) {
    enqueueSerial(chains, space.id, async () => {
      try {
        await handleMessage(space, message, sdk);
      } catch (err) {
        logger.warn('spectrum-runway: message handling failed', {
          component: 'spectrum-runway',
          sender: maskSender(message.sender),
          error: err.message,
        });
      }
    });
  }
}

if (require.main === module) {
  main().catch((err) => {
    logger.error('spectrum-runway: fatal', { component: 'spectrum-runway', error: err.message });
    process.exit(1);
  });
}

module.exports = { claimMessage, messageToEngineInput, renderIntents, handleMessage, enqueueSerial, maskSender };
