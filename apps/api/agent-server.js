#!/usr/bin/env node
/**
 * onpoint-agent-server — Spectrum-ts Agent Server (ADR 0002)
 *
 * Runs alongside the API server on Hetzner under PM2. Listens for
 * incoming WhatsApp messages from Curators via Meta's webhook, parses
 * commands, and orchestrates the WhatsApp photo ingest pipeline.
 *
 * Architecture:
 *   onpoint-agent-server  (PM2 process, port 48753, this file)
 *   ├── /health            — PM2 health check
 *   ├── /meta-webhook (GET) — Meta webhook verification
 *   ├── /meta-webhook (POST) — Incoming WhatsApp messages
 *   └── Spectrum-ts        — Terminal provider (dev) / WhatsApp provider (future)
 *
 * Required env vars (set via shared/api/.env on Hetzner):
 *   WA_ACCESS_TOKEN         — Meta WhatsApp Business API token
 *   WA_PHONE_NUMBER_ID      — WhatsApp Business phone number ID
 *   WA_APP_SECRET           — Meta app secret for webhook verification
 *   NEON_DATABASE_URL       — Postgres connection string
 *   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
 *   STORE_URL               — Base URL for storefront links (default: https://onpoint.famile.xyz)
 *
 * Optional:
 *   AGENT_PORT              — Port (default: 48753)
 *   SERVICE_API_KEY         — For calling internal API endpoints
 *   SPECTRUM_PROJECT_ID     — Spectrum-ts project ID (for terminal/WhatsApp provider)
 *   SPECTRUM_PROJECT_SECRET — Spectrum-ts project secret
 *
 * References:
 *   ADR 0002: docs/adr/0002-curator-primitive.md
 *   ADR 0003: docs/adr/0003-storage-strategy.md
 */

require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, and } = require('drizzle-orm');
const { curators, listings, kitSkus } = require('@repo/db');
const { parseCommand, formatHelp } = require('@repo/messaging-bridge');
const { ingestMedia } = require('./lib/whatsapp-ingest');
const logger = require('./lib/logger');

// ── Configuration ──────────────────────────────────────────────

const PORT = parseInt(process.env.AGENT_PORT) || 48753;
const META_API_VERSION = 'v21.0';
const META_BASE = `https://graph.facebook.com/${META_API_VERSION}`;
const STORE_URL = (process.env.STORE_URL || 'https://onpoint.famile.xyz').replace(/\/$/, '');

// ── Lazy Neon Connection ──────────────────────────────────────

let _sql = null;
let _db = null;

function getDb() {
  if (!_sql) {
    const url = process.env.NEON_DATABASE_URL;
    if (!url) throw new Error('NEON_DATABASE_URL not configured');
    _sql = neon(url);
    _db = drizzle(_sql, { schema: { curators, listings, kitSkus } });
  }
  return { sql: _sql, db: _db };
}

// ── Meta WhatsApp API Helpers ──────────────────────────────────

/**
 * Send a text message via Meta WhatsApp Business API.
 *
 * @param {string} to   — Recipient's WhatsApp ID (E.164, no +)
 * @param {string} body — Message text (4096 char limit)
 * @returns {Promise<object>} Meta API response
 */
