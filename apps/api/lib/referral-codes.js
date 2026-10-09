/**
 * Referral codes: derivation and resolution.
 *
 * A referral code is `ref_` + the first 8 hex characters of the agent's wallet
 * address (after `0x`). The derivation is deliberately case-preserving: codes
 * are already in circulation in shared links, so changing the casing would
 * orphan them. Matching is case-insensitive.
 *
 * Resolving a code to a payable address matters because commissions are paid to
 * that address. An unrecognised code must never be stored as an address.
 */

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CODE_RE = /^ref_[0-9a-fA-F]{8}$/;

/** `ref_<8 hex>` for an agent address, or null if it is not a valid address. */
function deriveReferralCode(address) {
  if (typeof address !== 'string' || !ADDRESS_RE.test(address)) return null;
  return `ref_${address.slice(2, 10)}`;
}

function isValidAddress(value) {
  return typeof value === 'string' && ADDRESS_RE.test(value);
}

function rowsOf(result) {
  if (Array.isArray(result)) return result;
  return (result && result.rows) || [];
}

/**
 * Resolve a referral code to the agent address that should be paid.
 *
 * Order of resolution:
 *   1. a full 0x address is used as-is
 *   2. a previous agent_referrals row for this exact code (only if its stored
 *      address is a valid address; older rows could hold the raw code)
 *   3. an agent that owns looks whose derived code matches (must be unique)
 *
 * @param {object} db drizzle instance exposing execute(sql)
 * @param {Function} sql drizzle `sql` tag
 * @param {string} code
 * @returns {Promise<{ address: string|null, reason: 'address'|'known'|'look_owner'|'invalid'|'unknown'|'ambiguous' }>}
 */
async function resolveReferralAgent(db, sql, code) {
  if (typeof code !== 'string' || !code) return { address: null, reason: 'invalid' };

  if (isValidAddress(code)) return { address: code, reason: 'address' };
  if (!CODE_RE.test(code)) return { address: null, reason: 'invalid' };

  const known = rowsOf(
    await db.execute(sql`
      SELECT agent_address FROM agent_referrals
      WHERE lower(referral_code) = lower(${code})
      ORDER BY created_at DESC
      LIMIT 5
    `),
  )
    .map((r) => r.agent_address)
    .find(isValidAddress);
  if (known) return { address: known, reason: 'known' };

  const owners = rowsOf(
    await db.execute(sql`
      SELECT DISTINCT lower(agent_address) AS agent_address FROM agent_looks
      WHERE 'ref_' || substr(lower(agent_address), 3, 8) = lower(${code})
      LIMIT 3
    `),
  )
    .map((r) => r.agent_address)
    .filter(isValidAddress);

  if (owners.length === 1) return { address: owners[0], reason: 'look_owner' };
  if (owners.length > 1) return { address: null, reason: 'ambiguous' };
  return { address: null, reason: 'unknown' };
}

module.exports = { deriveReferralCode, isValidAddress, resolveReferralAgent };
