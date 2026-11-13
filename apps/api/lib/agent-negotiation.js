/**
 * Agent price negotiation — session protocol + seller policy + signed quote.
 *
 * A buying agent opens a session against a curator listing (or a try-on
 * service fee) and haggles over multiple rounds. The seller side is a policy
 * function with memory: it knows its cost floor and margin target, concedes
 * less each round, notices when the buyer stops improving (round fatigue →
 * walks away), and can refuse outright. An accepted price mints an
 * ed25519-signed quote token ({ listing, price, sessionId, expiry }) the
 * buyer redeems on the order/try-on POST — verifiable off-chain against the
 * seller's public key.
 *
 * Session state is in-memory: prod runs a single PM2 fork
 * (deploy/ecosystem.config.js) and sessions TTL in minutes. Venice rewrites
 * the seller's reasoning when VENICE_API_KEY is configured; the numeric
 * decision is always rule-based so the protocol stays deterministic.
 */

const crypto = require('crypto');
const {
  base58Decode, base58Encode, canonicalPayload,
  nearSecretToKeyPair, signQuotePayload, verifyQuoteSignature,
} = require('./quote-token-codec');
const nearIntents = require('./near-intents');

// ── config ───────────────────────────────────────────────────────────────
const SESSION_TTL_MS = 10 * 60 * 1000; // sessions die fast — haggling is quick
const MAX_SESSIONS = 1000;
const DEFAULT_MAX_ROUNDS = 5; // seller's patience
const BUNDLE_LOOKBACK_MS = 60 * 60 * 1000; // a try-on paid within the hour = bundle context

function negotiationConfig(curator) {
  const c = curator?.commerce || {};
  const pct = (v, dflt) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 && n <= 1 ? n : dflt;
  };
  return {
    // hard cost floor — seller NEVER goes below (same commerce.priceFloorPct
    // the flat offerUsd path already honours)
    floorPct: pct(c.priceFloorPct, 1),
    // margin target — where the seller would like to land. Defaults to the
    // midpoint of the haggle band so the seller holds some margin.
    targetPct: pct(c.negotiateTargetPct, null),
    // extra discount unlocked when the buyer has already paid the stylist —
    // bundle economics: a service sale subsidises goods margin.
    bundleDiscountPct: pct(c.negotiateBundleDiscountPct, 0.03),
    maxRounds: Number.isInteger(Number(c.negotiateMaxRounds)) && Number(c.negotiateMaxRounds) >= 1
      ? Number(c.negotiateMaxRounds)
      : DEFAULT_MAX_ROUNDS,
    // try-on service floor — a stylist won't work below cost either
    tryOnFloorPct: pct(c.tryOnPriceFloorPct, 0.6),
  };
}

// ── session store ─────────────────────────────────────────────────────────
const { persistedMap } = require('./kv-state');
const sessions = persistedMap('negotiation_sessions', { expiresAtOf: (s) => s.expiresAt }); // sessionId → session

// In-place session mutations persist only via an explicit re-set — call
// this after updating status/history/etc.
function saveSession(session) {
  sessions.set(session.sessionId, session);
}

function pruneSessions(now) {
  for (const [id, s] of sessions) {
    if (s.expiresAt <= now || sessions.size > MAX_SESSIONS) sessions.delete(id);
  }
}

function getSession(id, now = Date.now()) {
  const s = sessions.get(id);
  if (!s) return null;
  if (s.expiresAt <= now && s.status !== 'expired') {
    s.status = 'expired';
    s.reasoning = 'Session timed out — the offer is off the table.';
    sessions.set(id, s); // flush the expiry
  }
  return s;
}