async function sendWhatsAppMessage(to, body) {
  const token = process.env.WA_ACCESS_TOKEN;
  const phoneNumberId = process.env.WA_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error('WA_ACCESS_TOKEN and WA_PHONE_NUMBER_ID must be configured');
  }

  const url = `${META_BASE}/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: body.substring(0, 4096) },
    }),
    signal: AbortSignal.timeout(15000),
  });

  const result = await res.json().catch(() => ({}));

  if (!res.ok) {
    logger.error('WhatsApp send failed', {
      component: 'agent-server',
      to,
      status: res.status,
      error: result.error || result,
    });
    throw new Error(`WhatsApp API error (${res.status}): ${result.error?.message || res.statusText}`);
  }

  logger.info('WhatsApp message sent', {
    component: 'agent-server',
    to,
    messageId: result.messages?.[0]?.id,
  });

  return result;
}

/**
 * Handle Meta webhook verification (GET /meta-webhook).
 *
 * Meta sends a GET with hub.mode, hub.verify_token, hub.challenge
 * when setting up or renewing the webhook subscription. We respond
 * with the challenge if the verify_token matches WA_APP_SECRET.
 */
function handleWebhookVerification(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WA_APP_SECRET) {
    logger.info('Webhook verified by Meta', { component: 'agent-server' });
    return res.status(200).send(challenge);
  }

  logger.warn('Webhook verification failed', {
    component: 'agent-server',
    mode,
    tokenMatch: token === process.env.WA_APP_SECRET,
  });

  return res.status(403).send('Verification failed');
}

// ── Command Handlers ───────────────────────────────────────────

/**
 * Resolve the curator slug from a WhatsApp sender ID.
 *
 * Queries the curators table where channels->>whatsapp matches
 * the sender's phone number in E.164 format (with +).
 */
async function resolveCuratorFromNumber(from) {
  const { db, sql } = getDb();

  // The `from` comes from Meta without the `+` prefix, but we store
  // it with the `+` in the database. Try both.
  const withPlus = from.startsWith('+') ? from : `+${from}`;

  const [curator] = await db
    .select()
    .from(curators)
    .where(
      sql`${curators.channels}->>'whatsapp' IN (${from}, ${withPlus})`,
    )
    .limit(1);

  return curator || null;
}

/**
 * Handle an incoming message from a Curator.
 *
 * Flow:
 *   1. Resolve Curator from sender phone number
 *   2. Parse the text command
 *   3. Route to the appropriate handler
 *   4. Send response via WhatsApp
 *
 * @param {object} params
 * @param {string} params.from       — Sender's WhatsApp ID (E.164, without +)
 * @param {string} [params.text]     — Message text body
 * @param {string} [params.mediaId]  — Meta media object ID (if image attached)
 * @param {string} [params.timestamp]— Message timestamp
 */
async function handleMessage({ from, text, mediaId }) {
  const displayFrom = from.startsWith('+') ? from : `+${from}`;

  // ── Step 1: Resolve Curator ─────────────────────────────────
  let curator;
  try {
    curator = await resolveCuratorFromNumber(from);
  } catch (err) {
    logger.error('Failed to resolve curator', { component: 'agent-server', from }, err);
    return;
  }

  if (!curator) {
    logger.warn('Message from unknown sender', { component: 'agent-server', from });
    try {
      // Tell the sender they're not registered as a Curator
      await sendWhatsAppMessage(
        from,
        `Hi! This is the OnPoint agent bot. It looks like you're not registered as a Curator yet.\n\n` +
        `To get started, sign up at: ${STORE_URL}/curator/onboard\n\n` +
        `If you think this is a mistake, reply with "help" for available commands.`,
      );
    } catch (err) {
      logger.error('Failed to notify unknown sender', { component: 'agent-server', from }, err);
    }
    return;
  }

  // ── Step 2: Parse command ───────────────────────────────────
  const parsed = text ? parseCommand(text) : { type: 'unknown', text: '' };

  logger.info('Handling message', {
    component: 'agent-server',
    curator: curator.slug,
    from,
    command: parsed.type,
    hasMedia: !!mediaId,
  });

  // ── Step 3: Route command ──────────────────────────────────
  try {
    switch (parsed.type) {
      case 'add_stock':
        await handleAddStock(curator, parsed, mediaId, from);
        break;
      case 'remove_stock':
        await handleRemoveStock(curator, parsed, from);
        break;
      case 'stock_check':
        await handleStockCheck(curator, from);
        break;
      case 'get_link':
        await handleGetLink(curator, parsed, from);
        break;
      case 'help':
        await sendWhatsAppMessage(from, formatHelp(curator.slug));
        break;
      default:
        await sendWhatsAppMessage(
          from,
          `👋 Hi ${curator.name}! I didn't understand that command.\n\n` +
          formatHelp(curator.slug),
        );
        break;
    }
  } catch (err) {
    logger.error('Command handler failed', {
      component: 'agent-server',
      curator: curator.slug,
      command: parsed.type,
    }, err);

    try {
      await sendWhatsAppMessage(
        from,
        `❌ Sorry, something went wrong processing your request: ${err.message.substring(0, 200)}.\n\nReply with "help" to see available commands.`,
      );
    } catch (sendErr) {
      logger.error('Failed to send error notification', {
        component: 'agent-server',
        curator: curator.slug,
      }, sendErr);
    }
  }
}

