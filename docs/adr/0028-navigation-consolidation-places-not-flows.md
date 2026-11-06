# ADR 0028: Navigation consolidation — places, not flows

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** OnPoint core
- **Supersedes:** [ADR 0022](./0022-runway-game-hosted-messaging.md) §4a's navigation clause, [ADR 0023](./0023-consumer-engine-first-curators-deferred.md) §3's navigation clause, and the Shop nav door added in `cab0391`
- **Related:** [ADR 0024](./0024-consumer-wardrobe-studio-and-interaction-reuse.md), [ADR 0025](./0025-shared-fitting-room-and-gift-a-look.md), [ADR 0026](./0026-couple-styling-loop.md), [ADR 0027](./0027-frontend-design-system-consolidation.md), [`apps/web/AGENTS.md`](../../apps/web/AGENTS.md)

## Context

`apps/web/AGENTS.md` states the rule: nav is for **places, not flows**, and secondary
nav may hold "destinations you visit, never verbs you do." The code did not honor it.
Seven layers competed for the same choices — header primary (4), a header "More"
popover, a standalone header "Play" pill whose href contradicted the Runway item's, a
second Play pill in the mobile row, a hamburger sheet, a lab tab strip, a lab mobile
bottom nav, and a lab "More" sheet — plus two hand-rolled footers. `cab0391` had given
purchase a nav door, and the rule then had no way to justify it.

Two audits set the direction.

**`/shop` was mock inventory, and the real purchase door was already elsewhere.**
`app/shop/page.tsx:255` renders `CANVAS_ITEMS` — 32 placeholder photos with hardcoded
prices — and `app/api/agent/checkout/route.ts:59` lists `seller: PLATFORM_WALLET`,
commented "All products sold by OnPoint for now." Meanwhile every Get-it link that
pointed at real supply already targeted `/s/{curatorSlug}?item={listingId}`:
`/c/[id]`, `/w/[id]`, `/m/[id]/Flipbook.tsx`, `/look/[slug]/LookItemGrid/ItemCard.tsx`,
and `apps/api/lib/runway/fix.js`. So removing Shop from nav deleted the app's most
visible honest-metrics liability ([`apps/web/AGENTS.md`](../../apps/web/AGENTS.md) §
"Honest metrics") at zero commercial cost: no real listing lost a door, because no
real listing was ever behind it.

**The cart, not Shop, was the actual risk.** `CartButton` was exported and imported by
nothing, and `CartDrawer` mounted only inside `/shop` and the live stylist view.
Unnav'ing `/shop` without a header cart slot would have made a non-empty cart
literally unopenable.

The bar this ADR has to clear is the one `ef629a8` set when it reverted magazine from
nav: **every remaining nav layer must offer a choice no other layer offers.** Under a
seven-layer stack, nothing did.

## Decision

1. **Three places, one array.** `lib/navigation.ts`'s `PRIMARY_NAV` is Wardrobe (`/`),
   Runway (`/runway`), Fitting room (`/lab/try-on`) — and is the only source of truth
   for both the header and the hamburger, which is what stops the two drifting apart
   again. The "More" popover, both header Play pills, the secondary nav row and the
   lab's tab strip / bottom nav / More sheet are deleted. HeroView's mobile sticky pill
   stays: it is in-page, IntersectionObserver-gated to the hero CTA, and it is the
   tracked `placement: "mobile_sticky"` measurement point.

2. **One footer, and it is the only home for non-consumer destinations.**
   `FOOTER_LINKS` (Supply, Developers, Pricing, Guides, About, Privacy, Terms) rendered
   by the single `OnPointFooter`; the hand-rolled footer rows are deleted. A page that
   wants no footer says so explicitly rather than rebuilding one.

3. **Purchase is an action on an artifact, never a place.** The canonical door is
   `/s/{curatorSlug}?item={listingId}`, resolved by `lib/utils/get-it.ts` from the
   artifact's own `kind`. `/shop` remains as the house catalog and is entered only by an
   action (a verdict's "Try it on", the lab's `?tab=shop` forward), the way `/couple`,
   `/magazine` and `/cards` are entered by link. A surface that cannot resolve a listing
   offers `/curators` — "ask a curator who stocks it" — never a disabled CTA, never a
   bare Shop link. That fallback is the rule that makes "no Shop in nav" honest: the
   door is never closed, only never fake.

4. **The cart got a real door.** `CartMount` (drawer + checkout modal) is mounted once
   by `OnPointLayout`; `CartSlot` renders in the header desktop and mobile clusters and
   returns `null` when the cart is empty. Both children render nothing until opened, so
   the static shell of every page stays unfeatured. Cart persistence already worked
   (`cart-store.ts` localStorage) — this was reachability, not storage.

5. **The lab flattened to one surface.** `TacticalDashboard` now renders the fitting
   room plus three disclosures — `#your-try-ons`, `#ask-stylist`, `#settings` — because
   with Shop gone, `Try On` duplicated the header's Fitting room, `Saved` duplicated the
   result's own Save, `Stylist` was a way to choose, and `Settings` was not a consumer
   destination. Retired `/lab/{mode}` URLs answer a 308 onto the disclosure they used to
   open — from the config table, per clause 7.
   Agent-security surfaces (`FraudMonitor`, the agent-security disclosure) moved to the
   `ADMIN_EMAILS`-gated `/admin`, per the budget rule's own instruction: when a surface
   doesn't fit the consumer ICP, move it or cut it.

