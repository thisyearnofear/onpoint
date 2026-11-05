# ADR 0026: Couple styling ("couple goals") — viral loop spec

- Status: **Implemented** (2026-11-05) — `POST /api/couple/render`, `GET /api/couple/card/:id`, `couple_cards` table, `/couple` + `/c/{id}` + `/cards` feed. v1 uses the deterministic sharp composite (fallback path), not paired-subject generative render.
- Date: 2026-11-05
- Extends: ADR 0025 (try-on invite + gift claim)

## The idea

Upload one photo of *two people* + pick a look (or a theme) → get a
paired styled render: both of you in coordinated outfits, one card.
"Couple goals" is already a social-native format — the output IS the
share artifact. Every card carries both people and the items.

Why it's innate rather than bolted-on virality: the sender (him) makes
the card, but the model (her) is *in* it — she has maximum incentive to
reshare because it's her image improved, not an ad. The content markets
the product: "made with OnPoint" on the card is attribution baked into
something people already want to post.

## The loop

```
couple photo + look/theme
  → paired render card (couple goals card)
  → she reshares (attribution in the artifact)
  → her friends want cards (new users enter at /try)
  → "get this look" on the card → storefront/listing → gift claim (ADR 0025)
  → purchases attributed to the loop
```

Each hop reuses a shipped primitive: try-on render, look composition,
polaroid/share cards, invite tokens, gift claims, earnings ledger.

## UX flow

1. **Entry** — `/couple` (or a "Style us" CTA on looks/lab). Upload one
   couple photo OR two separate photos stitched server-side (v1: one
   photo of both people — simplest, no composition needed).
2. **Pick the vibe** — a theme or a look: "date night", "matching
   streetwear", "wedding guest", or a specific look slug → pulls its
   items. Budget cap optional (`maxCusd`).
3. **Render** — backend produces the paired card: both subjects in the
   coordinated outfits, tiled item strip at the bottom (the sellable
   part), OnPoint mark. Falls back to "styled them for you" single
   renders side-by-side if the upstream model can't do two subjects —
   the card format works either way.
4. **Share** — card page at `/p/{id}` with the existing share buttons +
   one new action: *"Send her half"* → generates a try-on invite
   (ADR 0025) preloaded with the item on *her* side of the card. The
   loop literally feeds feature 1.
5. **Buy** — each item on the card is a shoppable listing link; "gift
   this" routes into the gift-claim flow. Her friends land on
   `/try/{token}` or `/couple` and start their own cards.

## API surface

```
POST /api/couple/render   { photoData, lookSlug?|listingIds[]?, theme? }
                          → { cardId, cardUrl, items: [{ listingId, side: "his"|"hers", orderEndpoint }] }
GET  /couple              → public entry page
GET  /c/{cardId}          → public card page (share target, SEO/OG image)
```

Reuses the virtual-tryon upstream. The only new backend surface is the
paired-render call + a card record (`couple_cards`: id, render_key,
item_ids, sender, created_at) so `/c/{cardId}` persists as the share
target — same role `/p/{polaroid}` plays for single try-ons.

## The honest constraints

- **Render capability is the open question.** Single-garment try-on is
  shipped; two-subject coordinated styling depends on what the upstream
  image model tolerates. Mitigation: v1 degrades to two solo renders
  composed into one card — the viral mechanics don't depend on true
  paired rendering.
- **Two photos vs one**: start with one couple photo (zero stitching).
  Two-photo merge is v2 — it's an image-compose problem, not a product one.
- **Consent/boundary**: the card contains *her* image made by *him*. The
  share flow should present the card to both parties before it goes
  public — `/c/{cardId}` unlisted-by-default, and a "remove this" path
  on the card page. Cheap to add, non-negotiable to ship.
- **Sales motion is downstream, not upfront**: the card leads with the
  photo, not the products — items sit in the tile strip and the "get
  this look" step. Burying the merch under the moment is what makes it
  shareable; making merch the hero is what would kill it.

## MVP cut

1. `/couple` page: photo upload + theme/look picker + render call +
   card display. (One route, one client component — same shape as
   `/try/[token]`.)
2. `POST /api/couple/render` → single upstream render of the pair if
   supported, else two solo renders tiled into one card server-side.
3. `/c/{cardId}` public page with share buttons + "Send her half" →
   ADR 0025 invite. Card record table for persistence.
4. Gift CTA per item → ADR 0025 claim flow (when built).

Estimated: 2 API routes, 2 pages, 1 table, reuse of render/share infra.
Small-medium. The risk sits entirely in step 2's render quality, and
the fallback keeps it shippable regardless.
