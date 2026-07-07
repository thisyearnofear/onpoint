/**
 * Listing Similar Items Route — /api/listings/:id/similar
 *
 * Public read endpoint. For a digital listing, returns similar physical
 * listings from human curators matched by tags. Used by the web UI to
 * surface the digital→physical funnel after a try-on.
 */

const express = require('express');
const { neon } = require('@neondatabase/serverless');
const logger = require('../lib/logger');

const router = express.Router();

let _sql = null;
let _publicR2Url = null;

function getSql() {
  if (!_sql) {
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) throw new Error('NEON_DATABASE_URL not set');
    _sql = neon(connectionString);
  }
  return _sql;
}

function getPublicR2Url() {
  if (_publicR2Url === null) {
    _publicR2Url = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') || '';
  }
  return _publicR2Url;
}

function keyToUrl(key) {
  if (!key) return null;
  if (/^(https?:|ipfs:)/.test(key)) return key;
  const url = getPublicR2Url();
  if (!url) return null;
  return `${url}/${String(key).replace(/^\/+/, '')}`;
}

router.get('/:id/similar', async (req, res) => {
  try {
    const { id } = req.params;
    const sql = getSql();

    // Fetch the source listing
    const rows = await sql`
      SELECT id, curator_slug, inventory_type, tags
      FROM listings
      WHERE id = ${id}
      LIMIT 1
    `;

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const listing = rows[0];

    // Only digital listings have similar physical items
    if (listing.inventory_type !== 'digital' || !listing.tags?.length) {
      return res.json({ similarPhysicalItems: [] });
    }

    const tags = listing.tags;
    const matches = await sql`
      SELECT l.id, l.curator_slug, l.title, l.photo_keys, l.sizes,
             c.name AS curator_name,
             k.club, k.kit_type, k.season, k.official_image_key
      FROM listings l
      INNER JOIN curators c ON l.curator_slug = c.slug
      LEFT JOIN kit_skus k ON l.sku_id = k.id
      WHERE l.inventory_type = 'physical'
        AND l.status = 'live'
        AND c.type = 'human'
        AND l.curator_slug != ${listing.curator_slug}
        AND l.tags && ${tags}
      LIMIT 5
    `;

    const similarPhysicalItems = matches.map((m) => {
      const title = m.title || (m.club
        ? `${m.club} ${m.kit_type || ''} ${m.season || ''}`.trim()
        : `${m.curator_name} listing`);
      const imageKey = m.photo_keys?.[0] || m.official_image_key;
      return {
        listingId: m.id,
        curatorSlug: m.curator_slug,
        curatorName: m.curator_name,
        title,
        imageUrl: keyToUrl(imageKey),
        orderUrl: `/api/curator/${m.curator_slug}/order`,
        storefrontUrl: `/api/curator/${m.curator_slug}/storefront`,
      };
    });

    res.json({ similarPhysicalItems });
  } catch (err) {
    logger.error('listing-similar error', { component: 'listing-similar', error: err.message });
    res.status(500).json({ error: 'Failed to fetch similar items' });
  }
});

module.exports = router;
