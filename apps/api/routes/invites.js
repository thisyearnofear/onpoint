/**
 * Invite Routes — /api/invites
 *
 *   POST /api/invites/consume  { tokenHash }  → claim a try-on invite
 *   POST /api/invites/release  { tokenHash }  → return the claim (render failed)
 *
 * The web app hashes the invite token itself — the API only ever sees the
 * sha256, so this route needs no shared secret and stores nothing linkable
 * to a person.
 */

const express = require('express');
const { claimInvite, releaseInvite } = require('../lib/invite-claims');
const logger = require('../lib/logger');

const router = express.Router();
const HASH_RE = /^[a-f0-9]{64}$/;

router.post('/consume', async (req, res) => {
  try {
    const tokenHash = String(req.body?.tokenHash || '');
    if (!HASH_RE.test(tokenHash)) return res.status(400).json({ error: 'invalid tokenHash' });
    const claimed = await claimInvite(tokenHash);
    if (claimed === null) {
      // Claim store down — let the render through; the invite is still
      // signature- and expiry-bound.
      return res.json({ claimed: true, enforced: false });
    }
    if (!claimed) return res.status(409).json({ error: 'invite already used' });
    res.json({ claimed: true, enforced: true });
  } catch (err) {
    logger.error('invite consume failed', { route: 'invites' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/release', async (req, res) => {
  try {
    const tokenHash = String(req.body?.tokenHash || '');
    if (!HASH_RE.test(tokenHash)) return res.status(400).json({ error: 'invalid tokenHash' });
    await releaseInvite(tokenHash);
    res.json({ ok: true });
  } catch (err) {
    logger.error('invite release failed', { route: 'invites' }, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
