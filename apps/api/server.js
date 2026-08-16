/**
 * OnPoint API Server — v2.1.0
 *
 * Consolidated backend for all AI and agent routes.
 * Runs on Hetzner VPS via PM2.
 *
 * Architecture (ADR 0001):
 *   Vercel = presentation + identity
 *   Hetzner = AI + agent state + signer (future)
 *
 * Ports: 48751 (API), 48752 (Bridge), 48753 (Agent server), 48755 (Signer)
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const express = require('express');
const Redis = require('ioredis');

// PM2 runs from /opt/onpoint while releases live under /opt/onpoint/releases.
// Load the release-local shared env symlink explicitly. Fill empty PM2
// placeholders (for example AGENT_WALLET_ADDRESS: ''), but preserve explicit
// runtime values such as the isolated preflight PORT or PM2's PORT.
const releaseEnvPath = path.join(__dirname, '.env');
if (fs.existsSync(releaseEnvPath)) {
  const releaseEnv = dotenv.parse(fs.readFileSync(releaseEnvPath));
  for (const [key, value] of Object.entries(releaseEnv)) {
    if (!process.env[key]) process.env[key] = value;
  }
} else if (process.env.NODE_ENV !== 'production') {
  // Local development only: use the conventional cwd .env.
  dotenv.config();
}

// ── Sentry (optional, if SENTRY_DSN is configured) ──
let Sentry;
if (process.env.SENTRY_DSN) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'production',
    release: process.env.SENTRY_RELEASE || `onpoint-api@${process.env.npm_package_version || '2.1.0'}`,
    tracesSampleRate: 0.1,
  });
  console.log('[Sentry] Initialized');
}

// Initialize Express
const app = express();

// Sentry request handler (must be first middleware)
if (Sentry) {
  app.use(Sentry.Handlers.requestHandler());
}

// ── Static files (digital garment images) ────────────────────────
// Uses shared directory so images survive releases without re-upload.
const digitalGarmentsPath = process.env.NODE_ENV === 'production' ? '/opt/onpoint/shared/api/public/digital-garments' : 'public/digital-garments';
app.use(
  '/digital-garments',
  express.static(digitalGarmentsPath, {
    maxAge: '7d',
    immutable: true,
  }),
);

// ── Per-route body parsing with size limits ──────────────────────
// No global parser — each route group controls its own memory ceiling.
// Prevents body-parser DoS attacks (CVE-2022-24999-style).
const json1k = express.json({ limit: '1kb' });
const json10kb = express.json({ limit: '10kb' });
const json10mb = express.json({ limit: '10mb' });
const raw10kb = express.raw({ type: 'application/json', limit: '10kb' });

// ── Redis ────────────────────────────────────────────────────────
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const redis = new Redis(redisUrl);

redis.on('error', (err) => {
  console.error('[Redis] Connection error:', err.message);
});

redis.on('connect', () => {
  console.log('[Redis] Connected');
});

// ── Inject Redis into the Etherfuse top-up balance store ────────
// This makes top-up credits survive API server restarts.
// If Redis is unavailable, the store falls back to in-memory.
const etherfuse = require('@repo/etherfuse');
etherfuse.setTopUpRedisClient(redis);

// ── Money-config assertion ───────────────────────────────────────
// Fail fast at boot if the agent/platform wallet is not explicitly
// configured in production. Money routes (checkout, purchase, payouts,
// try-on) resolve wallets fail-loud at request time too, but surfacing
// the misconfiguration at startup is far better than discovering it mid-
// purchase. In dev/test this is a no-op (the dev default wallet is used).
const { assertWalletsConfigured } = require('./lib/wallets');
try {
  assertWalletsConfigured();
} catch (walletErr) {
  console.error('[FATAL] Wallet configuration error:', walletErr.message);
  process.exit(1);
}

// ── Middleware ──────────────────────────────────────────────────
const { createRateLimiter } = require('./middleware/rate-limit');
const { createApiKeyAuth } = require('./middleware/api-key-auth');

// Rate limit tiers
const generalRateLimit = createRateLimiter(redis, 'general');
const pravaMutationRateLimit = createRateLimiter(redis, 'general', {
  maxRequests: 60,
  prefix: 'prava-mutation',
});
const pravaStatusRateLimit = createRateLimiter(redis, 'general', {
  maxRequests: 180,
  prefix: 'prava-status',
});
const pravaRateLimit = (req, res, next) => {
  const path = req.originalUrl.split('?')[0];
  const isOrderStatusRead = req.method === 'GET' && /^\/prava\/order\/[^/]+\/?$/.test(path);
  return (isOrderStatusRead ? pravaStatusRateLimit : pravaMutationRateLimit)(req, res, next);
};
const veniceRateLimit = createRateLimiter(redis, 'veniceFree');
const veniceBurstLimit = createRateLimiter(redis, 'veniceBurst');
const liveSessionRateLimit = createRateLimiter(redis, 'liveSession');
const aiExpensiveRateLimit = createRateLimiter(redis, 'aiExpensive');
const aiExpensiveDailyLimit = createRateLimiter(redis, 'aiExpensiveDaily');
const aiAnalysisRateLimit = createRateLimiter(redis, 'aiAnalysis');
const aiAnalysisDailyLimit = createRateLimiter(redis, 'aiAnalysisDaily');

// Auth middleware
const aiAuth = createApiKeyAuth(); // External consumers: require VENICE_API_KEY
const serviceKeyAuth = createServiceApiKeyAuth(); // Internal services: require SERVICE_API_KEY

// Mount serviceKeyAuth on the heartbeat router for POST only
// (The heartbeat router's POST handler checks SERVICE_API_KEY internally)

/**
 * Service-to-service API key auth middleware.
 * Uses SERVICE_API_KEY env var (separate from VENICE_API_KEY).
 */
