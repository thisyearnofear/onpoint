# Meta VR Start Competition Plan — OnPoint

This document is the build frame of reference for adapting OnPoint to the Meta VR Start Developer Competition 2026.

## Goal
Show a polished VR fashion showroom on Quest where avatars browse, try‑on items, and check out — with new work completed during the competition window.

## Current relevant surfaces
- README: project overview, live demo link
- Strategy: `docs/STRATEGY.md`
- ADRs: 0012 x402 facilitator, 0017 prava agent checkout, 0024 consumer wardrobe studio
- Research manuscripts: `docs/research/manus/`

## Competition adaptation architecture

### Quest‑native build
- Export from Unity (or WebGL build) as an APK/IPA.
- Enable **hand tracking** (no controllers required).
- Use **ARCore/ARKit shims** adapted for Quest inside‑out passthrough where needed.
- Target: ≥60 fps on Quest 2 for the gallery scene.

### VR fashion flow
1. Avatar starts in showroom hub.
2. Browse items with hand gestures (pinch/swipe).
3. Select item → try‑on effect renders on avatar mesh.
4. Checkout gesture → receipt pop‑up (price 2.5% referral commission).
5. Share clip button → ffmpeg encode last 30 s → write to `assets/meta_competition/share_clip.mp4`.

## Week plan
- [ ] Week 1: Port OnPoint gallery to Quest‑compatible shaders; get static mesh gallery running.
- [ ] Week 2: Add hand‑tracking gestures and avatar picker.
- [ ] Week 3: Add try‑on shader + receipt pop‑up; record 2‑min demo video.
- [ ] Week 3‑4: Write `META_COMPETITION.md`, update README, push all changes.
- [ ] Week 4: Register on Devpost, submit, share on socials.

## Demo script
1. Avatar starts in showroom hub.
2. Browse items with hand gestures; item highlights as pointer approaches.
3. Select item → try‑on effect plays on avatar.
4. Checkout gesture → receipt pop‑up appears.
5. Share button → short clip auto‑uploads.

## Risks and fallbacks
- If shader performance dips below 60 fps, fallback to a **video‑based demo** with overlay annotations.
- If hand‑tracking reliability is insufficient, support **Touch controllers** as a secondary input.
- If the new work is minimal, clearly mark the 3‑4 commits in `META_COMPETITION.md` that constitute the competition contribution.
