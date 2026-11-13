/**
 * The seller's OWN pricing policy — deliberately independent of the API's
 * agent-negotiation.js. Sovereignty is the point: this process holds the
 * payee's key and decides its own prices; the platform is only the mailbox.
 *
 * Config (seller-policy.json next to near-credentials.testnet.json):
 *   { "<payee>": { floorPct, tryOnFloorPct, marginPct, bundleDiscountPct,
 *                  maxRounds, reasoningTone } }
 * Missing payee/config → the defaults below.
 *
 * decide(item, myAccountId, cfg) →
 *   { decision:"counter"|"refuse"|"accept", priceCents?, reasoning }
 * On "accept" the caller signs a quoteToken at the agreed price.
 */

const DEFAULTS = {
  floorPct: 0.9,          // hard cost floor for goods
  tryOnFloorPct: 0.6,     // a stylist won't work below render cost
  marginPct: null,        // target — default midpoint of the haggle band
  bundleDiscountPct: 0.03,// a buyer who hired the stylist gets a deeper floor
  maxRounds: 5,           // patience
  reasoningTone: "plain",
};

export function policyFor(cfg, payee) {
  return { ...DEFAULTS, ...(cfg?.[payee] ?? cfg?.default ?? {}) };
}

const usd = (c) => (c / 100).toFixed(2);

export function decide(item, cfg) {
  const ctx = item.context || {};
  const listCents = ctx.listCents;
  const history = ctx.history || [];
  const isTryOn = ctx.scope === "tryon";
  const floorPct = isTryOn ? cfg.tryOnFloorPct : cfg.floorPct;
  let floorCents = Math.ceil(listCents * floorPct);
  if (ctx.bundle && floorCents < listCents) {
    floorCents = Math.max(Math.round(listCents * 0.5), Math.round(floorCents * (1 - cfg.bundleDiscountPct)));
  }
  const targetCents = Math.max(floorCents, Math.round(listCents * (cfg.marginPct ?? (floorPct + (1 - floorPct) / 2))));
  const askCents = ctx.askCents ?? listCents;
  const round = item.round;
  const offerCents = item.offer?.kind === "offer" ? item.offer.cents : askCents;
  const lastBuyerOffer = [...history].reverse().find((h) => h.actor === "buyer" && h.round < round)?.cents ?? null;

  // Buyer accepting our ask outright → deal at the ask.
  if (item.offer?.kind === "accept" || offerCents >= askCents) {
    return {
      decision: "accept", priceCents: askCents, why: "met_ask",
      reasoning: `Deal — ${usd(askCents)} meets my price. Locking it in.`,
    };
  }
  // Out of patience.
  if (round > cfg.maxRounds) {
    return {
      decision: "refuse", why: "rounds_exhausted",
      reasoning: `We've gone ${cfg.maxRounds} rounds and you're still under ${usd(targetCents)}. I have other buyers — walking.`,
    };
  }
  // Stagnant offers → fatigue, two strikes.
  const stagnation = countStagnant(history, round);
  if (lastBuyerOffer !== null && offerCents <= lastBuyerOffer) {
    if (stagnation >= 1) {
      return {
        decision: "refuse", why: "stagnant_offers",
        reasoning: "Your offers stopped moving — that tells me you're not serious. I'm out.",
      };
    }
    return {
      decision: "counter", priceCents: askCents, why: "stagnant_offer",
      reasoning: `That's the same offer again (or worse). Improve it or we're done — ${usd(askCents)} stands.`,
    };
  }
  // Below the floor → refuse insultingly-low, hold the floor otherwise.
  if (offerCents < floorCents) {
    if (offerCents < Math.round(floorCents * 0.6)) {
      return {
        decision: "refuse", why: "insulting_offer",
        reasoning: `${usd(offerCents)} is below my cost. No deal — not at any number close to that.`,
      };
    }
    return {
      decision: "counter", priceCents: floorCents, why: "below_floor",
      reasoning: `${usd(offerCents)} is below my floor${ctx.bundle ? " even after the bundle credit" : ""} — I can't sell at a loss. ${usd(floorCents)} is the lowest I go.`,
    };
  }
  // Haggle band — concede less each round, never below floor.
  const gap = askCents - floorCents;
  const counterCents = Math.max(floorCents, askCents - Math.ceil(gap / 2));
  if (offerCents >= counterCents) {
    return {
      decision: "accept", priceCents: offerCents, why: "acceptable_offer",
      reasoning: `${usd(offerCents)} works — that's inside my margin. Done.`,
    };
  }
  return {
    decision: "counter", priceCents: counterCents, why: "haggling",
    reasoning: `${usd(offerCents)} is close but light. I can do ${usd(counterCents)}${ctx.bundle ? " (you hired the stylist — bundle credit applied)" : ""} — each round I move less.`,
  };
}

function countStagnant(history, round) {
  // consecutive buyer offers that didn't improve on the one before
  const buyers = history.filter((h) => h.actor === "buyer");
  let n = 0;
  for (let i = buyers.length - 1; i > 0 && buyers[i].round < round; i--) {
    if (buyers[i].cents <= buyers[i - 1].cents) n++;
    else break;
  }
  return n;
}
