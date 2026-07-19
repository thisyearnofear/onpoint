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
 * Validate a slug format (lowercase alphanumeric + hyphens, 2-48 chars).
 * @param {string} slug
 * @returns {boolean}
 */
function isValidSlug(slug) {
  return /^[a-z0-9-]{2,48}$/.test(slug);
}

module.exports = { slugify, isValidSlug };
