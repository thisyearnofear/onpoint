/**
 * WhatsApp Agent Route — /api/agent/whatsapp/*
 *
 * HTTP wrapper around the whatsapp-ingest pipeline for testing and
 * debugging. The primary consumer is the Spectrum-ts agent server
 * (running on Hetzner under PM2), but this route allows you to
 * test the pipeline end-to-end via curl or Postman.
 *
 * Auth: SERVICE_API_KEY (internal service)
 * Body limit: 10MB (for image data relay — though in normal flow
 *   the image is downloaded server-side from Meta's API)
 *
 * Endpoints:
 *   POST /api/agent/whatsapp/ingest — Ingest a WhatsApp media
 *     Body: {
 *       mediaId: string,       // Meta media object ID
 *       curatorSlug: string,   // e.g. "wanja"
 *       club: string,          // e.g. "Arsenal"
 *       kitType: string,       // e.g. "home"
 *       size: string,          // e.g. "M"
 *       price: number,         // e.g. 2500
 *       qty: number            // e.g. 4
 *       accessToken?: string   // override WA_ACCESS_TOKEN env var
 *     }
 *     Response 200: { success, listing, r2Key, storefrontUrl }
 *
 *   GET  /api/agent/whatsapp/health — Check that env is configured
 *
 * @module agent-whatsapp
 */

const express = require('express');
const router = express.Router();
const { ingestMedia } = require('../lib/whatsapp-ingest');
const logger = require('../lib/logger');

/**
 * GET /api/agent/whatsapp/health — Check WhatsApp ingest readiness.
 */
router.get('/health', (req, res) => {
  const checks = {
    waAccessToken: !!process.env.WA_ACCESS_TOKEN,
    waPhoneNumberId: !!process.env.WA_PHONE_NUMBER_ID,
    r2AccountId: !!process.env.R2_ACCOUNT_ID,
    r2AccessKeyId: !!process.env.R2_ACCESS_KEY_ID,
    r2SecretAccessKey: !!process.env.R2_SECRET_ACCESS_KEY,
    r2BucketName: !!process.env.R2_BUCKET_NAME,
    neonDatabaseUrl: !!process.env.NEON_DATABASE_URL,
    storeUrl: !!process.env.STORE_URL,
  };

  const allOk = Object.values(checks).every(Boolean);

  res.json({
    status: allOk ? 'ready' : 'incomplete',
    checks,
    timestamp: Date.now(),
  });
});

/**
 * POST /api/agent/whatsapp/ingest — Run the full ingest pipeline.
 *
 * Validates input, then delegates to the ingestMedia library function.
 * Returns 200 with result or 400/500 on failure.
 */
router.post('/ingest', async (req, res) => {
  const {
    mediaId,
    curatorSlug,
    club,
    kitType,
    size,
    price,
    qty,
    accessToken,
  } = req.body || {};

  // ── Client-side validation (fast fail) ────────────────────
  const errors = [];
  if (!mediaId || typeof mediaId !== 'string') errors.push('mediaId (string) is required');
  if (!curatorSlug || typeof curatorSlug !== 'string') errors.push('curatorSlug (string) is required');
  if (!club || typeof club !== 'string') errors.push('club (string) is required');
  if (!kitType || typeof kitType !== 'string') errors.push('kitType (string) is required');
  if (!size || typeof size !== 'string') errors.push('size (string) is required');
  if (price == null || isNaN(Number(price))) errors.push('price (number) is required');
  if (qty == null || isNaN(Number(qty))) errors.push('qty (number) is required');

  if (errors.length > 0) {
    return res.status(400).json({ success: false, error: errors.join('; ') });
  }

  try {
    const result = await ingestMedia({
      mediaId,
      curatorSlug,
      club,
      kitType,
      size,
      price: Number(price),
      qty: Number(qty),
      accessToken,
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    return res.json(result);
  } catch (err) {
    logger.error('WhatsApp ingest pipeline crashed', {
      component: 'agent-whatsapp',
      mediaId,
      curatorSlug,
    }, err);

    return res.status(500).json({
      success: false,
      error: `Ingest pipeline error: ${err.message}`,
    });
  }
});

module.exports = router;