// ── seller policy (the "seller agent") ────────────────────────────────────
// Returns { decision: 'counter'|'accept'|'reject', price, reasoning, why }.
// `why` is the machine reason; `reasoning` is the human/agent-readable one
// (optionally rewritten by Venice).
function evaluateSellerPolicy(session, offerCents) {
  const { config, listCents, floorCents, askCents, round, history, bundle } = session;
  const targetCents = Math.max(floorCents, Math.round(listCents * (config.targetPct ?? (config.floorPct + (1 - config.floorPct) / 2))));
  const lastBuyerOffer = [...history].reverse().find((h) => h.actor === 'buyer')?.cents ?? null;

  // 1) Buyer met or beat the ask → deal at the ask (never above list).
  if (offerCents >= askCents) {
    return {
      decision: 'accept',
      priceCents: askCents,
      why: 'met_ask',
      reasoning: `Deal — ${(askCents / 100).toFixed(2)} meets my price. Locking it in.`,
    };
  }

  // 2) Out of patience → walk away. Rejections must be reachable.
  if (round > config.maxRounds) {
    return {
      decision: 'reject',
      why: 'rounds_exhausted',
      reasoning: `We've gone ${config.maxRounds} rounds and you're still under ${(targetCents / 100).toFixed(2)}. I have other buyers — walking.`,
    };
  }

  // 3) Round fatigue — buyer repeats or lowers their offer. Two strikes.
  if (lastBuyerOffer !== null && offerCents <= lastBuyerOffer) {
    session.stagnation = (session.stagnation || 0) + 1;
    if (session.stagnation >= 2) {
      return {
        decision: 'reject',
        why: 'stagnant_offers',
        reasoning: 'Your offers stopped moving — that tells me you\'re not serious. I\'m out.',
      };
    }
    return {
      decision: 'counter',
      priceCents: askCents,
      why: 'stagnant_offer',
      reasoning: `That's the same offer again (or worse). Improve it or we're done — ${(askCents / 100).toFixed(2)} stands.`,
    };
  }
  session.stagnation = 0;

  // 4) Below the hard floor → refuse to go there. If the offer is insultingly
  //    low (< 60% of floor) walk immediately; otherwise hold at the floor.
  if (offerCents < floorCents) {
    if (offerCents < Math.round(floorCents * 0.6)) {
      return {
        decision: 'reject',
        why: 'insulting_offer',
        reasoning: `${(offerCents / 100).toFixed(2)} is below my cost. No deal — not at any number close to that.`,
      };
    }
    return {
      decision: 'counter',
      priceCents: floorCents,
      why: 'below_floor',
      reasoning: `${(offerCents / 100).toFixed(2)} is below my floor${bundle ? ' even after the bundle credit' : ''} — I can't sell at a loss. ${(floorCents / 100).toFixed(2)} is the lowest I go.`,
    };
  }

  // 5) In the haggle band → concede less each round. Geometric decay: the
  //    remaining ask→floor gap halves per round, never below the floor.
  const gap = askCents - floorCents;
  const concessionCap = Math.ceil(gap / 2); // halve the gap each round
  const counterCents = Math.max(floorCents, askCents - concessionCap);
  if (offerCents >= counterCents) {
    return {
      decision: 'accept',
      priceCents: offerCents,
      why: 'acceptable_offer',
      reasoning: `${(offerCents / 100).toFixed(2)} works — that's inside my margin. Done.`,
    };
  }
  const bundleNote = bundle ? ' (you hired the stylist — I shaved the bundle discount off my floor already)' : '';
  return {
    decision: 'counter',
    priceCents: counterCents,
    why: 'haggling',
    reasoning: `${(offerCents / 100).toFixed(2)} is close but light. I can do ${(counterCents / 100).toFixed(2)}${bundleNote} — each round I move less.`,
  };
}

// ── Venice — seller voice (optional) ─────────────────────────────────────
// The DECISION is always rule-based; Venice only rewrites `reasoning` so the
// seller reads like an agent, not a template. Any failure → template stands.
async function veniceReasoning({ session, decision, priceCents, offerCents }) {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) return null;
  const baseURL = (process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1').replace(/\/$/, '');
  const model = process.env.NEGOTIATE_VENICE_MODEL || process.env.VISION_VENICE_MODEL || 'qwen3-vl-235b-a22b';
  const seller = session.scope === 'tryon' ? 'a freelance fashion stylist' : 'a merch seller';
  const system = `You are ${seller} negotiating a sale with an AI buying agent over ${session.scope === 'tryon' ? 'a try-on styling service' : 'a football shirt'}. Speak in first person, one or two short sentences, plain text only — no quotes, no lists. You may mention cost floor, margin, patience running out, or bundle goodwill. Never quote numbers the user didn't say.`;
  const user = `List price $${(session.listCents / 100).toFixed(2)}. Buyer just offered $${(offerCents / 100).toFixed(2)} (round ${session.round}). Your decision: ${decision} at $${(priceCents / 100).toFixed(2)}. Explain your reasoning to the buyer.`;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 90,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text && text.length <= 280 ? text : null;
  } catch {
    return null;
  }
}

// ── signed quote token (ed25519 via quote-token-codec — zero deps) ───────
// Secret: env NEAR_QUOTE_SIGNING_KEY in NEAR "ed25519:<base58>" form
// (64 bytes = seed ‖ pubkey). Public half is exposed on the token so any
// agent can verify offline; on testnet it also resolves to the curator's
// on-chain key.

