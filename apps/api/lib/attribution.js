/**
 * Attribution Tags — ERC-8021 on Celo.
 *
 * One-line tagging of every on-chain transaction OnPoint initiates, so the
 * Celo attribution dashboard can credit us for the on-chain activity we
 * drive (agent orders, payouts, split distributions, try-on fees).
 *
 * The code is derived from our API hostname (api.onpoint.famile.xyz) and
 * is also exposed in 402 responses so paying agents can optionally tag
 * their own payment transactions with our code.
 */

let _attributionTags = null;
function getAttributionTags() {
  if (!_attributionTags) {
    _attributionTags = require('@celo/attribution-tags');
  }
  return _attributionTags;
}

// Derive once at module load. Falls back to a fixed code if the hostname
// isn't set — the code is stable per deployment.
const HOSTNAME = process.env.ATTRIBUTION_HOSTNAME || 'api.onpoint.famile.xyz';

let ATTRIBUTION_CODE = null;
try {
  ATTRIBUTION_CODE = getAttributionTags().codeFromHostname(HOSTNAME);
} catch {
  // Fallback: a fixed code we control
  ATTRIBUTION_CODE = 'celo_onpoint_agent';
}

/**
 * The ERC-8021 data suffix for our attribution code.
 * Append this to transaction `data` to tag the tx on-chain.
 */
let DATA_SUFFIX = null;
try {
  DATA_SUFFIX = getAttributionTags().toDataSuffix(ATTRIBUTION_CODE);
} catch {
  DATA_SUFFIX = '0x';
}

/**
 * Get the attribution code (e.g. "celo_aac2acfa60e8").
 */
function getAttributionCode() {
  return ATTRIBUTION_CODE;
}

/**
 * Get the hex data suffix to append to transactions.
 */
function getAttributionSuffix() {
  return DATA_SUFFIX;
}

/**
 * Append the attribution suffix to an existing data payload.
 * If data is null/undefined/0x, returns just the suffix.
 * If data already ends with the ERC-8021 marker, don't double-tag.
 */
function withAttribution(data) {
  const suffix = DATA_SUFFIX;
  if (!suffix || suffix === '0x') return data;
  if (!data || data === '0x') return suffix;
  const hexData = typeof data === 'string' && data.startsWith('0x') ? data : `0x${data}`;
  // Don't double-tag
  const MARKER = '0x80218021802180218021802180218021';
  if (hexData.endsWith(MARKER)) return hexData;
  return hexData + suffix.slice(2); // strip 0x from suffix when concatenating
}

module.exports = {
  getAttributionCode,
  getAttributionSuffix,
  withAttribution,
  ATTRIBUTION_CODE,
  DATA_SUFFIX,
};
