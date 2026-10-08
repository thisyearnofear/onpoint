/**
 * Share attribution helpers — single source of truth for the look-share growth
 * loop (see docs/guides/growth-loop.md).
 *
 * Events are stored in the existing `funnel_events` table (no new table):
 *   look_share | look_visit | look_cta   (metadata: lookSlug, shareId, channel, ...)
 * Downstream agent events (`tryon_complete`, `purchase`) carry `metadata.shareId`.
 */

const crypto = require('crypto');

const SHARE_ID_RE = /^[a-z0-9]{6,16}$/;
const CHANNELS = new Set([
  'copy', 'native', 'twitter', 'whatsapp', 'chatgpt', 'agent', 'direct', 'other',
]);
const CTA_KINDS = new Set(['tryon', 'shop']);

/** Minimum distinct shares before K is reported as a number. */
const MIN_SHARES_FOR_K = 30;

function newShareId() {
  return crypto.randomBytes(6).toString('hex'); // 12 chars [0-9a-f]
}

/** Returns a valid lowercase share id or null. Never trusts client input. */
function sanitizeShareId(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return SHARE_ID_RE.test(v) ? v : null;
}

/** Maps free-form utm/channel input onto the closed channel set. */
function sanitizeChannel(value) {
  if (typeof value !== 'string') return 'direct';
  const v = value.trim().toLowerCase();
  if (!v) return 'direct';
  if (v === 'x') return 'twitter';
  return CHANNELS.has(v) ? v : 'other';
}

function sanitizeCtaKind(value) {
  return CTA_KINDS.has(value) ? value : null;
}

/** Look slugs are lowercase slug strings (see lib/slugs.js). */
function sanitizeLookSlug(value) {
  if (typeof value !== 'string') return null;
  const v = value.trim().toLowerCase();
  return /^[a-z0-9-]{2,120}$/.test(v) ? v : null;
}

/**
 * Storefront-side steps reached after a look CTA click:
 *   arrive = landed on /s/:slug with a share id; tryon / buy = clicked
 *   "Try with AI" / a checkout link; order = started an M-Pesa payment.
 */
const STOREFRONT_KINDS = new Set(['arrive', 'tryon', 'buy', 'order']);
function sanitizeStorefrontKind(value) {
  return STOREFRONT_KINDS.has(value) ? value : null;
}

/**
 * Privacy-preserving visitor id: salted, day-scoped hash. Raw IP/UA are never
 * stored. Day scoping means the hash cannot link a visitor across days.
 */
function hashVisitor(ip, userAgent, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  const salt = process.env.VISITOR_HASH_SALT || 'onpoint-visitor';
  return crypto
    .createHash('sha256')
    .update(`${salt}|${day}|${ip || ''}|${userAgent || ''}`)
    .digest('hex')
    .slice(0, 24);
}

/**
 * True when the referral would pay an agent for its own purchase. Referral
 * codes derive from the agent address (`ref_<first 8 hex after 0x>`), and the
 * resolved agent address may also be compared directly.
 */
function isSelfReferral({ referralCode, agentAddress, payerAddress }) {
  if (!payerAddress || typeof payerAddress !== 'string') return false;
  const payer = payerAddress.toLowerCase();
  if (agentAddress && String(agentAddress).toLowerCase() === payer) return true;
  if (typeof referralCode === 'string' && /^0x[0-9a-f]{40}$/i.test(payer)) {
    return referralCode.toLowerCase() === `ref_${payer.slice(2, 10)}`;
  }
  return false;
}

/**
 * K-factor from aggregate counts.
 *   invitesPerSharer = shares / sharers
 *   conversion       = activatedShares / shares  (a share is "activated" when
 *                      it produced a CTA click, agent try-on, or purchase)
 *   k                = invitesPerSharer * conversion
 * Returns k=null with status 'insufficient_data' below MIN_SHARES_FOR_K.
 */
function computeKFactor({ shares = 0, sharers = 0, activatedShares = 0, visitedShares = 0 }) {
  const invitesPerSharer = sharers > 0 ? shares / sharers : 0;
  const visitRate = shares > 0 ? visitedShares / shares : 0;
  const conversion = shares > 0 ? activatedShares / shares : 0;
  const enough = shares >= MIN_SHARES_FOR_K;
  const round = (n) => Math.round(n * 1000) / 1000;
  return {
    status: enough ? 'measured' : 'insufficient_data',
    sampleShares: shares,
    minShares: MIN_SHARES_FOR_K,
    invitesPerSharer: round(invitesPerSharer),
    visitRate: round(visitRate),
    conversion: round(conversion),
    k: enough ? round(invitesPerSharer * conversion) : null,
  };
}

