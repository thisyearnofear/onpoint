/**
 * Curator Apply Route — /api/curator/apply
 *
 * Self-serve profile creation for new Curators (ADR 0002).
 * A curator submits their name, slug, WhatsApp number, verticals,
 * and optional brand info — and gets a Neon row + storefront URL back.
 *
 * Rate-limited (10/hour per IP). No API key required — curators
 * should not need one to sign up.
 *
 * Response:
 *   201 - curator created
 *   409 - slug already exists
 *   400 - validation error
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq } = require('drizzle-orm');
const { curators } = require('@repo/db');
const logger = require('../lib/logger');

const router = express.Router();

// ── Database connection (lazy singleton — created once, reused for all requests) ──

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
let _sql = null;

function getDb() {
  if (!_sql) {
    if (!CONNECTION_STRING) {
      throw new Error('NEON_DATABASE_URL not configured');
    }
    _sql = neon(CONNECTION_STRING);
  }
  return { sql: _sql, db: drizzle(_sql, { schema: { curators } }) };
}

// ── Validation ────────────────────────────────────────────────

const VALID_VERTICALS = [
  'football', 'sportswear', 'premier-league',
  'streetwear', 'sneakers',
  'formal', 'occasion',
  'sustainable', 'outdoor',
  'high-fashion', 'experimental',
  'runway', 'luxury',
  'retro', 'tailoring',
  'ankara', 'african-print',
  'vintage', 'thrift',
  'hair', 'barber',
  'accessories', 'jewelry',
];

function validate(body) {
  const errors = [];

  // Normalize
  if (body.slug && typeof body.slug === 'string') {
    body.slug = body.slug.toLowerCase().trim();
  }
  if (body.name && typeof body.name === 'string') {
    body.name = body.name.trim();
  }
  if (body.whatsapp && typeof body.whatsapp === 'string') {
    body.whatsapp = body.whatsapp.trim();
  }

  // Required: slug
  if (!body.slug || typeof body.slug !== 'string') {
    errors.push('slug (string) is required');
  } else if (!/^[a-z0-9-]{2,48}$/.test(body.slug)) {
    errors.push('slug must be 2-48 chars, lowercase alphanumeric + hyphens');
  }

  // Required: name
  if (!body.name || typeof body.name !== 'string') {
    errors.push('name (string) is required');
  } else if (body.name.length > 100) {
    errors.push('name must be 100 chars or fewer');
  }

  // Optional: whatsapp (E.164)
  if (body.whatsapp && !/^\+[1-9]\d{6,14}$/.test(body.whatsapp)) {
    errors.push('whatsapp must be in E.164 format (e.g. +254712345678)');
  }

  // Optional: walletAddress — Celo payout wallet; enables agent checkout
  if (body.walletAddress && typeof body.walletAddress === 'string') {
    body.walletAddress = body.walletAddress.trim();
  }
  if (body.walletAddress && !/^0x[0-9a-fA-F]{40}$/.test(body.walletAddress)) {
    errors.push('walletAddress must be a valid 0x address (Celo wallet for cUSD payouts)');
  }

  // Optional: verticals — warn about unknown ones but don't reject
  if (body.verticals) {
    if (!Array.isArray(body.verticals)) {
      errors.push('verticals must be an array of strings');
    } else {
      const unknown = body.verticals.filter(v => !VALID_VERTICALS.includes(v));
      if (unknown.length > 0) {
        // Log but don't reject — accept any string as a tag
        logger.info('Unknown verticals submitted', { component: 'curator-apply', verticals: unknown.join(', ') });
      }
    }
  }

  // Optional: brand
  if (body.brand) {
    if (typeof body.brand !== 'object' || Array.isArray(body.brand)) {
      errors.push('brand must be an object');
    } else {
      if (body.brand.colors?.primary && typeof body.brand.colors.primary !== 'string') {
        errors.push('brand.colors.primary must be a string (hex color)');
      }
      if (body.brand.colors?.accent && typeof body.brand.colors.accent !== 'string') {
        errors.push('brand.colors.accent must be a string (hex color)');
      }
    }
  }

  return errors.length ? errors.join('; ') : null;
}

// ── POST /api/curator/apply ──────────────────────────────────

router.post('/', async (req, res) => {
  // Validate + normalize first (avoids initializing DB for bad requests)
  const validationError = validate(req.body);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  // Get DB connection (lazy singleton — initialized once)
  let sql, db;
  try {
    ({ sql, db } = getDb());
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-apply' });
    return res.status(503).json({
      error: 'Database not configured',
      message: 'The server is not connected to a database. Contact the platform team.',
    });
  }

  const { slug, name, whatsapp, verticals, brand, walletAddress } = req.body;

  try {
    // Insert with ON CONFLICT DO NOTHING — handles the race condition
    // where two requests try to create the same slug simultaneously.
    const result = await db
      .insert(curators)
      .values({
        slug,
        name,
        type: 'human',
        verticals: verticals || ['football'],
        channels: {
          ...(whatsapp ? { whatsapp } : {}),
        },
        brand: brand || {
          colors: { primary: '#1a1a2e', accent: '#e94560' },
          location: { city: '', landmark: '' },
        },
        commerce: {
          checkout: 'whatsapp',
          revShare: 0.05,
          ...(walletAddress ? { walletAddress } : {}),
        },
      })
      .onConflictDoNothing();

    // If rowCount is 0, the slug already existed
    if (!result.rowCount || result.rowCount === 0) {
      return res.status(409).json({
        error: 'Slug already taken',
        message: `The slug "${slug}" is already registered. Visit https://onpoint.famile.xyz/s/${slug} or choose a different slug.`,
      });
    }

    const storefrontUrl = `https://onpoint.famile.xyz/s/${slug}`;

    logger.info('Curator created', { component: 'curator-apply', slug });

    // Deploy a 0xSplits SplitV2 for non-custodial payouts if the curator
    // provided a wallet address. Fire-and-forget — the curator doesn't
    // wait for the on-chain tx. The split address is persisted to
    // commerce.splitAddress once deployed.
    if (walletAddress) {
      const { deployCuratorSplit } = require('../lib/split-setup');
      deployCuratorSplit(walletAddress, 0.05)
        .then(async ({ splitAddress, txHash }) => {
          try {
            const db2 = getDb();
            // Read current commerce, merge splitAddress, write back
            const [row] = await db2.select().from(curators).where(eq(curators.slug, slug)).limit(1);
            if (row) {
              const updatedCommerce = { ...row.commerce, splitAddress, splitTxHash: txHash };
              await db2.update(curators).set({ commerce: updatedCommerce }).where(eq(curators.slug, slug));
              logger.info('Split address saved for curator', {
                component: 'curator-apply', slug, splitAddress,
              });
            }
          } catch (updateErr) {
            logger.error('Failed to save split address', { component: 'curator-apply', slug }, updateErr);
          }
        })
        .catch((splitErr) => {
          logger.error('Split deployment failed — curator will use fallback custodial payout', {
            component: 'curator-apply', slug,
          }, splitErr);
        });
    }

    res.status(201).json({
      success: true,
      curator: {
        slug,
        name,
        type: 'human',
        verticals: verticals || ['football'],
        channels: whatsapp ? { whatsapp } : {},
        brand: brand || {
          colors: { primary: '#1a1a2e', accent: '#e94560' },
        },
      },
      storefrontUrl,
      nextSteps: [
        'Add inventory by sending a WhatsApp message to our agent',
        `Visit ${storefrontUrl} to see your storefront`,
        'Share the link with your customers!',
        walletAddress
          ? 'Agent checkout is enabled — AI agents can buy from your storefront and you earn cUSD on Celo. A non-custodial split contract is being deployed for your payouts.'
          : 'Add a Celo wallet address to enable agent checkout and earn cUSD when AI agents buy from you',
      ],
    });
  } catch (err) {
    logger.error('Failed to create curator', { component: 'curator-apply', slug }, err);
    res.status(500).json({ error: 'Failed to create curator profile' });
  }
});

module.exports = router;