// Per-seller keys: NEAR_QUOTE_SIGNING_KEYS is a JSON map
// {"store.onpoint.testnet":"ed25519:...","curator.onpoint.testnet":"ed25519:..."}
// — the seller signs quote tokens with ITS OWN NEAR key, so the signature
// verifies against the payee's on-chain public key. Falls back to the single
// NEAR_QUOTE_SIGNING_KEY + NEAR_QUOTE_SIGNER_ACCOUNT pair for curators
// without a configured key.
function signingKeyMap() {
  const raw = process.env.NEAR_QUOTE_SIGNING_KEYS;
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { return {}; }
}

function trustedSignerAccounts() {
  const set = new Set(Object.keys(signingKeyMap()));
  if (process.env.NEAR_QUOTE_SIGNER_ACCOUNT) set.add(process.env.NEAR_QUOTE_SIGNER_ACCOUNT);
  return set;
}

function quoteSigningKey(accountId) {
  const map = signingKeyMap();
  const secret = (accountId && map[accountId]) || process.env.NEAR_QUOTE_SIGNING_KEY;
  if (!secret) return null;
  const { privateKey, publicKeyBytes } = nearSecretToKeyPair(secret);
  const signerAccountId = accountId && map[accountId]
    ? accountId
    : (process.env.NEAR_QUOTE_SIGNER_ACCOUNT || 'curator.onpoint.testnet');
  return {
    privateKey,
    publicKeyBytes,
    publicKeyBase58: `ed25519:${base58Encode(publicKeyBytes)}`,
    signerAccountId,
  };
}

// A hosted key for this payee means the platform CAN sign as it — the
// hosted fallback path exists. No hosted key → sovereign-only payee: the
// platform physically cannot sign, the seller's own process must.
function hasHostedKey(accountId) {
  if (!accountId) return false;
  const map = signingKeyMap();
  if (map[accountId]) return true;
  return process.env.NEAR_QUOTE_SIGNER_ACCOUNT === accountId && !!process.env.NEAR_QUOTE_SIGNING_KEY;
}

function mintQuoteToken({ scope, curatorSlug, listingId, size, quantity, agreedCusd, sessionId, payee, ttlMs = 10 * 60 * 1000 }) {
  const key = quoteSigningKey(payee);
  const now = Date.now();
  const payload = {
    v: 1, scope, curatorSlug, listingId,
    size: size ?? null, quantity: quantity ?? null,
    agreedCusd, sessionId, payee,
    issuedAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttlMs).toISOString(),
  };
  if (!key) return { payload, signature: null, signer: null, signed: false };
  const signed = signQuotePayload(payload, (signingKeyMap()[payee] || process.env.NEAR_QUOTE_SIGNING_KEY));
  return {
    payload,
    signature: signed.signature,
    signer: { accountId: key.signerAccountId, publicKey: signed.publicKey },
    signed: true,
  };
}

// Structural + signature check — sync, no trust decision. The signature
// proves the token was signed by signer.publicKey; WHOSE key that is (and
// whether it may speak for the payee) is authorizeQuoteSigner's job.
function verifyQuoteToken(token) {
  if (!token || typeof token !== 'object') return { ok: false, error: 'quoteToken is required' };
  const { payload, signature, signer } = token;
  if (!payload || !signature || !signer?.publicKey) return { ok: false, error: 'quoteToken must carry payload, signature and signer.publicKey' };
  if (Date.parse(payload.expiresAt) <= Date.now()) return { ok: false, error: 'quoteToken expired' };
  if (!verifyQuoteSignature(payload, signature, signer.publicKey)) {
    return { ok: false, error: 'quoteToken signature invalid' };
  }
  return { ok: true, payload, signerAccountId: signer.accountId, signerPublicKey: signer.publicKey };
}

// Trust decision — async, may hit chain. A signer is authorized when:
//   1. HOSTED: the platform holds a key for signer.accountId
//      (NEAR_QUOTE_SIGNING_KEYS / NEAR_QUOTE_SIGNER_ACCOUNT) and the
//      token's publicKey is exactly that key — the platform signed as
//      itself, no spoofing by a foreign key.
//   2. SOVEREIGN: has_public_key(signer.accountId, publicKey) on the
//      intents verifier — the payee registered that key itself on-chain.
//      One registry backs both quote-signing and intent-signing: the same
//      proof that the seller holds the key that earns.
// Everything else fails closed.
async function authorizeQuoteSigner({ signerAccountId, publicKey, rpcUrl } = {}) {
  if (!signerAccountId || !publicKey) return { ok: false, reason: 'signer_incomplete' };
  const map = signingKeyMap();
  const hostedSecret = map[signerAccountId]
    || (process.env.NEAR_QUOTE_SIGNER_ACCOUNT === signerAccountId ? process.env.NEAR_QUOTE_SIGNING_KEY : null);
  if (hostedSecret) {
    try {
      const { publicKeyBytes } = nearSecretToKeyPair(hostedSecret);
      if (`ed25519:${base58Encode(publicKeyBytes)}` === publicKey) {
        return { ok: true, via: 'hosted' };
      }
      // A hosted payee's token MUST carry the platform's key — a foreign
      // key claiming a hosted account is never registry-authorized here
      // (a real sovereign registration by that account would be its own
      // statement anyway, but the hosted key is the intended signer).
      return { ok: false, via: 'hosted', reason: 'public_key_mismatch' };
    } catch {
      return { ok: false, via: 'hosted', reason: 'hosted_key_unusable' };
    }
  }
  const has = await nearIntents.verifierHasPublicKey(signerAccountId, publicKey, { rpcUrl });
  if (has.ok === true) return { ok: true, via: 'registry' };
  return { ok: false, via: 'registry', reason: has.ok === false ? 'key_not_registered' : has.reason };
}