/**
 * Aggregate raw funnel rows into the share funnel.
 *
 * rows: [{ event_type, kind, share_id, look_slug, channel, actor }] where `actor` is
 * COALESCE(payer_address, visitor_hash). Rows without share_id are ignored.
 * Events by the same actor that created the share are treated as self-activity
 * and excluded, so sharing and then clicking your own link does not count.
 */
function summarizeShareFunnel(rows) {
  const shares = new Map(); // shareId -> { actor, channel, lookSlug }
  for (const r of rows) {
    if (r.event_type === 'look_share' && r.share_id && !shares.has(r.share_id)) {
      shares.set(r.share_id, { actor: r.actor || null, channel: r.channel || 'direct', lookSlug: r.look_slug || null });
    }
  }

  const stage = {
    look_visit: new Set(),
    look_cta: new Set(),
    storefront_arrive: new Set(),
    storefront_tryon: new Set(),
    storefront_buy: new Set(),
    storefront_order: new Set(),
    storefront_sale: new Set(),
    tryon_complete: new Set(),
    purchase: new Set(),
  };
  for (const r of rows) {
    const key = r.event_type === 'look_storefront' ? `storefront_${r.kind}` : r.event_type;
    const set = stage[key];
    if (!set || !r.share_id) continue;
    const share = shares.get(r.share_id);
    if (!share) continue; // downstream event for an unknown share id
    if (share.actor && r.actor && share.actor === r.actor) continue; // self
    set.add(r.share_id);
  }

  // Activation = any intent beyond viewing: look CTA, storefront try-on/buy/
  // order, confirmed M-Pesa sale, web or agent try-on, or agent purchase. Arrival alone does not count.
  const activated = new Set([
    ...stage.look_cta,
    ...stage.storefront_tryon,
    ...stage.storefront_buy,
    ...stage.storefront_order,
    ...stage.storefront_sale,
    ...stage.tryon_complete,
    ...stage.purchase,
  ]);

  const build = (ids) => {
    const idSet = new Set(ids);
    const sharers = new Set();
    for (const id of idSet) sharers.add(shares.get(id).actor || `anon:${id}`);
    const count = (set) => [...set].filter((id) => idSet.has(id)).length;
    return {
      shares: idSet.size,
      sharers: sharers.size,
      visits: count(stage.look_visit),
      ctaClicks: count(stage.look_cta),
      storefrontArrivals: count(stage.storefront_arrive),
      storefrontTryOns: count(stage.storefront_tryon),
      storefrontBuys: count(stage.storefront_buy),
      storefrontOrders: count(stage.storefront_order),
      confirmedSales: count(stage.storefront_sale),
      tryOns: count(stage.tryon_complete),
      purchases: count(stage.purchase),
      activated: count(activated),
    };
  };
  const kOf = (b) =>
    computeKFactor({
      shares: b.shares,
      sharers: b.sharers,
      activatedShares: b.activated,
      visitedShares: b.visits,
    });

  const allIds = [...shares.keys()];
  const overall = build(allIds);

  const groupBy = (keyFn) => {
    const groups = new Map();
    for (const [id, s] of shares) {
      const key = keyFn(s);
      if (!key) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(id);
    }
    return [...groups.entries()].map(([key, ids]) => {
      const b = build(ids);
      return { key, ...b, k: kOf(b) };
    });
  };

  return {
    overall: { ...overall, k: kOf(overall) },
    byChannel: groupBy((s) => s.channel).sort((a, b) => b.shares - a.shares),
    byLook: groupBy((s) => s.lookSlug).sort((a, b) => b.shares - a.shares).slice(0, 20),
  };
}

module.exports = {
  summarizeShareFunnel,
  MIN_SHARES_FOR_K,
  newShareId,
  sanitizeShareId,
  sanitizeChannel,
  sanitizeCtaKind,
  sanitizeStorefrontKind,
  sanitizeLookSlug,
  hashVisitor,
  isSelfReferral,
  computeKFactor,
};