/**
 * Handle `+ <club> <kitType> <size> <price> <qty>` + photo.
 */
async function handleAddStock(curator, parsed, mediaId, from) {
  if (!mediaId) {
    await sendWhatsAppMessage(
      from,
      `📸 Please attach a photo of the item when adding stock.\n\n` +
      `Example: send a photo of the kit with the caption:\n` +
      `\`+ ${parsed.club} ${parsed.kitType} ${parsed.size} ${parsed.price} ${parsed.qty}\``,
    );
    return;
  }

  // Run the ingest pipeline
  const result = await ingestMedia({
    mediaId,
    curatorSlug: curator.slug,
    club: parsed.club,
    kitType: parsed.kitType,
    size: parsed.size,
    price: parsed.price,
    qty: parsed.qty,
  });

  if (!result.success) {
    await sendWhatsAppMessage(from, `❌ ${result.error}`);
    return;
  }

  const verb = result.isNew ? '✅ *New listing created*' : '✅ *Listing updated*';
  const clubLabel = result.listing?.kit?.club || parsed.club;
  const kitLabel = result.listing?.kit?.kitType || parsed.kitType;

  await sendWhatsAppMessage(
    from,
    `${verb}\n\n` +
    `📦 *${clubLabel} — ${kitLabel}*\n` +
    `Size: ${parsed.size} — ${parsed.qty} units @ KSh ${parsed.price}\n\n` +
    `🔗 Share this with your customer:\n` +
    `${result.storefrontUrl}`,
  );
}

/**
 * Handle `- <club> <kitType> <size>` — remove stock.
 */