// ── session lifecycle ─────────────────────────────────────────────────────
function createSession({ scope, curatorSlug, listingId, size, quantity, listCusd, curator, payee, bundle, sellerMode = 'hosted' }) {
  pruneSessions(Date.now());
  const config = negotiationConfig(curator);
  const listCents = Math.round(listCusd * 100);
  const floorPct = scope === 'tryon' ? config.tryOnFloorPct : config.floorPct;
  let floorCents = Math.ceil(listCents * floorPct);
  if (bundle && floorCents < listCents) {
    floorCents = Math.max(Math.round(listCents * 0.5), Math.round(floorCents * (1 - config.bundleDiscountPct)));
  }
  const session = {
    sessionId: `neg_${crypto.randomBytes(9).toString('hex')}`,
    scope: scope === 'tryon' ? 'tryon' : 'order',
    curatorSlug, listingId, size: size ?? null, quantity: quantity ?? null,
    listCents, floorCents,
    askCents: listCents, // seller's current price
    config, payee, bundle: !!bundle,
    sellerMode, // 'hosted' (platform policy+key) | 'sovereign' (seller's own process+key)
    pendingId: null, // live negotiation-mailbox item while awaiting the seller
    quoteToken: null, // stored on accept — hosted-minted or seller-supplied
    round: 0, stagnation: 0,
    status: 'open',
    history: [], // {actor:'buyer'|'seller', cents, round, why}
    expiresAt: Date.now() + SESSION_TTL_MS,
    agreedCents: null,
    createdAt: new Date().toISOString(),
  };
  sessions.set(session.sessionId, session);
  return session;
}

// Apply a seller's decision to a session — shared by the hosted policy
// (runRound in the route) and the sovereign mailbox (respond handler).
// The buyer's offer is pushed by the caller; this records the seller's move.
function applySellerDecision(session, { decision, priceCents, why, reasoning }) {
  if (decision === 'accept') {
    session.status = 'accepted';
    session.agreedCents = priceCents;
    session.askCents = priceCents;
  } else if (decision === 'reject') {
    session.status = 'rejected';
  } else {
    session.status = 'countered';
    session.askCents = priceCents;
  }
  session.reasoning = reasoning;
  session.pendingId = null;
  session.history.push({ actor: 'seller', cents: priceCents ?? null, round: session.round, why });
  saveSession(session);
}

function sessionSnapshot(s, extra = {}) {
  return {
    sessionId: s.sessionId,
    scope: s.scope,
    curatorSlug: s.curatorSlug,
    listingId: s.listingId,
    round: s.round,
    status: s.status,
    sellerMode: s.sellerMode,
    ...(s.status === 'pending_seller' && s.pendingId ? { pendingId: s.pendingId } : {}),
    listCusd: s.listCents / 100,
    sellerAskUsd: s.askCents / 100,
    agreedUsd: s.agreedCents !== null ? s.agreedCents / 100 : null,
    lastReasoning: s.reasoning ?? null,
    bundle: s.bundle,
    history: s.history.map((h) => ({ actor: h.actor, usd: h.cents / 100, round: h.round, why: h.why })),
    expiresAt: new Date(s.expiresAt).toISOString(),
    ...extra,
  };
}

module.exports = {
  createSession,
  getSession,
  saveSession,
  evaluateSellerPolicy,
  applySellerDecision,
  veniceReasoning,
  mintQuoteToken,
  verifyQuoteToken,
  authorizeQuoteSigner,
  hasHostedKey,
  trustedSignerAccounts,
  sessionSnapshot,
  negotiationConfig,
  canonicalPayload,
  base58Decode,
  base58Encode,
  SESSION_TTL_MS,
  BUNDLE_LOOKBACK_MS,
  // test seam
  _sessions: sessions,
};
