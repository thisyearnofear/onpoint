/**
 * Agent Negotiation Route — /api/curator/{slug}/negotiate
 *
 * Multi-round haggling between a buyer agent and a seller policy with
 * memory — not a one-shot floor check. Buyer opens a session with an offer;
 * every POST either counters, accepts (mints an ed25519-signed quote token),
 * or refuses with reasoning. The same protocol wraps the try-on service
 * (scope: "tryon") so the buyer hires the stylist the same way.
 *
 *   POST /api/curator/mo/negotiate
 *     { scope:"order", listingId, size:"M", quantity:1, offerUsd:17,
 *       nearAccountId:"agent.onpoint.testnet" }
 *     → { sessionId, round:1, status:"countered", counterOffer:{offerUsd}, reasoning }
 *
 *   POST /api/curator/mo/negotiate/neg_abc123
 *     { offerUsd: 17.60 }                          → next round
 *     { action: "accept" }                         → accept the seller's ask
 *     → { status:"accepted", agreedUsd, quoteToken:{payload, signature, signer} }
 *
 * The quoteToken is redeemed on POST /api/curator/{slug}/order or
 * /api/agent/try-on as { quoteToken } — the agreed price is bound by the
 * seller's signature, not the client.
 */

const express = require('express');
const { getDb } = require('../lib/db');
const { curators, listings, kitSkus, payments } = require('@repo/db');
const { eq, and, gte, desc } = require('drizzle-orm');
const {
  kesToCusd, tryOnPriceCusd, normalizeSize,
} = require('../lib/agent-commerce');
const { nearPayoutAccount } = require('../lib/near-payments');
const neg = require('../lib/agent-negotiation');
const presence = require('../lib/seller-presence');
const mailbox = require('../lib/negotiation-mailbox');
const pendingNegotiations = require('./pending-negotiations');
const { verifySessionToken } = require('../lib/agent-session');
const { extractSessionToken } = require('../middleware/agent-session');
const { timingSafeStringEqual } = require('../middleware/service-key-auth');

const router = express.Router();

function findSize(listing, size) {
  const requested = normalizeSize(size || 'M');
  return (listing.sizes || []).find((e) => normalizeSize(e.size) === requested);
}

async function loadListing(db, slug, listingId) {
  const [row] = await db
    .select({ listing: listings, curator: curators, kit: kitSkus })
    .from(listings)
    .innerJoin(curators, eq(listings.curatorSlug, curators.slug))
    .leftJoin(kitSkus, eq(listings.skuId, kitSkus.id))
    .where(eq(listings.id, listingId))
    .limit(1);
  if (!row || row.curator.slug !== slug) return null;
  return row;
}

// Bundle context: the buyer hired a stylist (paid a try-on) within the hour —
// the seller can afford a deeper cut. Memory of the relationship, not just
// the round.
async function hiredStylistRecently(db, nearAccountId) {
  if (!nearAccountId) return false;
  const since = new Date(Date.now() - neg.BUNDLE_LOOKBACK_MS);
  const [row] = await db
    .select({ id: payments.id })
    .from(payments)
    .where(and(
      eq(payments.purpose, 'try_on'),
      eq(payments.payerAddress, String(nearAccountId).toLowerCase()),
      gte(payments.createdAt, since),
    ))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  return !!row;
}

// Run one policy round: record the buyer's offer, decide, record the seller's
// move, then give the decision a voice (Venice when configured).
async function runRound(session, offerCents) {
  session.round += 1;

  // Evaluate against history BEFORE recording this offer — the fatigue check
  // compares this offer to the buyer's previous one.
  const decision = neg.evaluateSellerPolicy(session, offerCents);
  const llmText = await neg.veniceReasoning({ session, decision, priceCents: decision.priceCents, offerCents });
  const reasoning = llmText || decision.reasoning;

  session.history.push({ actor: 'buyer', cents: offerCents, round: session.round });
  neg.applySellerDecision(session, {
    decision: decision.decision,
    priceCents: decision.priceCents,
    why: decision.why,
    reasoning,
  });
  return decision;
}

