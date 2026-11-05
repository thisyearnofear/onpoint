# ADR 0025: Shared fitting room and Gift-a-look — specs on existing rails

- Status: **Implemented** (2026-11-05) — `POST /api/try-on/invite` → `/try/{token}`; `POST /api/curator/{slug}/order` + `gift` block → `claimUrl`; `GET|POST /api/gift/{token}`; web pages `/try/{token}`, `/gift/{token}`. Note: invites are stateless HMAC tokens (no table yet); invite prepay is unwired; `status: 'pending'` on gift orders rather than `pending_claim`.
- Date: 2026-11-05
- Context: The product treats try-on as a solo utility. The strongest observed
  ICP is *relational*: one person has the photo and the body (her), another has
  the taste and the wallet (him). Today's surfaces are all single-player; the
  connective layer — "dress me," "judge us," "get this for her" — doesn't exist.
  This spec adds it using rails that already exist.

## ICP driving both features

Person A (the model): sends selfies + screenshots of items she wants. Passion
domain: shoes, dresses. Has a phone, maybe no wallet, definitely no cUSD.
Person B (the stylist): curates items for her, wants a reason to keep engaging
— play, taste display, gifting.

Key property: A never pays and never installs anything. Every flow below
degrades gracefully to a link she opens in a browser.

---

## Feature 1: Shared fitting room ("try-on invite")

### MVP cut — async pass-the-parcel, not realtime

Realtime co-presence is out of scope. The runway duel link (`?ref=<roundId>`)
already proves the pattern: share a link, the other person acts, both see the
result. Same shape here.

### Flow

1. **Stylist picks** — on `/lab` or any listing/look, a new action:
   *"Try on a friend"*. Generates an invite:
   ```
   POST /api/try-on/invite
   { "listingId": "...", "note": "these would look great on you" }
   → { "inviteUrl": "https://onpoint.trustfall.xyz/try/{token}" }
   ```
   The stylist pays the try-on fee upfront ($0.03/$0.05) — the recipient
   never sees a paywall. Existing x402/quote machinery handles this
   unchanged; it's just a prepaid try-on with a token.
2. **Model opens the link** — `/try/{token}` shows: the item, who sent it,
   the note, one button: *"Take a photo"*. Mobile-first, camera capture
   (`accept="image/*" capture`), zero auth.
3. **Render** — server runs the existing try-on pipeline (photo + listing
   image → render → polaroid artifact).
4. **Both see the result** — the polaroid page (`/p/{id}` already exists)
   gains attribution: *"Styled by {name}"*. The stylist gets notified —
   `NotificationBell` infra exists; worst case, a `webhookUrl`/`sharedTo`
   field on the invite record and a link the stylist re-opens.
5. **Follow-through** — result page carries the existing CTAs: *"Get the
   look"* (order), *"Challenge the judges"* (runway with this outfit —
   runway already accepts a photo), *"Style another for them"* (reverse
   roles, the loop continues).

### API surface (new, thin)

```
POST   /api/try-on/invite          → { token, inviteUrl }   (paid)
GET    /api/try-on/invite/{token}  → { listing, senderName, note, status }
POST   /api/try-on/invite/{token}  { photoData } → { polaroidUrl, renderId }
GET    /api/try/{token}            → SSR invite page (public, no auth)
```

### Data model

`try_on_invites`: `token (pk)`, `listing_id`, `sender` (agent address or
Auth0 sub), `sender_display_name`, `note`, `status (open|rendered|expired)`,
`render_id`, `created_at`, `rendered_at`. Single-use, 7-day expiry.

### Why this cut

- Zero realtime infra, zero accounts for the model, reuses the paid try-on
  pipeline end-to-end.
- The invite link *is* the viral artifact — same mechanic as runway duel
  links and share cards, which already work.
- Follow-ups (not v1): multi-item invites, "dress each other" duel mode,
  recipient-claimed renders as wishlist entries.

---

## Feature 2: Gift a look

### The gap

Checkout today pays and *assumes* buyer = recipient: cUSD tx + quote →
order → receipt. Gifting needs two changes: (a) a gift flag + note on the
order, (b) deferred shipping capture — the buyer can't know her address,
and asking for it ruins the gesture.

### Flow

1. **Gift CTA** — on `/look/:slug` ("Gift this look") and on any listing
   ("Send as a gift"). Buyer picks the hero listing or full look items.
2. **Pay** — existing order endpoint gains optional fields:
   ```
   POST /api/curator/{slug}/order
   { "listingId": "...", "size": "?", "gift": {
       "note": "for your birthday",
       "recipientName": "Nia"          // optional, shown on claim page
   }}
   ```
   Payment rails unchanged (cUSD quoteId+txHash; **PayPal rail is the
   natural fit** — the buyer needs no crypto and the recipient never pays).
   Size selection: offer "ask her" — a per-size claim field (see below).
3. **Claim link instead of shipping address** — order is created with
   `fulfillment: "pending_claim"`. Buyer receives:
   `https://onpoint.trustfall.xyz/gift/{claimToken}` — a page that looks
   like a wrapped gift card (polaroid visual language, not a checkout
   receipt): item image, "from {name}", the note, and a form:
   shipping address + size confirm (if "ask her" was chosen).
4. **Recipient claims** — no account needed; `POST /api/gift/{claimToken}`
   writes `{address, size}` onto the order → `fulfillment: "ready"`,
   curator sees it in the existing curator dashboard orders view.
5. **Attribution** — gift orders flow through the same earnings ledger;
   if sent via a look, the look's `tryOnCount`/`share` events already track
   it. Buyer-facing receipt at `/receipt/{id}` shows "gift claimed" status.

### API surface

```
order payload   + gift: { note?, recipientName?, askSize? }
order row       + fulfillment: "pending_claim" | "ready", claim_token,
                  gift_note, recipient_name
POST   /api/gift/{claimToken}   { address, size? } → confirm
GET    /gift/{claimToken}       → SSR gift card page (public, no auth)
```

Single-use claim token, resendable by the buyer, editable until claimed.

### Edge cases (decided, not deferred)

- **Wrong address / never claims**: claim page shows expiry (14 days);
  unclaimed → buyer can reclaim the order to their own address or refund
  per curator policy. V1: expiry warning in the buyer receipt, manual ops.
- **Price hidden**: claim page never shows price. Receipt stays with buyer.
- **Multi-item looks**: v1 gifts the hero listing only; bundle-gifting is v2.
- **Abuse**: claim tokens are unguessable (128-bit), single-use, rate-limited;
  no public enumeration. No payment data touches the claim page.

---

## What this buys (and what it doesn't)

**Shared room** turns try-on from utility into message: "I styled this for
you" is a reason to send a link, and every render carries the stylist's
name — the relationship compounds inside the product instead of in SMS.

**Gift a look** closes the loop that try-on opens: she tries it on, he buys
it, she claims it. Every rail it touches already exists — payment, order,
receipt, share page — the only genuinely new primitives are the invite
token and the claim token.

**Explicitly not in v1**: realtime co-browsing, recipient accounts, shared
wishlists, multi-item bundles, shipping tracking. Each is a follow-on that
the token model already accommodates.

## Effort shape

- Try-on invite: 1 API route + 1 public page + invite table. Small.
- Gift claim: order schema fields + claim page + curator dashboard flag
  (`pending_claim` badge). Small-medium; no payment changes.
- Both share the link-card visual system (polaroid/collage) already built.
