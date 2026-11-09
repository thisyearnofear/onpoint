/**
 * Agent wallet auth — /api/auth
 *
 * SIWE-style challenge/verify flow proving control of a wallet address:
 *   POST /api/auth/challenge { address }            → { message, nonce, expiresAt }
 *   POST /api/auth/verify    { address, signature } → { token, expiresAt }
 *
 * The challenge message is signed off-chain (personal_sign) — it never
 * triggers a transaction or costs gas. The returned bearer token is required
 * for creator-scoped look writes (see middleware/agent-session.js).
 */

const express = require('express');
const crypto = require('crypto');
const { recoverMessageAddress, getAddress } = require('viem');
const { webBaseUrl } = require('../lib/agent-commerce');
const {
  issueSessionToken,
  CHALLENGE_TTL_SECONDS,
} = require('../lib/agent-session');
const logger = require('../lib/logger');

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const SIGNATURE_RE = /^0x[a-fA-F0-9]{130}$/; // 65-byte ECDSA signature

function buildChallengeMessage({ address, nonce, issuedAt, expiresAt }) {
  const base = webBaseUrl();
  const domain = new URL(base).host;
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    getAddress(address),
    '',
    'Sign in to OnPoint to create and manage looks. This signature does not authorize any payment or blockchain transaction.',
    '',
    `URI: ${base}`,
    'Version: 1',
    'Chain ID: 42220',
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
    `Expiration Time: ${expiresAt}`,
  ].join('\n');
}

/**
 * @param {{ store: { save: Function, take: Function }, now?: () => number }} deps
 */
function createAgentAuthRouter({ store, now = Date.now }) {
  const router = express.Router();

  router.post('/challenge', async (req, res) => {
    const { address } = req.body || {};
    if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
      return res.status(400).json({ error: 'address must be a 0x-prefixed 40-hex-character wallet address' });
    }

    const nonce = crypto.randomBytes(16).toString('hex');
    const issuedAt = new Date(now()).toISOString();
    const expiresAt = new Date(now() + CHALLENGE_TTL_SECONDS * 1000).toISOString();
    const message = buildChallengeMessage({ address, nonce, issuedAt, expiresAt });

    try {
      await store.save(address, { nonce, message, issuedAt, expiresAt }, CHALLENGE_TTL_SECONDS);
    } catch (err) {
      logger.error('Failed to store auth challenge', { component: 'agent-auth' }, err);
      return res.status(503).json({ error: 'Auth service unavailable' });
    }

    res.json({ address: address.toLowerCase(), message, nonce, expiresAt });
  });

  router.post('/verify', async (req, res) => {
    const { address, signature } = req.body || {};
    if (typeof address !== 'string' || !ADDRESS_RE.test(address)) {
      return res.status(400).json({ error: 'address must be a 0x-prefixed 40-hex-character wallet address' });
    }
    if (typeof signature !== 'string' || !SIGNATURE_RE.test(signature)) {
      return res.status(400).json({ error: 'signature must be a 0x-prefixed 65-byte hex signature' });
    }

    let challenge;
    try {
      challenge = await store.take(address);
    } catch (err) {
      logger.error('Failed to read auth challenge', { component: 'agent-auth' }, err);
      return res.status(503).json({ error: 'Auth service unavailable' });
    }
    if (!challenge) {
      return res.status(401).json({
        error: 'No active challenge for this address. POST /api/auth/challenge first.',
        code: 'CHALLENGE_NOT_FOUND',
      });
    }
    if (new Date(challenge.expiresAt).getTime() <= now()) {
      return res.status(401).json({
        error: 'Challenge expired. Request a new one.',
        code: 'CHALLENGE_EXPIRED',
      });
    }

    let recovered;
    try {
      recovered = await recoverMessageAddress({ message: challenge.message, signature });
    } catch {
      return res.status(401).json({ error: 'Signature verification failed', code: 'SIGNATURE_INVALID' });
    }
    if (recovered.toLowerCase() !== address.toLowerCase()) {
      return res.status(403).json({
        error: 'Signature does not match the claimed address',
        code: 'SIGNATURE_MISMATCH',
      });
    }

    let session;
    try {
      session = issueSessionToken(address, { now: now() });
    } catch (err) {
      logger.error('Session secret not configured', { component: 'agent-auth' }, err);
      return res.status(500).json({ error: 'Session signing not configured on server' });
    }

    logger.info('Agent wallet session issued', {
      component: 'agent-auth',
      address: session.address,
    });

    res.json({
      token: session.token,
      tokenType: 'Bearer',
      address: session.address,
      expiresAt: session.expiresAt,
    });
  });

  return router;
}

module.exports = { createAgentAuthRouter };