function createServiceApiKeyAuth() {
  return function serviceAuth(req, res, next) {
    const serviceKey = process.env.SERVICE_API_KEY;

    // If no SERVICE_API_KEY configured, skip auth (dev mode)
    if (!serviceKey) {
      if (process.env.NODE_ENV === 'production') {
        return res.status(500).json({ error: 'SERVICE_API_KEY not configured on server' });
      }
      return next();
    }

    const provided = req.headers['x-service-key'] ?? req.headers['authorization']?.replace('Bearer ', '')?.trim() ?? null;

    if (!provided) {
      return res.status(401).json({
        error: 'Missing service key. Use x-service-key header or Authorization: Bearer <key>.',
      });
    }

    if (provided !== serviceKey) {
      return res.status(403).json({ error: 'Invalid service key' });
    }

    next();
  };
}

// ── Health Check ────────────────────────────────────────────────

app.get('/health', json1k, async (req, res) => {
  let redisStatus = 'disconnected';
  try {
    await redis.ping();
    redisStatus = 'connected';
  } catch {
    /* already disconnected */
  }

  res.json({
    status: 'healthy',
    version: '2.1.0',
    redis: redisStatus,
    venice: !!process.env.VENICE_API_KEY,
    openai: !!process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your_openai_api_key_here',
    gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
    qwenCloud: !!process.env.DASHSCOPE_API_KEY,
    qwenCloudKillSwitch: process.env.QWEN_CLOUD_KILL_SWITCH === '1',
    alibabaOss: !!process.env.ALIBABA_OSS_ACCESS_KEY_ID && !!process.env.ALIBABA_OSS_BUCKET,
    serviceKey: !!process.env.SERVICE_API_KEY,
    agentWallet: !!process.env.AGENT_WALLET_ADDRESS,
    karmaGap: !!process.env.KARMA_GAP_API_KEY,
    infrastructure: {
      bridge: !!process.env.BRIDGE_URL,
      vercel: !!process.env.VERCEL_DOMAIN,
    },
    timestamp: Date.now(),
  });
});

// ── API Status ──────────────────────────────────────────────────