// Sovereign round: the buyer's offer goes to the SELLER'S OWN PROCESS through
// the negotiation mailbox — the platform doesn't decide and can't sign.
function enqueueRound(session, offer) {
  session.round += 1;
  session.history.push({
    actor: 'buyer',
    cents: offer.kind === 'offer' ? offer.cents : session.askCents,
    round: session.round,
    why: offer.kind === 'accept' ? 'accepted_ask' : undefined,
  });
  const item = mailbox.enqueue({
    sessionId: session.sessionId,
    payee: session.payee,
    round: session.round,
    offer,
    context: {
      scope: session.scope,
      curatorSlug: session.curatorSlug,
      listingId: session.listingId,
      size: session.size,
      quantity: session.quantity,
      listCents: session.listCents,
      askCents: session.askCents,
      bundle: session.bundle,
      history: session.history.map((h) => ({ actor: h.actor, cents: h.cents, round: h.round, why: h.why })),
    },
  });
  session.status = 'pending_seller';
  session.sellerMode = 'sovereign';
  session.pendingId = item.pendingId;
  neg.saveSession(session);
  return item;
}

function pendingBody(session) {
  return neg.sessionSnapshot(session, {
    sellerMode: 'sovereign',
    note: 'Offer is with the seller’s own agent — poll GET /api/negotiations/' + session.sessionId,
  });
}

// Who is deciding this round right now? Fresh heartbeat → the seller's own
// process; stale → the hosted fallback, which only exists when the platform
// holds a key for the payee. Payees with no hosted key stay sovereign-or-
// nothing — the platform physically cannot sign as them.
function roundMode(session) {
  if (presence.isFresh(session.payee)) return 'sovereign';
  return neg.hasHostedKey(session.payee) ? 'hosted' : 'sovereign';
}

function acceptedBody(session) {
  // Hosted mints here; sovereign stores the seller-supplied token on accept.
  if (!session.quoteToken) {
    session.quoteToken = neg.mintQuoteToken({
      scope: session.scope,
      curatorSlug: session.curatorSlug,
      listingId: session.listingId,
      size: session.size,
      quantity: session.quantity,
      agreedCusd: session.agreedCents / 100,
      sessionId: session.sessionId,
      payee: session.payee,
    });
  }
  const token = session.quoteToken;
  return neg.sessionSnapshot(session, {
    quoteToken: token,
    redeem: session.scope === 'tryon'
      ? { endpoint: '/api/agent/try-on', body: '{ curatorSlug, listingId, photoData, quoteToken, nearAccountId, nearTxHash }' }
      : { endpoint: `/api/curator/${session.curatorSlug}/order`, body: '{ listingId, size, quantity, quoteToken, nearAccountId, nearTxHash }' },
    verify: {
      signatureScheme: 'ed25519 over canonical JSON payload',
      publicKey: token.signer?.publicKey ?? null,
      note: 'Verify offline with the signer publicKey, or check it against the signer account\'s keys on-chain.',
    },
  });
}

