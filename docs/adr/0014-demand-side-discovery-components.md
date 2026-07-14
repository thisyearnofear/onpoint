# ADR 0014 — Demand-Side Discovery Components: Retain and Rewire

- **Status:** Accepted
- **Date:** 2026-07-14
- **Deciders:** OnPoint core
- **Related:** [ADR 0002](./0002-curator-primitive.md) (Curator primitive), [STRATEGY.md](../STRATEGY.md) (Phase 2 metrics), [PHASE1_AUDIT.md](../PHASE1_AUDIT.md)

## Context

OnPoint serves three stakeholders: **curators** (supply), **human shoppers / retail** (demand), and **agents** (demand). The supply side and agent demand side are well-served: curator storefronts, onboarding, chat-ops, agent API, x402 try-on, and on-chain checkout.

The **human demand side** has a gap. The current flow is purely transactional: visit storefront, try on, buy via WhatsApp, leave. There is no aggregate discovery surface, no engagement loop, and no social proof that drives cross-curator visits. The strategy's own metrics expose this:

- "Curator: share to visit > 20%" — shared polaroids drive traffic, but visitors land on a single storefront with no discovery surface.
- "Mobile bounce on storefronts < 40%" (Phase 2) — storefronts are transactional with no engagement content to retain users.

Two sets of components currently exist in the codebase that implement engagement and discovery UI patterns:

1. **`LooksFaceoff.tsx`** — "Who Wore It Better?" head-to-head visual comparison voting.
2. **`CommunityPanel/`** (14 files) — leaderboards, look-of-the-week, trending topics, community cards, reactions.

These were built against a `CommunityLook` data model tied to Farcaster/community API routes. The strategy killed the `/social` and `/collage` routes, but the **components themselves** are legitimate retail engagement patterns that could serve the human demand side if rewired against the Curator schema.

## Decision

**Retain** `LooksFaceoff.tsx` and `CommunityPanel/` (all 14 files) in the codebase. **Unwire** them from the Lab UI (`TacticalDashboard.tsx`) by removing the `"community"` and `"design"` modes. Document this as a deliberate quarantine, not abandonment.

In **Phase 2 (Execution Reliability)**, rewire these components against the Curator/polaroid schema:

| Component | Current data | Rewired data | Rewired purpose |
|-----------|-------------|-------------|-----------------|
| `Leaderboard.tsx` | `CommunityLook` sorted by likes | `Curator` sorted by try-ons/shares | "Top Curators This Week" on `/curators` |
| `LookOfTheWeekCard.tsx` | `CommunityLook` with crown/trophy | Polaroid from try-on session, links to `/s/[slug]` | "Featured Polaroid" on directory/homepage |
| `TrendingTopics.tsx` | `look.topics` frequency | `curator.verticals` from directory API | "Trending Verticals" on `/curators` |
| `CommunityCard.tsx` | `CommunityLook` card | Polaroid + curator slug + storefront link | Cross-curator polaroid card |
| `LooksFaceoff.tsx` | Two `CommunityLook` items, vote | Two polaroids from different curators, vote | "Polaroid Faceoff" discovery widget on `/curators` |

The `CommunityLook` type (defined locally in `CommunityPanel/types.ts`) will be replaced with a `StorefrontPolaroid` type that carries `curatorSlug`, `curatorName`, `polaroidUrl`, `score`, `persona`, `headline`, `takeaways`, `topics` (= curator verticals), and engagement metrics.

## What was deleted (not retained)

The following were deleted as truly dead code with no future use case aligning with the strategy:

| File | Reason |
|------|--------|
| `components/DesignStudio.tsx` | UI surface killed (collage/design studio, low engagement). The `useDesignStudio` hook and `generateDesign` method in all AI providers are **retained** — they could power future digital curator garment generation (ADR 0011). |
| `components/Dashboard/DesignPanel.tsx` | Wrapper for deleted DesignStudio. |
| `components/SocialFeed.tsx` | Farcaster-coupled feed. `SocialActivity` type **retained** in `shared-types/src/memory.ts` for future social proof on storefronts. |
| `lib/hooks/useMemoryAPI.ts` | Only consumer was SocialFeed. |
| `app/api/social/feed/route.ts` | Only consumer was SocialFeed. |
| `app/api/social/activity/route.ts` | Only consumer was useMemoryAPI. Mock implementation. |

## What is retained (quarantined)

| File | Status | Phase 2 rewiring plan |
|------|--------|----------------------|
| `components/LooksFaceoff.tsx` | Unwired from Lab UI | Rewire to polaroid pairs from different curators |
| `components/Dashboard/CommunityPanel/` (all 14 files) | Unwired from Lab UI | Rewire sub-components against Curator/polaroid schema |
| `app/api/community/looks/route.ts` | Unwired | Rewire to serve polaroid/storefront data |
| `app/api/community/looks/faceoff/route.ts` | Unwired | Rewire to serve polaroid pairs from different curators |

## What is retained (still in use)

| File | Why |
|------|-----|
| `components/FarcasterUser.tsx` | Used by `SettingsPanel.tsx` (connected accounts) |
| `app/api/social/user/[fid]/route.ts` | Used by FarcasterUser |
| `app/api/social/cast/route.ts` | Used by `lib/utils/social.ts` (Farcaster sharing from try-on) |
| `app/api/social/upload/route.ts` | Used by `lib/utils/social.ts` (image upload for casts) |
| `lib/utils/social.ts` | Used by VirtualTryOn components (SessionEndingCard, TryOnResult, etc.) |
| `SocialActivity` type in `shared-types` | Canonical type for social proof events |

## Principles Applied

1. **"Enhancement first; delete don't deprecate"** — We retain and will enhance these components rather than deleting and rebuilding.
2. **"Agent layer becomes infrastructure, not the hero"** (ADR 0002) — Components are unwired from the Lab UI but kept for demand-side composition.
3. **"No metric → no build"** — We do not wire them into user-facing surfaces until Phase 2 metrics (mobile bounce < 40%, share-to-visit > 20%) justify the work.
4. **"Every line is a liability"** — Balanced against enhancement-first; these lines have a documented future purpose, so they are an investment, not waste.
5. **Three-stakeholder model** — The human demand / retail side is one of three co-equal stakeholders. These components serve that side's discovery and engagement needs.

## Consequences

- `TacticalDashboard.tsx` loses `design` and `community` modes (7 modes remain: dashboard, my-looks, try-on, stylist, shop, intel, settings).
- `CommunityPanel/types.ts` `CommunityLook` type will need to be replaced with `StorefrontPolaroid` in Phase 2.
- Community API routes (`/api/community/looks/*`) remain in the codebase but are not called by any active UI.
- Phase 2 workstream must include a "demand-side discovery" task to rewire these components.
