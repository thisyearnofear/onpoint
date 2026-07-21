/**
 * Items Similar Route — /api/items/similar
 *
 * Public read endpoint. Given a listing ID, returns similar live physical
 * listings from the marketplace that can be used to swap an item inside a look.
 *
 * Query params:
 *   - listingId (required): the source listing ID
 *   - excludeIds (optional): comma-separated listing IDs to exclude (e.g. other items in the look)
 *   - limit (optional): max results, default 5, max 12
 */

const express = require('express');
const { getSql } = require('../lib/db');
const { keyToUrl } = require('../lib/r2');
const logger = require('../lib/logger');

const router = express.Router();

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function lowestPrice(sizes) {
  if (!Array.isArray(sizes) || sizes.length === 0) return null;
  const prices = sizes.map((s) => Number(s.price)).filter((p) => Number.isFinite(p) && p > 0);
  return prices.length ? Math.min(...prices) : null;
}

function firstImageUrl(photoKeys, officialImageKey) {
  const key = photoKeys?.[0] || officialImageKey || null;
  return keyToUrl(key);
}

router.get('/similar', async (req, res) => {
  try {
    const listingId = String(req.query.listingId || '');
    if (!listingId || !isValidUuid(listingId)) {
      return res.status(400).json({ error: 'listingId must be a valid UUID' });
    }

    const rawExcludeIds = String(req.query.excludeIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const excludeIds = rawExcludeIds.filter(isValidUuid);

    const rawLimit = Number(req.query.limit);
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 12)
      : 5;

    const sql = getSql();

    // Fetch the source listing
    const sourceRows = await sql`
      SELECT id, curator_slug, inventory_type, tags, title
      FROM listings
      WHERE id = ${listingId}
      LIMIT 1
    `;

    if (sourceRows.length === 0) {
      return res.status(404).json({ error: 'Listing not found' });
    }

    const source = sourceRows[0];
    const sourceTags = Array.isArray(source.tags) ? source.tags : [];

    // If the source has tags, rank by tag overlap; otherwise fall back to same curator verticals
    const hasTags = sourceTags.length > 0;

    let matches;
    if (hasTags) {
      matches = await sql`
        SELECT l.id, l.curator_slug, l.title, l.photo_keys, l.sizes,
               c.name AS curator_name,
               k.club, k.kit_type, k.season, k.official_image_key
        FROM listings l
        INNER JOIN curators c ON l.curator_slug = c.slug
        LEFT JOIN kit_skus k ON l.sku_id = k.id
        WHERE l.status = 'live'
          AND l.inventory_type != 'digital'
          AND l.id != ${source.id}
          AND NOT (l.id = ANY(${excludeIds}))
          AND l.tags && ${sourceTags}
        ORDER BY (
          SELECT COUNT(*)
          FROM UNNEST(l.tags) AS t
          WHERE t = ANY(${sourceTags})
        ) DESC,
        l.updated_at DESC
        LIMIT ${limit}
      `;
    } else {
      // Fall back to items from curators with overlapping verticals
      matches = await sql`
        WITH source_curator AS (
          SELECT verticals
          FROM curators
          WHERE slug = ${source.curator_slug}
          LIMIT 1
        )
        SELECT l.id, l.curator_slug, l.title, l.photo_keys, l.sizes,
               c.name AS curator_name,
               k.club, k.kit_type, k.season, k.official_image_key
        FROM listings l
        INNER JOIN curators c ON l.curator_slug = c.slug
        LEFT JOIN kit_skus k ON l.sku_id = k.id
        CROSS JOIN source_curator sc
        WHERE l.status = 'live'
          AND l.inventory_type != 'digital'
          AND l.id != ${source.id}
          AND NOT (l.id = ANY(${excludeIds}))
          AND c.verticals && sc.verticals
        ORDER BY l.updated_at DESC
        LIMIT ${limit}
      `;
    }

    const similarItems = matches.map((m) => {
      const title = m.title || (m.club ? `${m.club} ${m.kit_type || ''} ${m.season || ''}`.trim() : `${m.curator_name} listing`);
      const imageKey = m.photo_keys?.[0] || m.official_image_key;
      return {
        listingId: m.id,
        curatorSlug: m.curator_slug,
        curatorName: m.curator_name,
        title,
        imageUrl: keyToUrl(imageKey),
        cutoutUrl: keyToUrl(`listings/${m.id}/cutout.png`),
        lowestPrice: lowestPrice(m.sizes),
        sizes: Array.isArray(m.sizes) ? m.sizes : [],
        storefrontUrl: `/s/${m.curator_slug}`,
      };
    });

    return res.json({
      sourceListingId: source.id,
      similarItems,
      meta: {
        count: similarItems.length,
        byTagOverlap: hasTags,
      },
    });
  } catch (err) {
    logger.error('items-similar error', { component: 'items-similar', error: err.message });
    return res.status(500).json({ error: 'Failed to fetch similar items' });
  }
});

module.exports = router;
