# Scope: Wow Features Implementation

**Created:** 2026-07-15  
**Status:** Phase 1 implemented; clothing extraction POC pending  
**Priority:** High

## Reference Opportunities

- [Codrops Astro Shop View Transitions](https://github.com/codrops/astro-shop-view-transitions): borrow the shop feel and shared-element navigation pattern, translated to the existing Next App Router rather than adopting Astro.
- [Extract Clothing Cutouts skill](https://gist.github.com/tandpfun/b73063c8be8fc46644da9925d48b3240): borrow the source-faithful garment extraction workflow as a supply-prep/operator POC before turning it into a curator-facing product feature.

---

## Feature 1: View Transitions (Browser Native)

### Scope
Add native View Transitions API to storefront browsing for app-like navigation feel.

### Principle Alignment
- ✅ **ENHANCEMENT FIRST:** Enhances existing Next.js navigation, no new components
- ✅ **CONSOLIDATION:** Single CSS file addition, no deprecated code
- ✅ **PREVENT BLOAT:** ~50 lines of CSS, no JS framework overhead
- ✅ **DRY:** One `view-transitions.css` file controls all transitions
- ✅ **CLEAN:** CSS layer only, no business logic mixing
- ✅ **MODULAR:** Can enable/disable per route via `data-view-transition` attribute
- ✅ **PERFORMANT:** Native browser API, zero runtime JS, hardware-accelerated
- ✅ **ORGANIZED:** `apps/web/app/view-transitions.css` is imported alongside app-level styles

### Technical Scope
**Files to create:**
- `apps/web/app/view-transitions.css` (new)

**Files to modify:**
- `apps/web/app/layout.tsx` (import CSS)
- `apps/web/app/s/[slug]/page.tsx` (add unique `viewTransitionName` values to storefront destinations and listing cards)
- `apps/web/app/curators/CuratorDirectoryClient.tsx` (keep slug-specific curator card/name/avatar transitions)

**Estimated time:** 1-2 hours

### Success Criteria
- Curator card → storefront shows name/avatar morph
- Storefront route changes crossfade smoothly with stable shared elements
- Product/listing transition names are unique per listing, avoiding duplicate `view-transition-name` failures in grids
- Works on Chrome 111+, Edge 111+, Safari 18+
- Graceful degradation on unsupported browsers

---

## Feature 2: Clothing Extraction (Photo-to-Catalog)

### Scope
Start as an operator workflow that accepts a folder of curator/model photos and produces transparent PNG catalog cutouts. Productize into an API/onboarding feature only after output quality is validated on real OnPoint inventory.

### Principle Alignment
- ✅ **ENHANCEMENT FIRST:** Enhances supply readiness before touching curator onboarding
- ✅ **CONSOLIDATION:** Replaces manual photo editing, removes need for external tools
- ✅ **PREVENT BLOAT:** POC can run outside the product surface, using existing image-generation capability
- ✅ **DRY:** Final cutouts can feed existing listing creation and storage paths
- ✅ **CLEAN:** Operator POC separates extraction quality from onboarding UX
- ✅ **MODULAR:** Can later graduate into an API endpoint or curator tool
- ✅ **PERFORMANT:** Batch processing can be async once productionized
- ✅ **ORGANIZED:** Keep POC outputs isolated from source photos and final catalog records

### Technical Scope
**POC workflow:**
- Input: local folder of curator/model photos
- Output: a new local folder containing only final transparent RGBA clothing PNGs
- Internal manifest: item slug, category, source refs, visible construction, unknowns, duplicate evidence
- Quality gate: visual inspection of source contact sheets and final contact sheets
- Acceptance rule: omit heavily obscured garments rather than inventing unseen details

**Production graduation scope, after validation:**
- `apps/api/routes/curator-extract.js` (POST endpoint)
- `apps/api/services/clothing-extraction.js` (business logic)
- `apps/web/components/curator/ClothingExtractor.tsx` (upload/review UI)
- `apps/web/app/curator/onboard/page.tsx` (optional entry point)
- Existing storage/listing creation path for accepted cutouts

**Estimated time:** 0.5-1 day for operator POC, 2-4 days for productized version

### Success Criteria
- Operator processes 5-12 curator photos → receives distinct transparent PNGs
- PNGs pass quality check (no body parts, clean edges, transparent background)
- Duplicate garments are merged only when source photos support physical identity
- Obscured/ambiguous fragments are skipped with a short note
- Productized version stores accepted results under `curators/{slug}/cutouts/`

---

## Execution Plan

### Phase 1: View Transitions (Quick Win)
**Time:** 1-2 hours  
**Goal:** Ship view transitions to production

1. Create `view-transitions.css` with shared element transitions
2. Add unique `viewTransitionName` values to curator and listing elements
3. Test in Chrome/Safari, verify graceful degradation
4. Deploy to staging, test on real devices
5. Merge to main

### Phase 2: Clothing Extraction Operator POC (Transformative)
**Time:** 0.5-1 day  
**Goal:** Working local workflow that processes real curator photos

1. Collect 5-12 real curator photos in a local input folder
2. Run the cutout workflow against those photos
3. Inspect source contact sheets, generated cutouts, and final contact sheets
4. Import accepted PNGs into a test storefront/listing path
5. Measure time saved and rejection reasons
6. Decide whether to productize

### Phase 3: Production Hardening (Post-POC)
**Time:** 3-5 days (after POC validation)  
**Goal:** Production-ready clothing extraction

1. Add API endpoint and async job queue
2. Implement upload, progress, review, accept/reject, and retry states
3. Add deduplication and source-image audit trail
4. Store accepted results in R2
5. Add one-click import to catalog/listing creation
6. Track extraction success rate, time per item, and manual correction rate
7. Roll out behind a curator feature flag

---

## Risk Mitigation

### View Transitions
- **Risk:** Browser support gaps  
  **Mitigation:** Graceful degradation, no JS required
- **Risk:** Animation jank on low-end devices  
  **Mitigation:** Reduce animation complexity, use `prefers-reduced-motion`

### Clothing Extraction
- **Risk:** Image generation invents unseen garment details  
  **Mitigation:** Operator POC requires visual source inspection and skips obscured items
- **Risk:** Processing time too long  
  **Mitigation:** Batch locally first; async queue only after product validation
- **Risk:** Product UX ships before quality is proven  
  **Mitigation:** Keep initial workflow operator-only

---

## Success Metrics

### View Transitions
- Page transition time < 300ms (perceived)
- User satisfaction score increase (post-launch survey)
- No regression in Core Web Vitals

### Clothing Extraction
- Extraction success rate > 80%
- Time to create catalog item < 2 minutes (vs. 10+ minutes manual)
- Manual rejection reason captured for every skipped fragment
- Curator adoption rate > 60% after productized rollout
- Supply density increase > 30% (items per curator)

---

## Rollback Plan

### View Transitions
- Remove CSS import from `layout.tsx`
- No data migration, instant rollback

### Clothing Extraction
- Stop operator workflow; no product code path required for POC rollback
- If productized, disable endpoint in feature flags
- Manual onboarding path remains available

---

## Current Verification

### View Transitions
- `pnpm --filter web check-types` passes.
- Direct ESLint on the touched TSX files reports no errors, with existing warnings for `<img>` usage and unescaped apostrophes.
- Full `next build` and `next dev` currently stop on the existing ambiguous `/r/[receiptId]` and `/r/[referralCode]` route conflict, before these changes can be visually inspected.
- The package-level `web` scripts currently cannot resolve `next` from `apps/web/node_modules/.bin`; direct root binary invocation reaches Next.

### Clothing Extraction
- POC not started. Needs one representative curator photo batch and an approved image-generation/editing path.

---

## Dependencies & Blockers

### View Transitions
- **None** — ready to execute immediately

### Clothing Extraction
- **Blocker:** Need 5-12 representative curator photos for a useful POC
- **Blocker:** Need an approved image-generation/editing path for garment reconstruction
- **Decision needed:** Which curator inventory batch should be the first test set?

---

## Recommendation

**Sequence both:**
1. View Transitions: Ship today
2. Clothing Extraction: Run operator POC on one real inventory batch before API/UI work

**Rationale:**
- View Transitions is low-risk, high-delight, ships fast
- Clothing Extraction is transformative but quality-sensitive
- The POC can prove supply impact without database or onboarding churn

---

## Next Actions

1. Resolve the existing `/r/[receiptId]` vs `/r/[referralCode]` route conflict so build/dev can run.
2. Inspect the storefront transitions in Chrome/Safari.
3. Select first curator photo batch.
4. Run Phase 2 (Clothing Extraction Operator POC).
5. 📊 Measure results
6. 🚀 Ship to production
7. 📈 Iterate based on feedback