// ── POST /api/curator/:slug/negotiate — open a session with an offer ──────
router.post('/:slug/negotiate', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  if (!/^[a-z0-9-]{2,48}$/.test(slug)) return res.status(400).json({ error: 'Invalid curator slug' });

  const { listingId, size, offerUsd, nearAccountId } = req.body || {};
  const scope = req.body?.scope === 'tryon' ? 'tryon' : 'order';
  const quantity = Number(req.body?.quantity ?? 1);
  if (!listingId || typeof listingId !== 'string') return res.status(400).json({ error: 'listingId is required' });
  if (scope === 'order' && (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)) {
    return res.status(400).json({ error: 'quantity must be an integer between 1 and 10' });
  }
  const offerCents = Math.round(Number(offerUsd) * 100);
  if (!Number.isFinite(offerCents) || offerCents <= 0) {
    return res.status(400).json({ error: 'offerUsd must be a positive USD amount — open the session with your first offer' });
  }

  let db;
  try {
    db = getDb({ curators, listings, kitSkus, payments });
  } catch {
    return res.status(503).json({ error: 'Database not configured' });
  }

  try {
    const row = await loadListing(db, slug, listingId);
    if (!row) return res.status(404).json({ error: 'Listing not found for this curator' });
    if (row.listing.status !== 'live') return res.status(409).json({ error: 'Listing is not live' });

    let listCusd, sizeOut = null;
    if (scope === 'tryon') {
      listCusd = tryOnPriceCusd(row.curator, row.listing.inventoryType);
      if (listCusd === null) return res.status(409).json({ error: 'Listing is not available for try-on negotiation' });
    } else {
      if (row.listing.inventoryType === 'digital') {
        return res.status(409).json({ error: 'Digital listings are try-on only — negotiate with { "scope": "tryon" }' });
      }
      const sizeEntry = findSize(row.listing, size);
      if (!sizeEntry) return res.status(404).json({ error: `Size not found: ${normalizeSize(size || 'M')}` });
      if (Number(sizeEntry.stock) < quantity) return res.status(409).json({ error: `Insufficient stock for size ${normalizeSize(size || 'M')}` });
      const unitCusd = kesToCusd(sizeEntry.price);
      if (unitCusd === null) return res.status(409).json({ error: 'Listing has no valid price' });
      listCusd = (Math.round(unitCusd * 100) * quantity) / 100;
      sizeOut = normalizeSize(size || 'M');
    }

    const bundle = await hiredStylistRecently(db, nearAccountId).catch(() => false);
    const session = neg.createSession({
      scope, curatorSlug: slug, listingId,
      size: sizeOut, quantity: scope === 'order' ? quantity : null,
      listCusd, curator: row.curator,
      payee: nearPayoutAccount(row.curator),
      bundle,
      sellerMode: presence.isFresh(nearPayoutAccount(row.curator)) ? 'sovereign' : 'hosted',
    });

    // Sovereign payee (its seller process is alive) → the offer goes to the
    // mailbox for THEIR agent to decide. Hosted → the platform policy answers.
    if (roundMode(session) === 'sovereign') {
      enqueueRound(session, { kind: 'offer', cents: offerCents });
      return res.status(202).json(pendingBody(session));
    }
    session.sellerMode = 'hosted';
    const decision = await runRound(session, offerCents);
    const body = neg.sessionSnapshot(session, {
      counterOffer: session.status === 'countered' ? { offerUsd: session.askCents / 100, currency: 'USD' } : undefined,
      reasoning: session.reasoning,
      seller: { policy: 'floor + margin target + round fatigue' + (bundle ? ' + bundle credit (stylist hired)' : ''), decision: decision.why },
      negotiate: { next: `POST /api/curator/${slug}/negotiate/${session.sessionId} with { "offerUsd": <your counter> } or { "action": "accept" }` },
    });
    if (session.status === 'accepted') return res.json(acceptedBody(session));
    return res.json(body);
  } catch (err) {
    console.error('negotiate open failed', err);
    return res.status(500).json({ error: 'Negotiation failed' });
  }
});

