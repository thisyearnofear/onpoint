/**
 * Runway player hash (ops/retention.md): a stable, salted, non-reversible
 * player id for funnel events — sha256(salt|chatId) truncated to 16 hex.
 * Raw chat ids / web UUIDs must never reach funnel_events.
 */

const crypto = require('crypto');

function playerHash(chatId) {
  if (!chatId) return null;
  const salt = process.env.RUNWAY_PLAYER_SALT || 'onpoint-runway';
  return crypto.createHash('sha256').update(`${salt}|${chatId}`).digest('hex').slice(0, 16);
}

module.exports = { playerHash };
