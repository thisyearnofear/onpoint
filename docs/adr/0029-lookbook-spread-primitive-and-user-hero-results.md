# ADR 0029: Lookbook spread primitive — the user is the cover, products are marginalia

- Status: **Proposed** (2026-11-07)
- Context: Post-analysis results in the fitting room violate the product's
  core promise. The uploaded photo renders as a cropped `aspect-[3/4]`
  card asset inside `AnalysisResults`, followed by the full read, and then
  `GarmentPicker` renders the entire catalog inline — search, filters, ~10
  product cards with prices, and "Generate AI Try-On" as the page's bottom
  edge. The person is data input; the inventory is the content. Product
  review called it "a cardinal sin": the user is no longer the hero.
- The magazine primitive already exists — `app/m/[id]/Flipbook.tsx` is a
  page-flip cover/spread/back viewer — but it only lives as the `/m/[id]`
  gift artifact. It was never promoted to a shared component, so the
  results flow was built utility-first.

## References — what each repo teaches, specifically

Three external references were reviewed; each contributes a distinct,
named mechanic. URLs are the canonical repos/demos.

### Codrops — LookbookHoverEffects
<https://github.com/codrops/LookbookHoverEffects> · demo at
<https://tympanus.net/Demos/LookbookHoverEffects/>

Eight hover effects where a card takes over a photograph along an edge
that is *never a plain straight wipe* — jagged, curved, folded, melting,
glass, or channel-flicker. GSAP 3.15 + WebGL (one variant, 03, uses a CSS
`clip-path` cut). Key mechanics we take:

- **The edge is the signature.** The reveal's boundary is the design, not
  the animation duration. A card arriving over a photo should come in
  along a *designed* contour.
- **Hover is a preview, not a destination.** The card overlays the photo
  and dismisses; the photo stays the anchor. Info enters as an overlay,
  never navigates away from the subject.
- **Touch parity.** "On a touch screen, tap one to bring its card in and
  tap again to send it off" — every hover effect has an explicit tap
  toggle, not a hover-only interaction.

### leafthrough — realistic 3D page-turning magazine
<https://github.com/dmtrbrl/leafthrough> · demo at
<https://dmtrbrl.github.io/leafthrough/>

Framework-agnostic (React/Vue/Svelte/web components/Three.js object)
flipbook: `spread` layout (open magazine, sheets turn over the spine) vs
`single` (one page at a time, read pages roll up behind). Mechanics we
take:

- **`page-aspect`, `bleed`, `layout`, `loop`, `label` are parameters, not
  constants.** A cover, a try-on spread, and a receipt-shaped back page
  have different proportions; shape belongs to the page primitive.