app.get('/api/status', (req, res) => {
  res.json({
    service: 'onpoint-api',
    version: '2.1.0',
    status: 'running',
    port: process.env.PORT || 48751,
    features: ['venice-vision', 'gemini-live', 'qwen-cloud-vision', 'virtual-tryon', 'ai-agent', 'catalog', 'agent-heartbeat', 'agent-proxy', 'karmagap'],
  });
});

// ── AI Routes (external: VENICE_API_KEY auth) ────────────────────
// These are direct implementations on Hetzner.
// Body limit: 10MB (for image data), 1KB (for session mgmt)

app.use('/api/ai/virtual-tryon', json10mb, aiAuth, aiExpensiveRateLimit, aiExpensiveDailyLimit, veniceBurstLimit, require('./routes/ai-virtual-tryon'));
app.use('/api/ai/analyze-person', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, veniceBurstLimit, require('./routes/ai-analyze-person'));
app.use('/api/ai/venice-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, veniceBurstLimit, require('./routes/ai-venice-analyze'));
app.use('/api/ai/replicate-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, require('./routes/ai-replicate-analyze'));
app.use('/api/ai/azure-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, require('./routes/ai-azure-analyze'));
app.use('/api/ai/zerog-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, require('./routes/ai-zerog-analyze'));
app.use('/api/ai/qwen-analyze', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, require('./routes/ai-qwen-analyze'));
app.use('/api/ai/live-session', json1k, aiAuth, liveSessionRateLimit, require('./routes/ai-live-session'));
app.use('/api/ai/agent', json10mb, aiAuth, aiAnalysisRateLimit, aiAnalysisDailyLimit, require('./routes/ai-agent'));

// ── Agent Routes (service-to-service: SERVICE_API_KEY auth) ──────
// Phase 3 (complete): All agent endpoints run directly on Hetzner,
// backed by @repo/agent-core. Public GET endpoints use lighter auth.

// Catalog — public search (rate-limited but no API key needed for reads)
app.use('/api/agent/catalog', json1k, generalRateLimit, require('./routes/catalog'));

// Curated Shop — product curation from bridge (proxied via Next.js rewrites)
app.use('/api/agent/curated-shop', json1k, generalRateLimit, require('./routes/curated-shop'));

// Market Intelligence — product search + retail signal partners
app.use('/api/market-intelligence/search', json1k, generalRateLimit, require('./routes/market-intelligence'));

// Heartbeat — public GET, service-key for POST
app.use('/api/agent/heartbeat', json1k, require('./routes/agent-heartbeat'));

// Dashboard — public read (agent operational state)
app.use('/api/agent/dashboard', json1k, require('./routes/agent-dashboard'));
app.use('/api/receipts', json1k, require('./routes/receipts'));

// Wallet — service-key auth (exposes private wallet info)
app.use('/api/agent/wallet', json1k, serviceKeyAuth, require('./routes/agent-wallet'));

// Identity — public read (agent transparency)
app.use('/api/agent/identity', json1k, require('./routes/agent-identity'));

// Suggestion — service-key + forwarded user (CRUD for agent suggestions)
app.use('/api/agent/suggestion', json10mb, serviceKeyAuth, generalRateLimit, require('./routes/agent-suggestion'));

// Approval — service-key + forwarded user (approval requests)
app.use('/api/agent/approval', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-approval'));

// Style — service-key + forwarded user (style tracking + recommendations)
app.use('/api/agent/style', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-style'));

// Tip — service-key + forwarded user (tipping ledger)
app.use('/api/agent/tip', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-tip'));

// Fraud — service-key + forwarded user (health, freeze, multisig)
app.use('/api/agent/fraud', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-fraud'));

// Mint — service-key + forwarded user (NFT minting)
app.use('/api/agent/mint', json10mb, serviceKeyAuth, require('./routes/agent-mint'));

// Webhook — no API key (Etherfuse signs via HMAC). Uses raw body for signature verification.
app.use('/api/webhooks/etherfuse', raw10kb, require('./routes/agent-topup').webhookRouter);

// TopUp — service-key + forwarded user (Etherfuse fiat onramp)
app.use('/api/agent/topup', json10kb, serviceKeyAuth, generalRateLimit, require('./routes/agent-topup').router);

// Purchase — service-key + forwarded user (product purchases)
app.use('/api/agent/purchase', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-purchase'));

// Checkout — service-key + forwarded user (cart checkout)
app.use('/api/agent/checkout', json1k, serviceKeyAuth, require('./routes/agent-checkout'));

// Tip-Agent — service-key + forwarded user (agent-to-agent tipping)
app.use('/api/agent/tip-agent', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-tip-agent'));

// Metrics — public, Prometheus format
app.use('/api/agent/metrics', json1k, require('./routes/agent-metrics').router);

// Tasks — service-key only (worker task processing)
app.use('/api/agent/tasks', json10kb, serviceKeyAuth, require('./routes/agent-tasks'));

// Escrow — service-key + forwarded user (escrow management)
app.use('/api/agent/escrow', json1k, serviceKeyAuth, require('./routes/agent-escrow'));

// Treasury — service-key + forwarded user (treasury management)
app.use('/api/agent/treasury', json1k, serviceKeyAuth, require('./routes/agent-treasury'));

// KarmaGAP — public read (grant/project discovery)
app.use('/api/karmagap', json1k, generalRateLimit, require('./routes/karmagap'));

// Missions — service-key + forwarded user (gamified challenges)
app.use('/api/agent/missions', json1k, serviceKeyAuth, require('./routes/agent-missions'));

// Schedule-Event — service-key + forwarded user (calendar integration)
app.use('/api/agent/schedule-event', json1k, serviceKeyAuth, require('./routes/agent-schedule-event'));

// ── WhatsApp Ingest (service-to-service) ──────────────────────────
// Internal tool for the Spectrum-ts agent server. Wraps the
// Meta download → R2 upload → Neon listing pipeline.

app.use('/api/agent/whatsapp', json1k, serviceKeyAuth, generalRateLimit, require('./routes/agent-whatsapp'));

// ── Agent Try-On (public, x402-paid — payment IS the auth) ──────
// External agents render a listing on their human before buying.
// Large body limit: the person photo arrives as a base64 data URI.

app.use('/api/agent/try-on', json10mb, aiExpensiveRateLimit, aiExpensiveDailyLimit, require('./routes/agent-tryon'));

// ── OKX A2MCP Facade (x402 on XLayer, relays to Celo backend) ──────
// Paid pay-per-call endpoints that settle in USD₮0 on XLayer so OKX
// Agentic Wallet users can pay without bridging. See routes/okx-facade.js.
app.use('/okx', json10mb, require('./routes/okx-facade'));

// ── Prava iMessage App card (rendered inside the Linq bubble) ─────
// The mutating card HTML keyed by order id. PUBLIC (no service key) — it is
// the card content Linq fetches into the bubble; the order id is an
// unguessable UUID and carries no card data. Mounted BEFORE the /prava
// facade so the facade's service-key auth doesn't gate it. ADR 0017.
app.use('/prava/card', require('./routes/prava-card'));

// ── Prava Sandbox Fallback (REST session flow — live-demo safety net) ─
// session → hosted verification → credential readiness via Prava's REST API.
// It does not synthesize an external checkout or report-status. ADR 0017.
app.use('/prava/sandbox', json1k, require('./routes/prava-sandbox'));

// ── Prava Agent Checkout Facade (Agentic Commerce Hackathon) ──────
// Agent buy-flow rail: discover → quote → scoped-card session → hosted
// verification → server-owned checkout when approved. Drives the Linq iMessage
// card. Self-check mode by default; live via the prava CLI. ADR 0017.
app.use('/prava/order/:id/try-on', aiExpensiveRateLimit, aiExpensiveDailyLimit);
// Body parsing is route-aware inside the facade: ordinary commerce requests
// stay capped at 1 KB, while the explicit try-on endpoint accepts a photo data
// URI up to 10 MB. Applying json1k here made normal image uploads fail before
// the try-on handler could run.
app.use('/prava', pravaRateLimit, require('./routes/prava-facade'));

// ── Linq iMessage Agent (Agentic Commerce Hackathon, Linq track) ───
// Receives Linq iMessage webhooks and orchestrates the buy-flow: inbound
// text → Prava quote+session → hosted authorization → 👍 status refresh →
// server-owned checkout. Mock mode by default. ADR 0017.
app.use('/linq', require('./routes/linq-agent'));

// ── Curator Routes (public, rate-limited) ───────────────────────
// Self-serve curator onboarding (ADR 0002). No API key needed.

app.use('/api/curator/apply', json1k, generalRateLimit, require('./routes/curator-apply'));
app.use('/api/curator', json1k, generalRateLimit, require('./routes/curator-wallet'));
app.use('/api/curator', json1k, generalRateLimit, require('./routes/curator-storefront'));

// ── Referral Routes (public, rate-limited) ──────────────────────
// Agent referral tracking and stats.

app.use('/api/referrals', json1k, generalRateLimit, require('./routes/referrals'));

// ── Agent Looks (public read, agent-authed write) ───────────────
// External agents compose OnPoint listings into shareable style boards.

app.use('/api/looks', json10mb, generalRateLimit, require('./routes/agent-looks'));

// ── Listing Routes (public, rate-limited) ───────────────────────
// Similar physical items for digital listings (digital→physical funnel).

app.use('/api/listings', generalRateLimit, require('./routes/listing-similar'));

// ── Item Routes (public, rate-limited) ────────────────────────────
// Similar marketplace items for look item swapping.

app.use('/api/items', generalRateLimit, require('./routes/items-similar'));

// ── Admin Routes (service-to-service: SERVICE_API_KEY auth) ─────

app.use('/api/admin/curators', json10mb, serviceKeyAuth, generalRateLimit, require('./routes/curator-admin'));

// ── Fulfillment Routes (order lifecycle: ship/deliver/dispute/resolve) ──

app.use('/api/orders', json1k, serviceKeyAuth, require('./routes/fulfillment'));

// ── Cron Routes (worker-triggered, SERVICE_API_KEY auth) ────────

app.use('/api/cron', json1k, serviceKeyAuth, require('./routes/cron-payout'));

// ── Status Dashboard ────────────────────────────────────────────

app.use('/api/status', json1k, require('./routes/status-dashboard'));
app.use('/api/status/funnel', json1k, serviceKeyAuth, require('./routes/funnel-analytics'));

// Convenience alias for the HTML dashboard
app.get('/status-ui', json1k, (req, res) => {
  res.redirect('/api/status/dashboard');
});

// Catch-all for any remaining agent routes (fallback — all routes are ported)
app.use('/api/agent', json10mb, serviceKeyAuth, generalRateLimit, require('./routes/agent'));

// ── 404 Handler ─────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.originalUrl });
});

// ── Sentry Error Handler (must be before our error handler) ────

if (Sentry) {
  app.use(Sentry.Handlers.errorHandler());
}

// ── Error Handler ───────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error('[API Error]', err.message);
  if (process.env.NODE_ENV === 'development') {
    console.error(err.stack);
  }

  if (err.type === 'entity.too.large' || err.status === 413) {
    return res.status(413).json({
      error: 'Uploaded photo is too large. Please choose a smaller image or retake the photo at a lower resolution.',
      code: 'PAYLOAD_TOO_LARGE',
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { detail: err.message } : {}),
  });
});

// ── Start ───────────────────────────────────────────────────────

const PORT = process.env.PORT || 48751;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 OnPoint API v2.1.0 running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Status: http://localhost:${PORT}/api/status`);
  console.log(`   Redis:  ${redisUrl}`);
  console.log(`   Dashboard: http://localhost:${PORT}/status-ui`);
  if (process.env.SENTRY_DSN) {
    console.log(`   Sentry:    enabled (release: onpoint-api@${process.env.npm_package_version || '2.1.0'})`);
  }
  console.log(`   Features: AI Vision, Gemini Live, Virtual Try-On, AI Agent, Catalog, Heartbeat, Dashboard`);
  if (process.env.VERCEL_DOMAIN) {
    console.log(`   Agent proxy → ${process.env.VERCEL_DOMAIN}`);
  }
});

module.exports = app;
