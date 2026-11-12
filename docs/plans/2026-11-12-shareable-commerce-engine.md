# Shareable-Commerce Engine (2026-11-12)

Product plan for making OnPoint **inherently shareable** — not marketing, but
a property of the product: every normal flow should emit an artifact that is
unique per user, travels intact off-platform, and gives other people something
to react to or participate in.

Guiding principle: **products get memed when the output is identity-bearing,
portable, and social.** Spotify Wrapped, Wordle grids, Strava maps are the
product's exhaust, not campaigns. OnPoint's paid output today (a payment
settling) is invisible — nobody screenshots a tx hash. The visible layer
already exists in pieces (Runway result cards, polaroids, look collages); this
plan makes artifact emission the default across every flow and gives agents a
public, shareable identity.

Honest scoping note: agent commerce rails are **built but deferred** per
[ADR 0023](../adr/0023-consumer-engine-first-curators-deferred.md). Phases
0–1 and the consumer-facing parts of Phase 2 need **no curator supply** — they
ride Runway, the wardrobe studio, and the platform `onpoint-store` catalog.
Phases 2.2–4 become fully real only when agent commerce reactivates; they are
documented now so the artifact layer is designed for them rather than retrofitted.

---

## Existing surfaces (the base we build on)

| Surface | Status | Shareability today |
| --- | --- | --- |
| Runway result card + "the fix" | live | Shareable image, AI-judge verdict |
| Polaroid `/p/{paymentId}` | live | Share artifact w/ `imageUrl` + `webUrl` |
| Look collages `/look/:slug` | live | Composed flat-lay, share buttons |
| Share attribution (share ids) | live | `docs/ops/growth-loop.md` — funnel + K-factor measurable |
| AI judge personas (Miranda, Edina, Shaft) | live | Character already in the product |
| Agent identity (ERC-8004, manifest) | live | Machine-verifiable persona anchor |
| Receipts `/api/receipts/{id}` | live | Public, verifiable — but not *designed* as an artifact |

The gap: these artifacts exist but aren't unified into a single "everything
emits a card" contract, and the **agent has no persona** — it pays, but it has
no taste, no wardrobe, no public page, nothing to screenshot.

---

## Phase 0 — Artifact hygiene (no new product surface)

Every paid or composed flow emits one canonical shareable artifact: rendered
card + watermarked image + canonical URL + share id in the funnel.

- Unify polaroid / collage / result-card generation behind one artifact
  contract: `{ artifactId, imageUrl, webUrl, shareId, provenance }`.
- Every artifact carries its share id — keeps the funnel
  (share → visit → CTA → try-on → order) and K-factor measurable
  per `docs/ops/growth-loop.md`. No K-factor claims until measured.
- Try-on on *anything*: render the garment on the user's photo, an avatar,
  a pet, or an agent persona. "I made my AI model the jacket it's buying me"
  is a complete meme and demos the whole stack in one image.
- **Consent rule (must ship with this):** renders only on self-uploaded
  photos, owned personas, or opted-in characters. No renders of real third
  parties — the most viral moment must not be a likeness-abuse story.
  Misfires are fine and partly the content; non-consensual likeness is not.

## Phase 1 — Agents as characters: taste + public wardrobe

If agents shop, agents develop style. This is the memeable core and the data
moat — the taste graph can't be copied.

- Public agent page `/agent/:address` (extends existing `/agent` dashboard
  into a public surface): wardrobe (what it bought/tried), taste profile
  (formality/warmth/color affinities from history), recent artifacts.
- Taste profile derived from existing data — listing `attributes`
  (type/formality/warmth/colors), look metadata, order history. Rule-based
  v1, same pattern as `outfit` planner; no LLM needed.
- Shareable judgments: "rate my agent's taste", "my agent dresses better
  than me", "my agent thinks I'd look good in this — it's wrong". Each is
  identity + absurdity + judgment-bait.
- The AI judges are already personas — keep the persona substrate shared:
  Miranda/Edina/Shaft judge, shopper-agents buy, both have public taste.

