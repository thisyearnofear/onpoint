/**
 * Shared R2 URL helpers — convert storage keys to public URLs.
 *
 * Replaces keyToUrl / r2KeyToUrl / listingImageUrl duplicated
 * across agent-looks.js, agent-tryon.js, curator-storefront.js,
 * listing-similar.js.
 */

/**
 * Convert an R2 storage key (or full URL) to a public URL.
 * - Full URLs (https://, ipfs://) pass through as-is
 * - R2 keys are prefixed with R2_PUBLIC_URL
 * - null/undefined → null
 * @param {string|null|undefined} key
 * @returns {string|null}
 */
function keyToUrl(key) {
  if (!key) return null;
  if (/^(https?:|ipfs:)/.test(key)) return key;
  const base = process.env.R2_PUBLIC_URL?.replace(/\/$/, '');
  if (!base) return null;
  return `${base}/${String(key).replace(/^\/+/, '')}`;
}

/**
 * Get the first available image URL for a listing.
 * Checks photoKeys array first, then officialImageKey.
 * @param {object} listing
 * @returns {string|null}
 */
function listingImageUrl(listing) {
  if (listing.photoKeys && listing.photoKeys.length > 0) {
    return keyToUrl(listing.photoKeys[0]);
  }
  if (listing.officialImageKey) {
    return keyToUrl(listing.officialImageKey);
  }
  return null;
}

module.exports = { keyToUrl, listingImageUrl };
