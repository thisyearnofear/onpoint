/**
 * Curator Storefront Route — /api/curator/:slug/storefront
 *
 * Public read endpoint for ADR 0002 storefronts.
 * Returns a Curator profile plus live listings joined to the PL kit backbone.
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const { drizzle } = require('drizzle-orm/neon-http');
const { eq, desc } = require('drizzle-orm');
const { curators, listings, kitSkus } = require('@repo/db');
const logger = require('../lib/logger');

const router = express.Router();

const CONNECTION_STRING = process.env.NEON_DATABASE_URL;
const PUBLIC_R2_URL = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
let _sql = null;

function getDb() {
  if (!_sql) {
    if (!CONNECTION_STRING) {
      throw new Error('NEON_DATABASE_URL not configured');
    }
    _sql = neon(CONNECTION_STRING);
  }
  return drizzle(_sql, { schema: { curators, listings, kitSkus } });
}

function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

function keyToUrl(key) {
  if (!key || !PUBLIC_R2_URL) return null;
  return `${PUBLIC_R2_URL}/${String(key).replace(/^\/+/, '')}`;
}

function firstAvailableSize(sizes) {
  if (!Array.isArray(sizes)) return null;
  return sizes.find((item) => Number(item.stock) > 0) || sizes[0] || null;
}

function buildWhatsAppUrl(curator, listing) {
  const phone = curator.channels?.whatsapp;
  if (!phone) return null;

  const size = firstAvailableSize(listing.sizes);
  const template =
    curator.commerce?.whatsappTemplate ||
    "Hi {curator}, I'd like to order the {club} {kit_type} kit in size {size} — KES {price}";

  const text = template
    .replaceAll('{curator}', curator.name)
    .replaceAll('{club}', listing.kit.club)
    .replaceAll('{kit_type}', listing.kit.kitType)
    .replaceAll('{size}', size?.size || '')
    .replaceAll('{price}', size?.price ? String(size.price) : '');

  return `https://wa.me/${phone.replace(/^\+/, '')}?text=${encodeURIComponent(text)}`;
}

router.get('/:slug/storefront', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!isValidSlug(slug)) {
    return res.status(400).json({ error: 'Invalid curator slug' });
  }

  let db;
  try {
    db = getDb();
  } catch (err) {
    logger.error('NEON_DATABASE_URL not configured', { component: 'curator-storefront' });
    return res.status(503).json({
      error: 'Database not configured',
      message: 'The server is not connected to a database.',
    });
  }

  try {
    const [curatorRow] = await db
      .select()
      .from(curators)
      .where(eq(curators.slug, slug))
      .limit(1);

    if (!curatorRow) {
      return res.status(404).json({ error: 'Curator not found' });
    }

    const rows = await db
      .select({
        listing: listings,
        kit: kitSkus,
      })
      .from(listings)
      .innerJoin(kitSkus, eq(listings.skuId, kitSkus.id))
      .where(eq(listings.curatorSlug, slug))
      .orderBy(desc(listings.updatedAt));

    const curator = {
      slug: curatorRow.slug,
      name: curatorRow.name,
      type: curatorRow.type,
      verticals: curatorRow.verticals || [],
      channels: curatorRow.channels || {},
      brand: curatorRow.brand || {},
      commerce: curatorRow.commerce || {},
      createdAt: curatorRow.createdAt,
    };

    const liveListings = rows
      .filter(({ listing }) => listing.status === 'live')
      .map(({ listing, kit }) => {
        const imageKey = listing.photoKeys?.[0] || kit.officialImageKey || null;
        return {
          id: listing.id,
          curatorSlug: listing.curatorSlug,
          skuId: listing.skuId,
          sizes: listing.sizes || [],
          photoKeys: listing.photoKeys || [],
          status: listing.status,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          imageKey,
          imageUrl: keyToUrl(imageKey),
          kit: {
            id: kit.id,
            club: kit.club,
            season: kit.season,
            kitType: kit.kitType,
            officialImageKey: kit.officialImageKey,
            crestKey: kit.crestKey,
            officialImageUrl: keyToUrl(kit.officialImageKey),
            crestUrl: keyToUrl(kit.crestKey),
          },
        };
      });

    res.json({
      curator,
      listings: liveListings.map((listing) => ({
        ...listing,
        checkoutUrl:
          curator.commerce?.checkout === 'whatsapp' || curator.channels?.whatsapp
            ? buildWhatsAppUrl(curator, listing)
            : curator.commerce?.checkoutUrl || null,
      })),
      meta: {
        listingCount: liveListings.length,
        checkout: curator.commerce?.checkout || 'whatsapp',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    logger.error('Failed to load curator storefront', { component: 'curator-storefront', slug }, err);
    res.status(500).json({ error: 'Failed to load storefront' });
  }
});

module.exports = router;