async function handleRemoveStock(curator, parsed, from) {
  const { db, sql } = getDb();

  // Normalise for fuzzy matching
  const clubSlug = parsed.club
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');

  // Find the listing via SKU join
  const [listing] = await db
    .select({
      id: listings.id,
      sizes: listings.sizes,
      skuId: kitSkus.id,
      club: kitSkus.club,
      kitType: kitSkus.kitType,
    })
    .from(listings)
    .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .where(
      and(
        eq(listings.curatorSlug, curator.slug),
        sql`${kitSkus.id} LIKE ${`${clubSlug}-%`}`,
        sql`LOWER(${kitSkus.kitType}) = ${parsed.kitType.toLowerCase()}`,
      ),
    )
    .limit(1);

  if (!listing) {
    await sendWhatsAppMessage(
      from,
      `❌ No listing found for "${parsed.club} ${parsed.kitType}".\n\n` +
      `Use \`stock\` to see your current inventory.`,
    );
    return;
  }

  // Find and remove the size from sizes array
  const currentSizes = Array.isArray(listing.sizes) ? listing.sizes : [];
  const sizeLower = parsed.size.toLowerCase();
  const sizeIndex = currentSizes.findIndex(
    (s) => s.size && s.size.toLowerCase() === sizeLower,
  );

  if (sizeIndex < 0) {
    await sendWhatsAppMessage(
      from,
      `❌ Size "${parsed.size}" not found for "${listing.club} ${listing.kitType}".\n\n` +
      `Use \`stock\` to see available sizes.`,
    );
    return;
  }

  const newSizes = [...currentSizes];
  newSizes.splice(sizeIndex, 1);

  // Update sizes — if none left, archive the listing
  const status = newSizes.length === 0 ? 'archived' : 'live';

  await db
    .update(listings)
    .set({
      sizes: newSizes,
      status,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(listings.id, listing.id));

  logger.info('Stock removed', {
    component: 'agent-server',
    curator: curator.slug,
    listingId: listing.id,
    size: parsed.size,
    remainingSizes: newSizes.length,
    status,
  });

  if (newSizes.length === 0) {
    await sendWhatsAppMessage(
      from,
      `🗑️ Removed "${parsed.size}" from *${listing.club} — ${listing.kitType}*.\n` +
      `Listing archived (no sizes remaining).\n\n` +
      `Add stock again with:\n` +
      `\`+ ${parsed.club} ${parsed.kitType} ${parsed.size} <price> <qty>\` + photo`,
    );
  } else {
    await sendWhatsAppMessage(
      from,
      `🗑️ Removed size "${parsed.size}" from *${listing.club} — ${listing.kitType}*.\n` +
      `${newSizes.length} size(s) remaining.\n\n` +
      `Use \`stock\` to see current inventory.`,
    );
  }
}

/**
 * Handle `stock` — show live inventory.
 */
async function handleStockCheck(curator, from) {
  const { db } = getDb();

  const rows = await db
    .select({
      id: listings.id,
      sizes: listings.sizes,
      status: listings.status,
      club: kitSkus.club,
      kitType: kitSkus.kitType,
      season: kitSkus.season,
    })
    .from(listings)
    .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .where(
      and(
        eq(listings.curatorSlug, curator.slug),
        eq(listings.status, 'live'),
      ),
    )
    .orderBy(kitSkus.club, kitSkus.kitType);

  if (rows.length === 0) {
    await sendWhatsAppMessage(
      from,
      `📦 *Your Inventory* — empty\n\n` +
      `No live listings yet. Add your first item:\n` +
      `Send a photo with the caption:\n` +
      `\`+ arsenal home M 2500 4\``,
    );
    return;
  }

  // Build a formatted inventory text
  const lines = ['📦 *Your Inventory*', ''];
  let totalSkuCount = 0;

  for (const row of rows) {
    const sizes = Array.isArray(row.sizes) ? row.sizes : [];
    if (sizes.length === 0) continue;

    totalSkuCount++;
    const emoji = getClubEmoji(row.club);
    lines.push(`${emoji} *${row.club} — ${capitalize(row.kitType)}*`);

    for (const s of sizes) {
      lines.push(`  ${s.size}: ${s.stock} units @ KSh ${s.price.toLocaleString()}`);
    }
    lines.push('');
  }

  lines.push(`Total: ${totalSkuCount} item(s)`);
  lines.push(`Storefront: ${STORE_URL}/s/${curator.slug}`);

  await sendWhatsAppMessage(from, lines.join('\n').trim());
}

/**
 * Handle `link <club> <kitType>` — get a shareable storefront URL.
 */
async function handleGetLink(curator, parsed, from) {
  const { db, sql } = getDb();

  const clubSlug = parsed.club
    .toLowerCase()
    .replace(/[^a-z0-9\s-]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '');

  const [row] = await db
    .select({
      id: listings.id,
      club: kitSkus.club,
      kitType: kitSkus.kitType,
      season: kitSkus.season,
    })
    .from(listings)
    .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .where(
      and(
        eq(listings.curatorSlug, curator.slug),
        sql`${kitSkus.id} LIKE ${`${clubSlug}-%`}`,
        sql`LOWER(${kitSkus.kitType}) = ${parsed.kitType.toLowerCase()}`,
      ),
    )
    .limit(1);

  if (!row) {
    await sendWhatsAppMessage(
      from,
      `❌ No listing found for "${parsed.club} ${parsed.kitType}".\n\n` +
      `Use \`stock\` to see your current inventory.`,
    );
    return;
  }

  const shareUrl = `${STORE_URL}/s/${curator.slug}`;

  await sendWhatsAppMessage(
    from,
    `🔗 *${row.club} — ${capitalize(row.kitType)}*\n\n` +
    `Share this link with your customer:\n${shareUrl}\n\n` +
    `They can try on the kit, get a polaroid, and order directly via WhatsApp.`,
  );
}

// ── Helpers ────────────────────────────────────────────────────

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getClubEmoji(club) {
  // Simple emoji map for common PL clubs
  const emojiMap = {
    'Arsenal': '🔴',
    'Aston Villa': '🟣',
    'Bournemouth': '🍒',
    'Brentford': '🐝',
    'Brighton': '⚪',
    'Chelsea': '🔵',
    'Crystal Palace': '🦅',
    'Everton': '🔷',
    'Fulham': '⚫',
    'Ipswich': '🔵',
    'Leicester': '🦊',
    'Liverpool': '🔴',
    'Manchester City': '💙',
    'Manchester United': '🔴',
    'Newcastle': '⚫',
    'Nottingham Forest': '🌳',
    'Southampton': '🔴',
    'Tottenham': '⚪',
    'West Ham': '🟣',
    'Wolves': '🐺',
  };
  return emojiMap[club] || '🇰🇪';
}

// ── Express App ────────────────────────────────────────────────

const app = express();

// Meta webhook verification (GET) needs query params, not body parsing
app.get('/meta-webhook', handleWebhookVerification);

// Body parser for webhook POST (small limit — just JSON metadata)
app.post('/meta-webhook', express.json({ limit: '1kb' }), async (req, res) => {
  // Acknowledge immediately — Meta expects a 200 within 20s
  // Processing happens asynchronously
  res.status(200).send('OK');

  try {
    const body = req.body;

    // Validate this is a WhatsApp business account webhook
    if (body.object !== 'whatsapp_business_account') {
      return;
    }

    for (const entry of body.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value;

        if (value.messaging_product !== 'whatsapp') continue;

        for (const message of value.messages || []) {
          // Skip status updates
          if (message.type === 'button' || message.type === 'interactive') continue;
          if (message.type === 'text' && !message.text?.body?.trim()) continue;

          const from = message.from; // E.164 without +
          const text = message.text?.body?.trim() || '';
          const mediaId = message.image?.id ||
                          message.video?.id ||
                          message.document?.id ||
                          message.audio?.id ||
                          null;

          // Process asynchronously (don't await — we already responded 200)
          handleMessage({ from, text, mediaId }).catch((err) => {
            logger.error('Async message handler failed', {
              component: 'agent-server',
              from,
            }, err);
          });
        }
      }
    }
  } catch (err) {
    logger.error('Webhook POST handler error', { component: 'agent-server' }, err);
  }
});

