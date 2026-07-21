# ADR 0015 — Wardrobe Import-Flow Primitives as Reference for Clothing-Extraction POC

- **Status:** Accepted (reference design)
- **Date:** 2026-07-21
- **Deciders:** OnPoint core
- **Related:** [SCOPE-WOW-FEATURES.md](../SCOPE-WOW-FEATURES.md) (Feature 2, Phase 2/3), [ADR 0002](./0002-curator-primitive.md) (Curator primitive), [ADR 0011](./0011-erc8004-registration-and-digital-curators.md) (Digital curators)

## Context

[SCOPE-WOW-FEATURES.md](../SCOPE-WOW-FEATURES.md) Feature 2 specifies a clothing-extraction operator POC (Phase 2) that graduates into a productized curator-onboarding feature (Phase 3). The POC is currently "not started" with two blockers: a representative curator photo batch and an approved image-generation/editing path.

[`tandpfun/wardrobe`](https://github.com/tandpfun/wardrobe) (MIT, 1.2k stars) is a standalone Vite + React app that extracts garments from photos into a local `data/library.json` catalog. It is **not** being integrated as a dependency or vendored copy. Its `src/import-flow.jsx` implements a staged review/approve/regenerate workflow that is the closest existing reference design for OnPoint's planned POC.

This ADR records which Wardrobe primitives are worth borrowing as reference, which are not, and why — so the Phase 2 POC has a concrete design target instead of "POC not started."

## Non-goals

- **Not** integrating Wardrobe as a dependency, submodule, or vendored copy.
- **Not** adopting Wardrobe's stack (Vite, Phosphor icons, localStorage, OpenAI Responses API, `gpt-image`).
- **Not** changing OnPoint's existing image pipeline (Replicate IDM-VTON for try-on, Qwen `wan2.7-image-pro` for collages, R2 for storage).
- **Not** a `/looks`-page reference. Wardrobe's gallery/editor primitives map to OnPoint's existing `/looks` surface only superficially; the real overlap is supply-prep. (See "What does NOT map" below.)

## Decision

Use Wardrobe's `import-flow.jsx` as the **reference interaction design** for the SCOPE-WOW Phase 2 operator POC and Phase 3 productized extraction. Borrow the staged-review state machine and the cleanup-tolerance slider as interaction patterns. Reimplement in OnPoint's stack (Next.js, lucide-react, Tailwind design tokens, R2 storage, Replicate/Qwen image pipeline).

### Primitive map

| Wardrobe primitive | OnPoint Phase 2/3 analog | Borrow? | Notes |
|--------------------|--------------------------|---------|-------|
| `ReviewEditor` (crop → garment → modeled stages, approve/reject/regenerate) | Operator review UI for extracted cutouts | **Yes — interaction pattern** | Three-stage gate (detect → extract → optional modeled preview) maps directly. Reimplement in Next.js + Tailwind. |
| `CleanupEditor` (tolerance slider, before/after comparison, contaminated-pixel count) | Background cleanup for cutouts that fail auto-matte | **Yes — interaction pattern** | The tolerance slider + diagnostic pixel count is a clean operator affordance. OnPoint's image pipeline differs but the UX transfers. |
| `deriveStatus(job)` state machine (`processing` / `review` / `approved` / `rejected` / `failed`) | Job status model for async extraction | **Yes — state model** | The status-derivation function is a tidy reference for deriving UI tone/text from a multi-stage job object. |
| `extractPalette` (canvas quantization, 72×72 sample, bucket + color-distance dedup) | Color metadata for extracted cutouts | **Maybe — defer** | Only useful if OnPoint persists color server-side. Currently `LookItem` has no color field. Defer until color becomes a filter axis. |
| `sampleImageColor` (click-to-pick from image) | Color picker affordance | **Maybe — defer** | Same dependency as `extractPalette`. |
| `TYPES` garment-part taxonomy (`upperbody` / `lowerbody` / `wholebody_up` / `accessories_up` / `shoes`) | Item `part` field for swap-similarity constraint | **No — different axis** | OnPoint look metadata is style-based (`category`/`occasion`/`season`). A part-type field would improve `/api/items/similar` swap results but is a backend schema change, not a UI borrow. Track separately. |
| `TagEditor` (chip-based, Enter/comma commit, dedup, `#` strip) | Look tag editing | **Yes — already borrowed** | Lifted into `apps/web/components/ui/TagEditor.tsx` and wired into `CuratorLookCreator.tsx` (replacing the comma-separated text input). See "Already shipped" below. |
| localStorage edits/deleted (`open-wardrobe-edits-v1`) | — | **No** | Single-user local model. OnPoint looks/extractions are server-persisted with agent/curator auth. Wrong persistence model. |
| OpenAI Responses API for garment detection | — | **No** | OnPoint uses `packages/ai-client` (Replicate provider, fashion-vision-service). Different stack. |
| `gpt-image` for garment extraction + modeled preview | — | **No** | OnPoint uses Replicate IDM-VTON (try-on) and Qwen `wan2.7-image-pro` (collage). Different pipeline. |
| `data/model-reference.png` for modeled preview | — | **No** | OnPoint try-on is per-session photo upload, not a static reference file. |

### What does NOT map (clarification)

Wardrobe is **not** a reference for the `/looks` page. The overlap with `/looks` is limited to:
- Gallery grid of cutouts — already implemented as well or better in OnPoint (`SafeImage`, `LooksGrid`, `LookItemGrid`).
- Item card with image + meta + action — already implemented (`ItemCard.tsx` with Hero badge + Swap button).
- `TagEditor` — the one `/looks`-adjacent borrow, already shipped (see below).

Wardrobe is a **single-user local catalog**. OnPoint looks are a **multi-tenant server-persisted composition layer** with agent/curator auth, x402 try-on, referral attribution, share-card generation, and cross-look discovery. Wardrobe has nothing to say about any of those concerns. The real overlap is **supply-prep**: turning curator photos into catalog-ready cutouts before they become listings, which then get composed into looks.

## Already shipped

As part of this ADR's preparation, `TagEditor` was lifted from Wardrobe's pattern into OnPoint:

- **New:** `apps/web/components/ui/TagEditor.tsx` — chip-based tag editor, lucide-react + Tailwind design tokens, controlled `value: string[]` / `onChange`, Enter/comma commit, case-insensitive dedup, `#` strip, optional `maxTags`.
- **Modified:** `apps/web/components/Curator/CuratorLookCreator.tsx` — replaced the comma-separated `<input>` for tags with `<TagEditor>`. State changed from `string` to `string[]`. Edit-mode prefill and create-mode reset updated accordingly.
- **Verified:** `pnpm --filter web check-types` passes clean.

## Phase 2 POC design target

When the Phase 2 operator POC is built, it should implement (in OnPoint's stack):

1. **Staged review** — detect → extract → optional modeled preview, each with approve/reject/regenerate. State model derived from Wardrobe's `deriveStatus` pattern.
2. **Cleanup tolerance** — for cutouts that fail auto-matte, a slider + before/after comparison + contaminated-pixel diagnostic. Interaction pattern from Wardrobe's `CleanupEditor`.
3. **Operator-only first** — per SCOPE-WOW, keep the POC outside the product surface. No curator-facing UI until quality is validated on real inventory.
4. **Storage** — accepted cutouts go to R2 under `curators/{slug}/cutouts/`, then feed existing listing creation. Not local `data/`.

## Phase 3 graduation criteria (unchanged from SCOPE-WOW)

- Extraction success rate > 80%
- Time to create catalog item < 2 minutes (vs. 10+ minutes manual)
- Manual rejection reason captured for every skipped fragment
- Curator adoption rate > 60% after productized rollout
- Supply density increase > 30% (items per curator)

## Consequences

- **Positive:** Phase 2 POC has a concrete interaction-design reference, reducing design ambiguity. `TagEditor` is already shipped and improves the create-look UX.
- **Neutral:** No dependency on Wardrobe. No vendored code. OnPoint's stack and storage model are unchanged.
- **Risk:** Borrowing interaction patterns without the underlying stack means reimplementing the state machine and cleanup logic. This is intentional — OnPoint's pipeline (Replicate/Qwen/R2) is different from Wardrobe's (OpenAI/local) and the UX must adapt to async server-side jobs rather than client-side localStorage.