// ── POST /api/curator/:slug/negotiate/:sessionId — continue a round ────────
router.post('/:slug/negotiate/:sessionId', async (req, res) => {
  const session = neg.getSession(req.params.sessionId);
  if (!session || session.curatorSlug !== String(req.params.slug).toLowerCase()) {
    return res.status(404).json({ error: 'Negotiation session not found or expired' });
  }
  if (session.status === 'expired') return res.json(neg.sessionSnapshot(session));
  if (session.status === 'accepted') return res.json(acceptedBody(session));
  if (session.status === 'rejected') return res.json(neg.sessionSnapshot(session));

  // Awaiting the seller's process — first let an expired pending item resolve
  // (dead seller → hosted fallback where a hosted key exists).
  if (session.status === 'pending_seller') {
    await pendingNegotiations.resolvePendingSession(session).catch(() => session);
    if (session.status === 'pending_seller') {
      // Still waiting — a fresh offer supersedes the pending one; accept/walk
      // are answered below.
      const { action } = req.body || {};
      if (action === 'walk') {
        session.status = 'rejected';
        session.reasoning = 'Buyer walked away.';
        neg.saveSession(session);
        return res.json(neg.sessionSnapshot(session));
      }
      if (action === 'accept') {
        enqueueRound(session, { kind: 'accept' });
        return res.status(202).json(pendingBody(session));
      }
      const offerCents = Math.round(Number(req.body?.offerUsd) * 100);
      if (Number.isFinite(offerCents) && offerCents > 0) {
        enqueueRound(session, { kind: 'offer', cents: offerCents });
        return res.status(202).json(pendingBody(session));
      }
      return res.status(202).json(pendingBody(session));
    }
    // Resolved by the hosted fallback — report the outcome now.
    if (session.status === 'accepted') return res.json(acceptedBody(session));
    return res.json(neg.sessionSnapshot(session, {
      counterOffer: session.status === 'countered' ? { offerUsd: session.askCents / 100, currency: 'USD' } : undefined,
      reasoning: session.reasoning,
    }));
  }

  const { action } = req.body || {};
  if (action === 'accept') {
    // Buyer takes the seller's current ask. Sovereign seller → the signed
    // commitment still belongs to the seller's process.
    if (roundMode(session) === 'sovereign') {
      enqueueRound(session, { kind: 'accept' });
      return res.status(202).json(pendingBody(session));
    }
    session.sellerMode = 'hosted';
    session.round += 1;
    session.history.push({ actor: 'buyer', cents: session.askCents, round: session.round, why: 'accepted_ask' });
    session.status = 'accepted';
    session.agreedCents = session.askCents;
    session.reasoning = 'Done — locked at my asking price.';
    neg.saveSession(session);
    return res.json(acceptedBody(session));
  }
  if (action === 'walk') {
    session.status = 'rejected';
    session.reasoning = 'Buyer walked away.';
    neg.saveSession(session);
    return res.json(neg.sessionSnapshot(session));
  }

  const offerCents = Math.round(Number(req.body?.offerUsd) * 100);
  if (!Number.isFinite(offerCents) || offerCents <= 0) {
    return res.status(400).json({ error: 'offerUsd must be a positive USD amount — or send { "action": "accept" | "walk" }' });
  }
  try {
    if (roundMode(session) === 'sovereign') {
      enqueueRound(session, { kind: 'offer', cents: offerCents });
      return res.status(202).json(pendingBody(session));
    }
    session.sellerMode = 'hosted';
    await runRound(session, offerCents);
    if (session.status === 'accepted') return res.json(acceptedBody(session));
    return res.json(neg.sessionSnapshot(session, {
      counterOffer: session.status === 'countered' ? { offerUsd: session.askCents / 100, currency: 'USD' } : undefined,
      reasoning: session.reasoning,
    }));
  } catch (err) {
    console.error('negotiate round failed', err);
    return res.status(500).json({ error: 'Negotiation failed' });
  }
});

// ── GET /api/curator/:slug/negotiate/:sessionId — inspect ─────────────────
router.get('/:slug/negotiate/:sessionId', async (req, res) => {
  const session = neg.getSession(req.params.sessionId);
  if (!session || session.curatorSlug !== String(req.params.slug).toLowerCase()) {
    return res.status(404).json({ error: 'Negotiation session not found or expired' });
  }
  await pendingNegotiations.resolvePendingSession(session).catch(() => session);
  return res.json(pendingNegotiations.sessionSnapshotForBuyer(session));
});


// ── POST /api/curator/:slug/near-account — self-serve payee wiring ────────
// A merchant binds their own NEAR account to their storefront's
// commerce.nearAccountId. Auth is either the ops service key, or a wallet
// session whose address is an owner wallet of this curator
// (commerce.walletAddress / custodialWalletAddress). For session
// registration the account must NOT live under the platform account —
// a hosted account implies the platform holds a key for it, which is
// exactly the custody claim sovereign merchants exist to disprove.
const NEAR_ACCOUNT_ID = /^(?=.{2,64}$)([a-z0-9_-]+\.)*[a-z0-9_-]+$/;
const PLATFORM_NEAR_ACCOUNT = process.env.NEAR_PLATFORM_ACCOUNT || 'onpoint.testnet';
const NEAR_RPC = process.env.NEAR_RPC_URL || 'https://rpc.testnet.fastnear.com';