- **Drag follows the hand; release has physics.** Pages track the
  pointer and *fall* with momentum on release — a scrubber threshold
  (our current Flipbook's 40px) reads as a carousel, not paper.
- **Accessible by construction.** Keyboard control, screen-reader page
  announcements, `alt`→page description, `<figcaption>`→page text. Pages
  are `<img>`/`<figure>` children or a `pages` array — the magazine is a
  viewer over content, not the content itself.
- **Reduced motion degrades to a cut**, not a faster flip.

### amber — parallel page transitions on one timeline
<https://github.com/ismamz/amber> · Codrops writeup:
<https://tympanus.net/codrops/2026/10/08/building-parallel-page-transitions-with-gsap-and-reac>

React Router page transitions where outgoing and incoming routes are
choreographed on a *single shared GSAP timeline* (Hyperkinetic), so two
surfaces animate as one motion. We take:

- **One timeline, many actors.** Cover landing → marginalia typesetting
  → CTA fading is a sequence on one clock, not three independent
  animations that happen to overlap.
- **Transitions are a system property.** The seam photo→try-on-render
  and results→spread entry get the same treatment because they share the
  timeline primitive, not because each was styled ad hoc.

## Decision

### 1. `components/lookbook/` — the spread primitive

A page system extracted from `app/m/[id]/Flipbook.tsx` and generalized:

- `Spread` — page shell owning `aspect`, `bleed`, `label`, a caption
  slot, and the a11y contract (SR page announcement, `alt`/`figcaption`
  mapping). Content supplies nodes; the shell owns shape and semantics.
- `Cover` — maximal composition rules: centered photo, `font-display`
  name, mono eyebrow. Already proven by `/m/[id]`'s cover.
- `ItemSpread` — editorial plates for picked pieces only (see §3).
- `BackPage` — required, not optional: every spread declares its next
  loop (try-on CTA, send brief, reply, get-it). No dead-end spreads.
- `Lookbook` — the viewer: pointer-tracked flip with release momentum
  (leafthrough), arrow-key + swipe + tap-edge navigation (existing
  Flipbook parity), SR announcements, and `prefers-reduced-motion` →
  instant cut.

Motion: page turns and reveals run on the exponential ease-out already
canonical (`cubic-bezier(0.16,1,0.3,1)`); multi-element sequences are
choreographed as ordered phases on one timeline (amber), not parallel
independent animations.

### 2. The signature edge

One designed reveal contour — garment-silhouette or torn-magazine edge —
applied at the seam where a try-on render replaces the source photo, and
where analysis results replace the loading state. Implemented once in
the primitive (Codrops lesson: the edge *is* the effect); WebGL is out
of scope — a CSS `clip-path`/mask contour carries the same idea at our
weight class (their own variant 03 makes this argument).

### 3. Results recomposes as an issue, not a report

Post-analysis, the fitting room renders the user's result as a lookbook
issue:

- **Cover** — the uploaded photo, large-format and uncropped-feeling
  (`object-contain` in an editorial frame, not `object-cover` in a card
  slot). The fit read becomes marginalia: mono eyebrow ("THE READ ·
  CURVY"), `font-display` headline, one line. Body type, measurements,
  and styling notes that currently form a text wall move to spreads.
- **Item spreads** — only the *picked* pieces (planner/handoff logic
  selects 2–3), presented as plates with hover/tap overlay revealing
  price + try-on affordance (Codrops lesson 7). No catalog grid inline.
- **Back page** — Generate AI Try-On primary, then Send brief / Save /
  Style card / Share / Critique as the issue's colophon actions.

### 4. Catalog demoted to a swap rail

`GarmentPicker` stops being page content. It becomes the "Change the
piece" drawer — search, source/category filters, and the full grid move
behind a disclosure, reachable from the cover's marginalia ("not these?
→ swap"). The picker's internals are unchanged; only its placement in
the information architecture changes. This directly fixes the reported
screen where ~10 catalog cards with prices dominate the result.

### 5. `/m/[id]` migrates onto the primitive

The gift magazine becomes the primitive's first consumer — proves the
abstraction generalizes before the results flow bets on it. Its cover/
spread/back content maps onto `Cover`/`ItemSpread`/`BackPage` nearly
1:1.

### 6. The issue is the share artifact

A styled result serializes as look-issue data (photo + read + picked
items + note) renderable as flipbook, flat page, or share card — the
flipbook is a *view*, not the artifact (leafthrough lesson: pages are
images/figures; the magazine is a viewer). This makes "send her the
issue" and the `/magazine` gift flow the same object as the results
screen, collapsing three surfaces into one loop:
try-on → styled issue → send/share → get-it.

## Consequences

- `AnalysisResults`'s photo block and the GarmentPicker grid are
  replaced by spread composition; existing tests around those
  components get rewritten, not patched.
- The catalog remains fully reachable — behind the swap rail — so no
  capability is lost, only demoted.
- `Flipbook.tsx` is deleted once `/m/[id]` migrates; its keyboard/swipe
  behavior is preserved and extended (momentum, SR announcements).
- Honest-commerce rules unchanged: picked items carry studio/real
  attribution, prices stay behind `PriceReveal`, no fake merchant names.
- Web/API boundary unchanged: the issue is presentation over existing
  render/analysis/listing objects — no new data model.
- Deferred deliberately: WebGL hover effects, realtime co-presence,
  leafthrough's full Three.js physics. CSS clip-path + framer-motion
  carry the craft at our bundle budget.
