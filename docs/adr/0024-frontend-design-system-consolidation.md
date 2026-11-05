# ADR 0024: Frontend design system consolidation

**Status:** Accepted · 2026-11-05

## Context

The frontend had two competing design systems: the wardrobe studio's warm
paper/ink editorial tokens (CSS module, Georgia serif) and a shadcn-style
cool-gray HSL system everywhere else. An audit also surfaced fabricated
social proof (hardcoded 4.7★ ratings beside zero try-ons), ~680 arbitrary
sub-12px font sizes, dynamic Tailwind class interpolation defeating purge
(a ~300-class safelist was compensating), bounce-easing motion, emoji as
iconography, and a root layout that forced every page dynamic by awaiting
an auth session.

## Decision

- **One token system:** the wardrobe palette is canonical — warm paper/ink
  neutrals promoted to `globals.css`; the CSS module now aliases shared
  tokens. Semantic colors are HSL triplets throughout.
- **`--font-display` (Georgia serif) is the display voice** for brand
  headlines (`font-display` utility); Geist stays for UI.
- **`text-xs` is the type floor.** Arbitrary `text-[Npx]` below 12px is
  banned; the mobile legibility floor lifts `text-xs`→14px only.
- **No dynamic Tailwind classes.** Persona colors resolve through literal
  maps in `apps/web/lib/utils/persona-theme.ts`. No safelist; `lib/` and
  `packages/{shared-ui,ui}` are scanned content paths.
- **Honest metrics only.** No hardcoded ratings/counts; rating UI renders
  only when real data exists. Seed data carries no ratings.
- **Motion:** exponential ease-out; no elastic easing.
- **Icons:** Lucide only; emoji allowed in generated share captions only.
- **Root layout stays non-async.** Auth resolves client-side; re-adding
  `auth0.getSession()` re-forces dynamic rendering on public pages.

## Consequences

`tsgo` clean, 575/575 tests pass. `use client` conversion is an ongoing
tail (~195 files). Storefronts now truthfully show zero engagement — a
real ratings pipeline is product work, not design work.