6. **`/looks` folded into the wardrobe's outfits tab,** with a query-preserving `308`,
   after the tab was made to show **real** looks (`e5d948c`) — not the studio's prepared
   outfit references, which `FEATURES.md` had been describing as "the full look catalog"
   while the catalog lived on another route.

   **`?pick=` is a cross-service contract, recorded here.** `apps/api/lib/runway/fix.js`
   mints the highest-volume inbound share path as
   `/?tab=outfits&pick=${outfit.id}&sid=${shareId}&utm_source=${channel}`. The API
   generates a URL into the web app's query grammar. Changing this route's params is an
   API-breaking change, and the fold is safe only because the redirect preserves every
   param and the outfits tab still resolves `pick`.

7. **Retired URLs get a permanent redirect, by the mechanism that actually produces
   one.** Two of Next's rendering modes swallow `permanentRedirect()` and answer 200: a
   synchronous page runs during static generation, where the throw becomes a prerendered
   error shell; and a page under a client layout — anything in `app/(consumer)` — has its
   shell flushed before the page runs, so the 308 can only arrive afterwards as a
   `<meta http-equiv="refresh">`. Both were caught by asking the running server rather
   than the test suite. So a destination that needs no query lives in `next.config.js`'s
   `redirects()`, which the router matches before rendering — that owns `/style-guide`,
   `/style`, `/collage`, `/social` and the retired `/lab/{mode}` slugs — and a destination
   that must forward the query keeps a page which awaits `searchParams` and sits *outside*
   the consumer layout: `/looks` and `/style-board`. A route nobody could link to gets
   deleted instead (Stage 1's dead components, `LabModeClient`, `DashboardTooltips`,
   `app/looks/{api,utils,constants,components}`). Against a production build every one of
   them answers 308 with params and fragment intact; only an unknown `/lab/{mode}` — a
   typo, not a link — still lands through the page's client-side fallback.

## What this does not claim

No conversion, K-factor or retention figure is asserted. `docs/ops/retention.md` defines
Runway funnel steps by `metadata.surface`, not by header position, and names no pill or
"More" step, so no measured series is cut mid-flight — but that is an absence of
interference, not evidence of improvement. Before/after engagement for the flattened lab
is unmeasured. The `/shop` change removes a false commercial claim; it does not add a
real one, because supply is still thin ([ADR 0023](./0023-consumer-engine-first-curators-deferred.md)).

## Consequences

- **The rule and the code now agree.** `apps/web/AGENTS.md` is amended: primary is 3, not
  4; there is no secondary nav; the footer owns non-consumer destinations; purchase is
  recorded as an artifact action; `?from=` is stated to be a curator slug; and public
  pages stay prerendered with live inventory fetched client-side.
- **Machine discovery moved out of nav.** `/developers` was the only web link to
  `/agent`, the referral-earnings UI that `AGENTS.md` advertises. `/.well-known/agent.json`
  now carries a `web` block naming both. Agents do not scroll footers; a capability's
  discoverability must not depend on where the marketing site puts a button.
- **Honest-metrics surfaces deleted, not relabeled.** `/style-guide` — 337 lines of mock
  items carrying `averageRating: 4.7` and `tryOnCount: 1250` — is gone from the tree, and
  from the sitemap in the same commit.
- **Deep links became load-bearing.** `?tab=settings` and `#settings` must both open the
  same disclosure, and `?item=` must survive the `?tab=` cleanup — the fitting room
  resolves its garment and its similar-items fetch off the URL after render. The `from=`
  bug fixed here was sending `card`/`list`/`mag` downstream as a fabricated curator slug
  into try-on and agent calls, not merely printing a wrong caption;
  `lib/utils/deep-link-source.ts` is now the single resolver and
  `apps/api/lib/slugs.js` reserves those three words so no storefront can take the name.
- **Drift is now test-locked, not review-locked.** `navigation.test.tsx` asserts three
  items *and* that `/shop`, `/looks`, `/developers` and `/curator` are absent, so "give
  purchase a nav door" fails loudly instead of looking like progress. New tests cover the
  Get-it kind→href table, the `/looks` param matrix, the `/lab/{mode}` redirect table in
  `next.config.js`, the cart door, and the retired-route invariants.
- **Remaining gaps are named, not hidden.** `/cards` had no inbound link at all before
  this; it now has exactly one per artifact footer, and no test can reach it through nav
  because that is the point. `/couple`, `/magazine`, `/gift`, `/try` and
  `ShareArtifact` remain untested. Cart reachability on a real phone is a manual check,
  not a suite result.

## Revert

Each stage is its own commit and reverts alone: `e5d948c` (real looks in the outfits
tab, the prerequisite), `d88f4b5` (dead code + two link bugs), `74d5b94` (one footer),
`c336765` (nav 4→3, cart door), `dca8aef` (purchase as artifact action), `3049526` (lab
flatten), `73f078f` (`/looks` fold), `9618e9a` (retired routes + `/cards` door),
`4cb2357` (the written rule) — plus the commit after it, which moved the retired
`/lab/{mode}` slugs and `/style-board` into `next.config.js` once the running server
showed the page-level form answering 200.
Reverting `c336765` alone restores Shop's nav item without restoring the mock-inventory
claim, because the item and the claim lived in different files.
