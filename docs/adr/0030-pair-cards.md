# ADR 0030: Pair cards — "same fit, both of us"

- Status: **Implemented** (2026-11-09) — `POST /api/pair`, `GET /api/pair/:id`, `POST /api/pair/:id/join`, `pair_cards` table, `/pair` + `/pair/{id}` surfaces, `composePairCard` composite.
- Date: 2026-11-09
- Extends: ADR 0025 (try-on invite + gift claim), ADR 0026 (couple styling loop), ADR 0028 (navigation consolidation)

## The idea

The couple card (ADR 0026) shows two people *in one photo* wearing a
look. The pair card is the two-person version of try-on itself: one
person photographs themselves + a garment (a catalog listing or a photo
of the clothing), gets a try-on render, sends an unguessable link; the
recipient tries the *same* garment on *their* photo — optionally a
different garment for the swap — and the two renders composite into one
shareable card. The card is the artifact; the reply is the loop.

Why it earns its place next to the couple card: the couple card needs a
photo of two people (a high bar — couples have few of those). The pair
card needs one selfie each, works for friends and siblings, and the
"swap the garment" option turns it into banter ("try mine instead")
rather than coordination. The recipient's render only exists because
they showed up — the artifact can't be made solo, which is the strongest
possible invite.

## The loop

```
your photo + garment → your try-on render → /pair/{id} link
  → they upload their photo (+ optional swap garment)
  → their render + composite pair card
  → card shared onward; items on it route to storefronts / try-on
```

Every hop reuses a shipped primitive: the try-on engine
(`engine.buildGeneratedOutfitImageResponse`), R2 artifact storage, the
recipient-surface pattern (`/pair/{id}`, unguessable id, no account),
`ShareArtifact` + `sid` funnel attribution, `ExitLinks` next-loop exits,
and the `artifact` `from=` vocabulary for deep links into the fitting
room.

## Decisions

- **Garment sources: both.** `listingId` resolves a live catalog listing
  server-side (deep links arrive as `?item=<id>&from=<curatorSlug>`);
  `garmentPhotoData` accepts a photo of the clothing itself, uploaded to
  R2 and used as the conditioning image. Upload wins nothing over a
  valid listing — the listing is tried first.
- **Renders are garment-conditioned (`tier: 'paid'`).** The free tier
  (`venice-sd35` / Neon image) ignores the person photo entirely — a
  pair card built on it would show two random AI models, which is not
  the product. `PAIR_RENDER_TIER` can flip to `'free'` if provider cost
  ever forces it. Each completed pair costs two renders.
- **POSTs are keyed + expensive-rate-limited.** Renders spend provider
  money, so `POST /api/pair` and `POST /api/pair/:id/join` sit behind
  `aiAuth` (VENICE_API_KEY) + the `aiExpensive`/`aiExpensiveDaily`
  tiers; web proxies inject the key via `proxyToHetzner`. `GET /:id`
  stays public — the page must render for whoever holds the link.
- **Photos are not stored.** Only renders and the card persist (R2);
  person/garment photos exist as request payloads and uploaded garment
  images only. Same privacy posture as the invite flow (ADR 0022 §5).
- **Swap is a first-class option.** The join accepts an alternate
  garment photo; `recipient_garment_url` records it and the card labels
  stay honest ("the shared piece" only when it was shared).
- **`pair` joins the reserved `from=` vocabulary** alongside
  `card|list|mag` (web `ARTIFACT_SOURCES` + API `RESERVED_SLUGS`), so a
  garment clicked through from a pair card never resolves as a curator
  slug.
- **Entry is by link/action, not nav.** Per ADR 0028 there is no new nav
  item: `/pair` is reached from the couple-card exits ("Or try the same
  fit on someone →") and any future artifact CTA; `/pair/{id}` is the
  recipient surface.

## API surface

```
POST /api/pair              { personPhotoData, listingId?|garmentPhotoData?, caption?, senderName?, replyTo? }
                            → { id, pageUrl, senderRenderUrl, garment }
GET  /api/pair/:id          → { id, status, caption, names, garment, senderRenderUrl, recipientRenderUrl?, cardUrl }
POST /api/pair/:id/join     { personPhotoData, recipientName?, listingId?|garmentPhotoData? }
                            → { id, status: 'complete', cardUrl, pageUrl }
```

## Known limits

- No public board (unlike `/cards`): pairs are intimate by design; the
  card resolves by link only. A reported-content path can be added if
  abuse appears.
- Render failures surface as 500s; there is no partial state where a
  pair is "half-rendered" — `status` flips to `complete` only after the
  composite upload succeeds.
- Join is not concurrency-guarded: two simultaneous joins can double-
  render; last write wins and both callers get a valid card URL.
