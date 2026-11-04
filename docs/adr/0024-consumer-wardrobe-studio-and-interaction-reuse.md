# ADR 0024 — Consumer Wardrobe Studio Homepage and Interaction Reuse

- **Status:** Accepted
- **Date:** 2026-11-04
- **Deciders:** OnPoint core
- **Related:** [ADR 0015](./0015-wardrobe-supply-prep-reference.md) (Wardrobe supply-prep reference), [ADR 0023](./0023-consumer-engine-first-curators-deferred.md) (consumer engine first), [FEATURES.md § Wardrobe studio](../FEATURES.md#wardrobe-studio-consumer-homepage)

## Context

The Phase 0 consumer engine needs a homepage users return to. The prior homepage was a marketing hero (slogan, decorative demo card, a fake static "example verdict") feeding sections below the fold. User feedback was explicit: the wanted experience is the real wardrobe dashboards of [tandpfun/wardrobe](https://github.com/tandpfun/wardrobe) and [Om-Alve/wardrobe](https://github.com/Om-Alve/wardrobe) — a gallery + inspector workspace — not generic marketing cards with a few borrowed interactions.

ADR 0015 scoped those Wardrobe repos to a **supply-side** reference (operator garment-extraction POC) and explicitly excluded a consumer-UI reuse path. This ADR supersedes only that exclusion; all other ADR 0015 constraints stand (no dependency/vendoring, no stack adoption, no changes to the Replicate/Qwen/R2 image pipeline, Phase 2/3 supply-prep design unchanged).

## Decision

Make the homepage (`/`, `#style-studio`) a wardrobe-first styling workspace built on adapted interaction patterns from the MIT-licensed Wardrobe dashboards: gallery grid + category tabs + item inspector, plus a CSS clothes rack inspired by [DiMaac's clothes rack](https://ui.dimaac.com/components/clothes-rack) (photo-based swivel, not their WebGL renderer).

Concretely:

- `apps/web/components/wardrobe/WardrobeWorkspace.tsx` + scoped CSS module replace the old hero opening; below-fold homepage content, Runway, and fitting-room routes are unchanged.
- Data is local and honest: 3 prepared garment/model pairs + the 34 existing style-board outfit references. `studio-graphic-0{1,2,3}` sample ids resolve through `sampleById` so "Get a verdict" judges the actual displayed model; outfit references keep their existing ids and flat-lays with a "not items for sale" disclosure.
- Favorites and private notes (≤240 chars, per item) persist on-device in `localStorage` key `onpoint-wardrobe-studio-v1` (version-checked, malformed data ignored). This does **not** create a server-persisted wardrobe and does not replace `/looks` or inventory state; saved outfits share the `/style-board` "My picks" store (amended 2026-11-04: one on-device set of picks; legacy outfit ids in the studio key migrate on first load), while studio-only garments and notes stay under the studio key.
- The DiMaac rack is independently implemented in our CSS with our photos — no component code or demo images copied, no Three.js/dependency added. Its license permits product use but is not MIT and prohibits library redistribution, so it is credited in the studio footer rather than via the MIT license file.
- The upstream repos' MIT license is kept at `apps/web/components/wardrobe/wardrobe.LICENSE` with both source links in the studio footer. The MIT code license does not license their sample imagery — which is also absent from their repos — so no upstream images are imported or claimed.

## Consequences

- The homepage is the studio itself; first paint shows rack + on-model demo together, tabs → gallery, gallery tile → stage (scroll-into-view on compact viewports), sticky tab bar on mobile, sticky self-scrolling inspector on desktop.
- Selection, undo, pin/compare, and save/notes are local and instant; judging still happens in Runway and personal try-on still happens in the fitting room — the studio navigates, it does not generate.
- The existing snap-on demo benchmark ("Dress model in Graphic 0x" affordances, `aria-pressed` garment selection) is preserved inside the rack.
- Style-board imagery remains the existing curated local references; no new asset import and no ownership claims.
- Not in scope and not claimed: menswear/asset parity, personal-photo garment extraction, free-form AI restyling, the upstream trips/planner feature, and multi-slot real-garment compositing.