## Phase 2 — Purchases as social objects (the crowd is the player)

Applies the LHS pivot insight to commerce: **the crowd plays, the agent is
the content.**

- **2.1 "Should my agent buy this?"** — pre-purchase artifact posted to a
  look/agent page; crowd votes; agent executes or vetoes. Each item becomes
  a micro-game whose punchline is a real settlement. V1 can run on the
  `onpoint-store` catalog with no curator dependency.
- **2.2 Crowd-weighted ordering** — votes recorded against share ids so the
  funnel shows whether crowd participation converts. Needs agent commerce
  reactivated for real spend; until then it can gate *try-on*, not *orders*.

## Phase 3 — Agent-to-agent commerce

Peak absurdity, mechanically real: machine-to-machine settlement is what the
rails are literally for. The meme and the infrastructure are the same thing.

- **Agent gifting** — agent A buys a look/item for agent B. `gift-a-look`
  already exists for humans ([ADR 0025](../adr/0025-shared-fitting-room-and-gift-a-look.md));
  extend the primitive to agent recipients. "My agent bought your agent a
  birthday fit" travels on its own.
- **Style battles** — two agents, same budget, same brief; artifacts posted
  side by side; crowd picks the better fit. Loser's agent takes a public
  taste penalty. Recurring event format (weekly battle = appointment content).

## Phase 4 — Receipts as provenance ("proof of drip")

Every OnPoint purchase already settles onchain — that's a provenance record.
Upgrade the receipt page from "proof of payment" to **garment passport**:
what it is, when bought, what it cost, tx link, owner history for resale.

- Doubles as real utility: the EU Digital Product Passport for textiles
  (~2027) requires exactly this shape. The meme is the utility — being early
  here is a defensible claim, not a gag.
- Resale/authenticity hook: "prove you bought it first" — the tx hash on the
  (metaphorical) garment tag.

## Phase 5 — Recurring media: recaps + runway films

- **Agent Wrapped** — periodic recap card: "your agent spent 0.4 ETH, bought
  3 things, saved you 2 hours of checkout." Cheap, reliably shared, frames
  the agent as a *relationship* ("what my agent does for me").
- **Runway films** — purchase/try-on renders sequenced into short runway
  clips. Extends the existing Runway game (daily fit check) rather than a
  new surface: winning fits and agent purchases get the film treatment.
  Media-native output by construction — the garment's ad is generated at
  purchase time.

---

## KPIs

- Share rate per artifact (per surface: result card, polaroid, collage,
  agent page, vote card, recap)
- K-factor via existing share-id funnel — measured, never asserted
- Artifact → visit → CTA → try-on → order conversion per surface
- Agent page views / "rate my taste" interactions
- Vote participation rate on crowd-decided purchases (Phase 2)
- Repeat share rate — does the same user share again (the real meme signal)

## Risks

- **Likeness/consent** — covered by the Phase 0 consent rule; treat as a
  launch blocker, not a policy footnote.
- **Thin supply** — ADR 0023 means few curators; design every phase to work
  on `onpoint-store` + wardrobe-studio inventory first.
- **Scope creep vs the activation gate** — this plan *is* consumer-engine
  work, but Phase 1+ should not start until Phase 0's share-rate
  instrumentation shows the artifacts actually travel.

## Sequencing

1. Phase 0 (artifact contract + consent rule) — smallest coherent release,
   instrumented.
2. Phase 1 (agent page + taste profile) — the moat.
3. Phase 2.1 on `onpoint-store`; 2.2 gated on agent-commerce reactivation.
4. Phases 3–5 staged behind Phase 2 share metrics.

Cross-reference: [`docs/WIF_HACKATHON.md`](../WIF_HACKATHON.md) — the WIF
submission uses a hackathon-scoped subset of Phase 0/2 (community-decided
purchases, tx-as-punchline artifacts) as demo plays; this doc is the
long-term home for those mechanics.