// Health check for PM2
app.get('/health', (req, res) => {
  res.json({
    status: 'running',
    service: 'onpoint-agent-server',
    pid: process.pid,
    uptime: process.uptime(),
    config: {
      port: PORT,
      metaApi: !!process.env.WA_ACCESS_TOKEN && !!process.env.WA_PHONE_NUMBER_ID,
      neon: !!process.env.NEON_DATABASE_URL,
      r2: !!process.env.R2_ACCOUNT_ID && !!process.env.R2_ACCESS_KEY_ID && !!process.env.R2_SECRET_ACCESS_KEY,
      storeUrl: STORE_URL,
    },
    timestamp: Date.now(),
  });
});

// ── Start Server ───────────────────────────────────────────────

app.listen(PORT, '127.0.0.1', () => {
  logger.info('onpoint-agent-server started', {
    component: 'agent-server',
    port: PORT,
    metaApiConfigured: !!process.env.WA_ACCESS_TOKEN && !!process.env.WA_PHONE_NUMBER_ID,
    neonConfigured: !!process.env.NEON_DATABASE_URL,
    r2Configured: !!process.env.R2_ACCOUNT_ID,
  });
});

// ── Graceful Shutdown ─────────────────────────────────────────

let shuttingDown = false;

async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Agent server shutting down (${signal})`, { component: 'agent-server' });

  // Give in-flight webhook handlers time to finish
  await new Promise((resolve) => setTimeout(resolve, 2000));

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
