/**
 * Shared slug helpers.
 *
 * Replaces slugify / isValidSlug duplicated across
 * agent-looks.js, curator-admin.js, curator-storefront.js,
 * curator-wallet.js, market-intelligence.js.
 */

/**
 * Convert text to a URL-safe slug.
 * @param {string} text
 * @param {number} [maxLen=60]
 * @returns {string}
 */
function slugify(text, maxLen = 60) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLen);
}

/**
 * Words the web app uses in `?from=` when an artifact (a card, a wish list, a
 * magazine issue) doesn't know whose shelf a garment came from. They are not
 * curator slugs, so they must never be minted as one or looked up as one.
 * Kept in step with apps/web/lib/utils/deep-link-source.ts.
 */
const RESERVED_SLUGS = ['card', 'list', 'mag'];

/**
 * Validate a slug format (lowercase alphanumeric + hyphens, 2-48 chars).
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug) && !RESERVED_SLUGS.includes(slug);
}

module.exports = { slugify, isValidSlug, RESERVED_SLUGS };