function nearAccountExists(accountId) {
  return fetch(NEAR_RPC, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 'near-account-check', method: 'query',
      params: { request_type: 'view_account', finality: 'final', account_id: accountId },
    }),
  })
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (typeof body?.result?.amount === 'string') return true;
      const blob = JSON.stringify(body?.error ?? '');
      if (blob.includes('does not exist') || blob.includes('UNKNOWN_ACCOUNT')) return false;
      return null; // RPC answered but the shape is unknown — be honest
    })
    .catch(() => null);
}

function isPlatformAccount(accountId) {
  return accountId === PLATFORM_NEAR_ACCOUNT || accountId.endsWith(`.${PLATFORM_NEAR_ACCOUNT}`);
}

function curatorOwnerWallets(curator) {
  return [curator.commerce?.walletAddress, curator.commerce?.custodialWalletAddress]
    .filter(Boolean)
    .map((w) => String(w).toLowerCase());
}

router.post('/:slug/near-account', async (req, res) => {
  const slug = String(req.params.slug || '').toLowerCase();
  const nearAccountId = String(req.body?.nearAccountId || '').trim().toLowerCase();

  if (!NEAR_ACCOUNT_ID.test(nearAccountId)) {
    return res.status(400).json({ error: 'nearAccountId is not a valid NEAR account id' });
  }

  let db;
  try {
    db = getDb({ curators });
  } catch {
    return res.status(503).json({ error: 'Database not configured' });
  }

  // Auth: ops service key, or a wallet session that owns the storefront.
  const serviceKey = process.env.SERVICE_API_KEY;
  const providedKey = req.headers['x-service-key'];
  const isService =
    typeof providedKey === 'string' && serviceKey && timingSafeStringEqual(providedKey, serviceKey);

  let sessionWallet = null;
  if (!isService) {
    const token = extractSessionToken(req);
    const payload = token && verifySessionToken(token);
    if (!payload?.sub) {
      return res.status(401).json({
        error: 'Curator wallet session required (or ops service key)',
        code: 'SESSION_REQUIRED',
        hint: 'Sign in via /api/auth/challenge + /api/auth/verify with the curator payout wallet.',
      });
    }
    sessionWallet = String(payload.sub).toLowerCase();
  }

  try {
    const [curator] = await db.select().from(curators).where(eq(curators.slug, slug)).limit(1);
    if (!curator) return res.status(404).json({ error: 'Curator not found' });

    if (sessionWallet && !curatorOwnerWallets(curator).includes(sessionWallet)) {
      return res.status(403).json({
        error: 'Authenticated wallet does not own this storefront',
        hint: 'Sign in with the curator payout wallet (commerce.walletAddress).',
      });
    }

    // External merchants register sovereign accounts only — the platform
    // must be unable to sign as the payee. Service-keyed ops wiring (e.g.
    // seeding onpoint-store) may bind hosted subaccounts.
    if (!isService && isPlatformAccount(nearAccountId)) {
      return res.status(403).json({
        error: `External merchants must register an account outside ${PLATFORM_NEAR_ACCOUNT} — the platform holds keys for its subaccounts, so a hosted payee would be provably non-sovereign.`,
      });
    }

    const exists = await nearAccountExists(nearAccountId);
    if (exists === null) {
      return res.status(502).json({ error: 'Could not verify account on-chain — NEAR RPC unreachable or returned an unexpected shape' });
    }
    if (exists === false) {
      return res.status(404).json({ error: `No NEAR account exists at ${nearAccountId} — create it before wiring the payee` });
    }

    const commerce = { ...(curator.commerce || {}), nearAccountId };
    await db.update(curators).set({ commerce }).where(eq(curators.slug, slug));

    return res.json({
      ok: true,
      slug,
      nearAccountId,
      sovereign: !isPlatformAccount(nearAccountId),
      auth: isService ? 'service' : 'curator-wallet',
      next: 'Run your seller process: SELLER=<account> SELLER_KEY=<secret> node scripts/near-spike/seller-agent.mjs — it heartbeats, answers negotiation offers with your own policy, executes intents, and collects.',
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to bind nearAccountId' });
  }
});

module.exports = router;
