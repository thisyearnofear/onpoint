# ADR 0018: x402-First Monetization — Subscription Surfaces Deferred

**Status**: Accepted
**Date**: 2026-08-02
**Related**: ADR 0013 (pricing strategy), ADR 0009 (G$ / Superfluid streaming), ADR 0012 (x402 facilitator), ADR 0016 (OKX facade), ADR 0017 (Prava comments on recurring mandates)

## Context

Until 2026-08-02 the app shipped a **half-alive subscription model**. A
page at `/account/subscription` offered monthly tiers ($9.99 Basic, and
higher) reachable in two clicks from the Lab's Settings tab, backed by
`apps/web/lib/services/subscription-service.ts` (Stripe + Superfluid),
`app/api/stripe/{checkout,portal,webhook}`, email templates, and agent-auth
permission wiring. At the same time, `/pricing` declared "Pay per try-on.
No subscription.", and every real money flow ran **x402 pay-per-use**
(cUSD/USDC on Celo, USD₮0 on XLayer, per ADRs 0012/0013/0016).

Two publicly contradicting pricing models is an honesty bug, not a
product decision. Pre-launch review (2026-08-02) resolved the
contradiction in favor of x402, deleted the subscription page and
redirected `/account/subscription` → `/pricing` (permanent, in
`apps/web/next.config.js`).

This ADR records **why x402 wins at launch**, **under which conditions a
subscription should come back**, and **how to resurrect the preserved
infrastructure** so it is not rebuilt from scratch.

## Decision

1. **All-in on x402 / pay-per-use for shoppers and agents.** No
   subscription UI, no plan selection, no entitlement flows at launch.
2. **Keep the backend scaffolding in place but hands-off.** The Stripe
   routes, subscription service, and Superfluid path stay in the repo,
   unreferenced from the UI, documented as deferred (see "Preservation").
3. **Subscriptions, if ever, are curator-side only.** Shopper/agent
   subscription tiers are permanently out of scope.
4. **Review trigger**, not a timer: the funnel decision dated 2026-08-15
   (`GET /api/status/funnel`) plus concrete curator-usage signals — see
   "When to revisit".

## Rationale

**The platform's three customer types map badly onto recurring billing:**

| Customer type | Nature | Fit with subscription |
|---------------|--------|----------------------|
| Agents | Transactional; a job per call, no ongoing relationship with a billing system | None. x402 couples payment to invocation in one flow; attribution travels with the quote. Entitlement state ("subscribed vs called") would require machine clients to hold accounts they never signed into. |
| Kenyan shoppers | Buy physical goods via WhatsApp/M-Pesa | None. Recurring card charges don't map to how they pay or shop. |
| Curators | Return weekly; use storefronts, analytics, distribution tools | **The only natural seat.** Business value accrues continuously — analytics, listing capacity, placement. |

**Cost asymmetry.** A subscription model requires plan state, entitlement
checks at each feature boundary, dunning, failed-charge handling, refunds,
and consistency between Stripe, wallets, and agent identity. x402 requires
none of that: revenue arrives with the value, atomically. Pre-launch,
every hour of billing-ops surface is an hour not spent on try-on quality
and supply.

**Single pricing story.** The app already expresses two tiers *per
transaction* (free SD35 preview vs $0.03–$0.05 paid IDM-VTON). Adding a
third pricing dimension at launch would double the explanation burden on
`/pricing` and invite exactly the contradiction this ADR resolves.

**Empirical gate.** `/api/status/funnel` + the 2026-08-15 review deadline
(see AGENTS.md "Pricing") decide the free-tier question from conversion
data. Debating subscriptions before that data exists is pricing by
preference, not evidence.

## Preservation — how to bring subscriptions back

**Deleted (recoverable from git):**

- `apps/web/app/account/subscription/page.tsx` (Stripe-tier UI)
- The "Subscription" block in `apps/web/components/Dashboard/SettingsPanel.tsx`

Recover the last-good UI without un-deleting HEAD:

```bash
# The file was deleted in the pre-launch cleanup (commit after 1e46a71).
git log --diff-filter=D -- apps/web/app/account/subscription/page.tsx
# View the last version:
git show 1e46a71:apps/web/app/account/subscription/page.tsx
```

**Kept and inert (reachable only via the redirect or API calls):**

- `app/api/stripe/{checkout,portal,webhook}/route.ts` — returns live responses if called
- `lib/services/subscription-service.ts` — tiers `free|basic|pro|concierge`, Stripe **and Superfluid** payment methods, agent-auth permission wiring (`setUserSubscription`)
- `lib/services/email/index.ts` — subscription email template with `/account/subscription` action URL (now redirecting to `/pricing`)
- Notification `actionUrl`s referencing `/account/subscription` (8 call sites) — harmless while the redirect exists
- `middleware/agent-auth.ts` — subscription tier → permission mapping

**Stale links still flow through the redirect**, so nothing user-visible
breaks while this code is dormant.

## When to revisit, and how the architecture should look if we do

**Revisit when ALL hold.**

1. The 2026-08-15 funnel review shows paid try-on conversion is healthy.
2. ≥10–20 active curators with repeat logins and regular `/s/[slug]/intel`
   analytics usage.
3. A concrete feature happens to need gating (listing cap, deeper
   analytics, AI collage boosts, placement).

**Recommended architecture then (different from the deleted one):**

- **Prefer the on-chain rail over Stripe.** Curators already hold wallets
  and receive on-chain payouts. A Superfluid stream (the path already
  built into `subscription-service.ts`, D6 in ADR 0009) avoids card
  processing entirely for this audience and keeps money on the same rails
  as payouts. Stripe stays a fallback only if curators demand fiat.
- **One source of truth for plan state.** Whether from Stripe webhooks or
  a Superfluid watcher, write exactly once to the curator record
  (`subscriptionTier` + `subscriptionValidUntil`). Never let plan state
  branch across Redis, Stripe lookups, and on-chain reads at check time.
- **Entitlement enforcement is server-side at the feature endpoint**, not
  client-side and not scattered: listing-count limits where listings are
  created, /intel depth at the intel endpoint, collage tier at the collage
  worker. One helper (`requireCuratorTier(slug, 'pro')`) everywhere.
- **Keep subscriptions out of the x402 quote path.** 402 responses must
  stay flat-fee and stateless; a tier may *discount* a price in
  `tryOnPriceCusd` but must never gate the challenge itself — agents as
  payers remain subscription-free by design.
- **Prava mandates are a different rail, not a conflict.** "Manage a
  subscription" via Prava recurring mandates (ADR 0017) is your agent
  paying *third-party merchants* with a user-scoped card credential —
  agent-side recurring payment, no platform plan state. It does not
  resurrect platform-side subscription billing and keeps this ADR intact.
- **The resurrected UI should not come back as-is.** The deleted page
  was shopper-facing tiers from the Lab. A curator-side "OnPoint Pro"
  belongs inside the curator surfaces (`/curator`, storefront owner
  panel), priced in cUSD, with the Stripe path dormant.

## Consequences

- Launch ships one pricing story (x402 tiers), consistent with `/pricing`,
  `/about`, and honesty-first positioning.
- Stripe webhook route stays deployed but will receive no traffic; its
  secrets remain optional deploy config.
- If the funnel review pans out and curator usage justifies a Pro tier,
  the recovery path above puts a working subscription in *days*, not weeks
  — but redesigned for curators and on payment rails they already trust.
