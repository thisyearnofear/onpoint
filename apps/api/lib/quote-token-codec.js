/**
 * Quote-token codec — the canonical wire format for seller-signed price
 * commitments, shared by BOTH sides of the negotiation mailbox:
 *
 *   - the API (agent-negotiation.js) mints hosted tokens and verifies all
 *     tokens on redemption, and
 *   - a sovereign seller process (scripts/near-spike/intents-lib.mjs →
 *     seller-agent.mjs) signs tokens with a key the platform does not hold.
 *
 * Byte-exact canonicalization is the whole game: `canonicalPayload` emits
 * the payload object as JSON in ONE fixed key order, so a signature made
 * in any process verifies in any other. Do not reorder these keys.
 *
 * Signature scheme: plain ed25519 over canonicalPayload bytes (detached —
 * NOT NEP-413). NEAR secrets are "ed25519:<base58(seed ‖ pubkey)>".
 */

const crypto = require('crypto');

// ── base58 (NEAR keys are base58; apps/api carries no codec dep) ──────────
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const B58_MAP = new Map([...B58_ALPHABET].map((ch, i) => [ch, BigInt(i)]));

function base58Decode(str) {
  let num = 0n;
  for (const ch of String(str)) {
    const v = B58_MAP.get(ch);
    if (v === undefined) throw new Error('invalid base58');
    num = num * 58n + v;
  }
  const bytes = [];
  while (num > 0n) { bytes.unshift(Number(num & 0xffn)); num >>= 8n; }
  const pad = String(str).match(/^1+/)?.[0].length ?? 0;
  return Buffer.from([...Array(pad).fill(0), ...bytes]);
}

function base58Encode(buf) {
  let num = 0n;
  for (const b of buf) num = num * 256n + BigInt(b);
  let out = '';
  while (num > 0n) { out = B58_ALPHABET[Number(num % 58n)] + out; num /= 58n; }
  const pad = Buffer.from(buf).findIndex((b) => b !== 0);
  return '1'.repeat(pad === -1 ? buf.length : pad) + out;
}

// ── canonical form — fixed key order, no whitespace, nulls explicit ───────
function canonicalPayload(payload) {
  return JSON.stringify({
    v: payload.v,
    scope: payload.scope,
    curatorSlug: payload.curatorSlug,
    listingId: payload.listingId,
    size: payload.size ?? null,
    quantity: payload.quantity ?? null,
    agreedCusd: payload.agreedCusd,
    sessionId: payload.sessionId,
    payee: payload.payee,
    issuedAt: payload.issuedAt,
    expiresAt: payload.expiresAt,
  });
}

// ── NEAR secret ("ed25519:<base58(seed ‖ pubkey)>") → node:crypto pair ────
function nearSecretToKeyPair(secret) {
  const m = /^ed25519:([1-9A-HJ-NP-Za-km-z]+)$/.exec(String(secret || '').trim());
  if (!m) throw new Error('NEAR secret key must be ed25519:<base58>');
  const raw = base58Decode(m[1]);
  if (raw.length !== 64) throw new Error('NEAR secret key must decode to 64 bytes');
  const seed = raw.subarray(0, 32);
  const publicKey = raw.subarray(32, 64);
  const jwk = {
    kty: 'OKP', crv: 'Ed25519',
    d: seed.toString('base64url'),
    x: publicKey.toString('base64url'),
  };
  return {
    privateKey: crypto.createPrivateKey({ format: 'jwk', key: jwk }),
    publicKeyBytes: publicKey,
  };
}

function nearPublicKeyToKey(publicKeyBase58) {
  const m = /^ed25519:([1-9A-HJ-NP-Za-km-z]+)$/.exec(String(publicKeyBase58 || '').trim());
  if (!m) throw new Error('signer.publicKey must be ed25519:<base58>');
  const pubBytes = base58Decode(m[1]);
  if (pubBytes.length !== 32) throw new Error('bad public key length');
  return crypto.createPublicKey({ format: 'jwk', key: { kty: 'OKP', crv: 'Ed25519', x: pubBytes.toString('base64url') } });
}

function signQuotePayload(payload, nearSecretKey) {
  const { privateKey, publicKeyBytes } = nearSecretToKeyPair(nearSecretKey);
  const signature = crypto.sign(null, Buffer.from(canonicalPayload(payload)), privateKey);
  return {
    signature: base58Encode(signature),
    publicKey: `ed25519:${base58Encode(publicKeyBytes)}`,
  };
}

function verifyQuoteSignature(payload, signatureBase58, publicKeyBase58) {
  try {
    const pub = nearPublicKeyToKey(publicKeyBase58);
    return crypto.verify(null, Buffer.from(canonicalPayload(payload)), pub, base58Decode(signatureBase58));
  } catch {
    return false;
  }
}

module.exports = {
  base58Decode,
  base58Encode,
  canonicalPayload,
  nearSecretToKeyPair,
  nearPublicKeyToKey,
  signQuotePayload,
  verifyQuoteSignature,
};
