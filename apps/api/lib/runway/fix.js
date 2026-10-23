/**
 * Runway "the fix" (ADR 0022 §1.4). Picks one live OnPoint look or listing
 * that would have scored higher, mints a share id, and logs a look_share
 * funnel event so the fix lands inside the ADR 0019 share-attribution loop.
 *
 * Order: live looks tagged like (theme.tags ∪ fixTags) → live physical
 * listings tagged likewise → most recent live look. Returns null on any DB
 * unavailability — never throws into the game.
 */

const logger = require('../logger');
const { getSql } = require('../db');
const { keyToUrl, listingImageUrl } = require('../r2');
const { newShareId } = require('../share-attribution');
const { logFunnelEvent } = require('../funnel');
const { webBaseUrl } = require('../agent-commerce');

function recordShare(sqlDb, metadata) {
  // Mirrors recordLookEvent in routes/agent-looks.js so summarizeShareFunnel
  // counts the share (event_type 'look_share', metadata.shareId non-null).
  logFunnelEvent(null, {
    eventType: 'look_share',
    source: 'runway',
    visitorHash: 'runway',
    metadata,
  });
}

async function findFix({ theme, fixTags, channel = 'imessage', personaKey }) {
  try {
    const sql = getSql();
    const want = [...new Set([...(theme?.tags || []), ...(fixTags || [])])];
    const shareId = newShareId();
    const web = webBaseUrl();
    const track = `&from=runway&theme=${theme?.id || ''}&judge=${personaKey || ''}`;

    if (want.length) {
      const looks = await sql`
        SELECT slug, title, cover_image_key
        FROM agent_looks
        WHERE status = 'live' AND tags && ${want}
        ORDER BY updated_at DESC
        LIMIT 1
      `;
      if (looks.length) {
        const look = looks[0];
        const url = `${web}/look/${look.slug}?sid=${shareId}&utm_source=${channel}${track}`;
        recordShare(sql, { lookSlug: look.slug, shareId, channel, actor: 'runway' });
        return {
          kind: 'look',
          title: look.title || look.slug,
          imageUrl: keyToUrl(`looks/${look.slug}/collage-latest.webp`) || keyToUrl(look.cover_image_key),
          url,
          shareId,
        };
      }

      const listings = await sql`
        SELECT l.id, l.curator_slug, l.title, l.photo_keys, k.official_image_key
        FROM listings l
        INNER JOIN curators c ON l.curator_slug = c.slug
        LEFT JOIN kit_skus k ON l.sku_id = k.id
        WHERE l.status = 'live'
          AND l.inventory_type = 'physical'
          AND l.tags && ${want}
        ORDER BY l.created_at DESC
        LIMIT 1
      `;
      if (listings.length) {
        const l = listings[0];
        const url = `${web}/s/${l.curator_slug}?sid=${shareId}&utm_source=${channel}${track}`;
        recordShare(sql, { lookSlug: null, shareId, channel, actor: 'runway', listingId: l.id });
        return {
          kind: 'listing',
          title: l.title || 'A live listing',
          imageUrl: listingImageUrl({ photoKeys: l.photo_keys, officialImageKey: l.official_image_key }),
          url,
          shareId,
        };
      }
    }

    const recent = await sql`
      SELECT slug, title, cover_image_key
      FROM agent_looks
      WHERE status = 'live'
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    if (recent.length) {
      const look = recent[0];
      const url = `${web}/look/${look.slug}?sid=${shareId}&utm_source=${channel}${track}`;
      recordShare(sql, { lookSlug: look.slug, shareId, channel, actor: 'runway' });
      return {
        kind: 'look',
        title: look.title || look.slug,
        imageUrl: keyToUrl(`looks/${look.slug}/collage-latest.webp`) || keyToUrl(look.cover_image_key),
        url,
        shareId,
      };
    }
    return null;
  } catch (err) {
    logger.warn('runway fix lookup failed', { component: 'runway', error: err.message });
    return null;
  }
}

module.exports = { findFix };
