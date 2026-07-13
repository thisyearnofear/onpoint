/**
 * Attribution Tags — ERC-8021 on Celo.
 *
 * One-line tagging of every on-chain transaction OnPoint initiates, so the
 * Celo attribution dashboard can credit us for the on-chain activity we
 * drive (agent orders, payouts, split distributions, try-on fees).
 *
 * Two codes are carried in every transaction (ERC-8021 supports arrays):
 *
 * 1. HOSTNAME_CODE — derived from our API hostname (api.onpoint.famile.xyz).
 *    This is the platform-level code, exposed in 402 responses so paying
 *    agents can optionally tag their own payment transactions with it.
 *
 * 2. ASSIGNED_TAG — assigned by Celo Builders when we registered for the
 *    Agentic Payments & DeFAI Hackathon. Derived from our GitHub repo slug
 *    (thisyearnofear/onpoint) and locked at first save. Only this code is
 *    credited on the hackathon leaderboard.
 *
 * Both codes are included via toDataSuffix([hostnameCode, assignedTag]).
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

let HOSTNAME_CODE = null;
try {
  HOSTNAME_CODE = getAttributionTags().codeFromHostname(HOSTNAME);
} catch {
  // Fallback: a fixed code we control
  HOSTNAME_CODE = 'celo_onpoint_agent';
}

// Assigned hackathon tag — derived from GitHub repo slug at registration.
// Locked at first save on celobuilders.xyz. Override via env if needed.
const ASSIGNED_TAG = process.env.ASSIGNED_ATTRIBUTION_TAG || 'celo_ce9e004195d5';

/**
 * The ERC-8021 data suffix carrying both attribution codes.
 * Append this to transaction `data` to tag the tx on-chain.
 */
let DATA_SUFFIX = null;
try {
  DATA_SUFFIX = getAttributionTags().toDataSuffix([HOSTNAME_CODE, ASSIGNED_TAG]);
} catch {
  DATA_SUFFIX = '0x';
}

/**
 * Get the hostname-derived attribution code (e.g. "celo_aac2acfa60e8").
 */
function getAttributionCode() {
  return HOSTNAME_CODE;
}

/**
 * Get the hackathon-assigned attribution tag (e.g. "celo_ce9e004195d5").
 * This is the tag credited on the Dune leaderboard.
 */
function getAssignedTag() {
  return ASSIGNED_TAG;
}

/**
 * Get all attribution codes in the order they appear in the suffix.
 */
function getAttributionCodes() {
  return [HOSTNAME_CODE, ASSIGNED_TAG];
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
  getAssignedTag,
  getAttributionCodes,
  getAttributionSuffix,
  withAttribution,
  HOSTNAME_CODE,
  ASSIGNED_TAG,
  DATA_SUFFIX,
};
