# OnPoint UX Improvement Plan
**Date**: 2026-03-17 | **POC**: AdaL | **TL;DR**: Phased backlog (P0→P2) mapping 12 improvements to existing components with exact UI changes, event tracking, and effort estimates.

---

## Current State Summary

| Component | What Exists | What's Missing |
|-----------|------------|----------------|
| **ActionHub** | 4 static action cards, 3-step dot/line progress ("Photo Ready → Choose Experience → See Results") | No recommended action badge, no single primary CTA per stage |
| **PhotoUpload** | Drag-and-drop, `image/*` type check only | No quality validation (pose, lighting, occlusion) |
| **TryOnResult** | Static spinner + "Generating your personalized outfit...", `string[]` styling tips with `**bold**` parsing, Farcaster share + Web Share fallback | No staged progress, no actionable tip buttons, no compare/history |
| **LiveStylistView** | HUD overlay (scanning line + corner brackets), reasoning ticker, 3-2-1 countdown, Proof of Style capture (canvas → data URL), Farcaster share | No session goal selection, no real-time coaching prompts, no completion summary screen, no packaged "Proof of Style" card |
| **VirtualTryOn (orchestrator)** | Boolean state machine (`showAnalysis`, `showPersonalitySelection`, `showLiveStylist`, `tryOnResult`) | No stage enum, no version history state |
| **AILoadingStates** | 5 patterns (design/color/tryon/chat/analysis) with icon + pulse + bounce dots | No staged progress copy, no time estimates, no "browse while waiting" |

---

## P0 — Quick Wins (Ship in 1–2 days each)

### P0.1 — Staged Progress Text in TryOnResult
**Component**: `TryOnResult.tsx` (L74-82), `AILoadingStates.tsx`
**Change**: Replace static "Generating your personalized outfit..." with staged copy.
```tsx
// New state in TryOnResult:
const [progressStage, setProgressStage] = useState(0);
const progressStages = [
  "Analyzing body proportions…",
  "Matching garment drape & fit…",
  "Rendering final look…",
  "Adding finishing touches…",
];

// useEffect with timer to advance stages every 8-12s
// AILoadingStates: add optional `stages?: string[]` prop to `tryon` pattern
```
**Event Tracking**: `tryon_progress_stage_reached` `{ stage_index, stage_label, elapsed_ms }`
**Effort**: 2h

---

### P0.2 — Photo Quality Hints in PhotoUpload
**Component**: `PhotoUpload.tsx` (after L32 type check)
**Change**: Add 3 static hint chips below the upload zone.
```tsx
// After successful image type validation, show:
const qualityHints = [
  { icon: User, text: "Full body in frame" },
  { icon: Sun, text: "Good, even lighting" },
  { icon: Eye, text: "Face clearly visible" },
];
// Render as muted pills/badges below the drop zone
// These are hints, not blockers — upload still proceeds
```
**Event Tracking**: `photo_upload_quality_hints_shown`, `photo_upload_submitted` `{ has_hints_visible: true }`
**Effort**: 1.5h

---

### P0.3 — "Recommended" Badge in ActionHub
**Component**: `ActionHub.tsx` (L114-209)
**Change**: Add a "Recommended" badge to the "Style Outfit Generator" card (first-time users) or "Body Scan" (returning users with no measurements).
```tsx
// Add prop: recommendedAction?: 'generate' | 'scan' | 'critique' | 'analysis'
// In orchestrator: default to 'generate' for first visit, 'scan' if no body data
// Badge: small pill "✨ Recommended" positioned top-right of the card
// Make the recommended card's button use the fashion-gradient (already exists on generate)
```
**Event Tracking**: `actionhub_shown` `{ recommended_action }`, `actionhub_action_clicked` `{ action, is_recommended }`
**Effort**: 1.5h

---

### P0.4 — "Try a Variant" Buttons Under Styling Tips
**Component**: `TryOnResult.tsx` (L106-118)
**Change**: Add a small inline button after each tip.
```tsx
// Current: <li>{parsedTip}</li>
// New: <li className="flex items-start gap-2">
//   <span>{parsedTip}</span>
//   <button onClick={() => onVariantFromTip(tip)} className="text-xs text-primary hover:underline whitespace-nowrap">
//     Try variant →
//   </button>
// </li>
// New prop on TryOnResult: onVariantFromTip?: (tip: string) => void
// In orchestrator: pre-fill the garment prompt with the tip context and re-trigger generation
```
**Event Tracking**: `styling_tip_variant_clicked` `{ tip_index, tip_text }`
**Effort**: 2h

---

### P0.5 — Before/After Compare Toggle on Result Card
**Component**: `TryOnResult.tsx`
**Change**: Add a toggle button that overlays the original photo on hover/hold.
```tsx
// New state: const [showOriginal, setShowOriginal] = useState(false);
// Pass originalPhotoUrl as prop (already available in orchestrator as selectedPhoto)
// Render: if showOriginal, display original image in same container
// Button: "Hold to compare" — use onMouseDown/onMouseUp (desktop) + onTouchStart/onTouchEnd (mobile)
// Smooth crossfade between original and generated
```
**Event Tracking**: `result_compare_toggled` `{ duration_ms }` (track hold duration)
**Effort**: 3h

---

## P1 — High-Impact Features (1–2 weeks each)

### P1.1 — 5-Stage Progress Stepper
**Component**: `ActionHub.tsx` (L46-76), `VirtualTryOn.tsx`
**Change**: Replace 3-step indicator with 5-stage progress rail.
```tsx
// New stage enum (add to shared-types or local):
type TryOnStage = 'upload' | 'analyze_fit' | 'generate_look' | 'refine' | 'save_share';

// ProgressRail component:
// Horizontal on desktop, vertical on mobile
// Each stage: circle icon + label + connecting line
// Active stage: primary color, pulsing
// Completed: checkmark, primary
// Upcoming: muted, no icon
// Maps from existing boolean states:
//   upload → !selectedPhoto
//   analyze_fit → showAnalysis || showPersonDescription
//   generate_look → tryOnLoading
//   refine → !!tryOnResult
//   save_share → !!tryOnResult (post-refine actions)
```
**Single Primary CTA**: In each stage, the "recommended next step" button gets `fashion-gradient` + slightly larger size. Other actions become secondary (outline style).
**Event Tracking**: `stepper_stage_entered` `{ stage, from_stage }`, `stepper_stage_completed` `{ stage, duration_ms }`
**Effort**: 1 week

---

### P1.2 — Lightweight Photo Quality Checks
**Component**: `PhotoUpload.tsx`, new `usePhotoQualityCheck.ts` hook
**Change**: Run client-side checks after upload, show pass/warn UI.
```tsx
// usePhotoQualityCheck hook:
// Input: HTMLImageElement (from FileReader)
// Checks (all client-side, no API call):
//   1. Brightness: sample pixels, check mean > threshold (good lighting)
//   2. Aspect ratio: warn if extremely portrait/landscape (body likely cropped)
//   3. File size: warn if < 100KB (likely low quality) or > 10MB
//   4. Blur detection: Laplacian variance on grayscale canvas (optional, heavier)
// Output: { checks: { name, status: 'pass'|'warn'|'fail', message }[] }

// UI: After upload, show a brief quality summary
//   ✅ Good lighting  ⚠️ Consider stepping back for full body
// Upload still proceeds — these are soft signals, not blockers
// If 2+ fails: show modal "For best results, we recommend…" with re-upload option
```
**Event Tracking**: `photo_quality_check_result` `{ check_name, status }`, `photo_quality_reupload_triggered` `{ fail_count }`
**Effort**: 1.5 weeks

---

### P1.3 — Side-by-Side Compare + Version History
**Component**: New `LookVersionHistory.tsx`, `CompareView.tsx`, modifications to `TryOnResult.tsx`, `VirtualTryOn.tsx`
**Change**: Store generated looks, enable comparison.
```tsx
// New state in orchestrator:
const [lookVersions, setLookVersions] = useState<LookVersion[]>([]);
// LookVersion = { id, imageUrl, prompt, stylingTips, timestamp, label? }

// Every successful generation pushes to lookVersions
// TryOnResult: add "Save & Compare" button alongside existing share
// LookVersionHistory: horizontal scrollable strip of version thumbnails below result
// CompareView: grid layout (2-up or 3-up) with original + selected versions
//   Each cell: image + label + styling tips summary
//   Can toggle which versions to compare

// Placement: shown when lookVersions.length >= 2
// Accessible from TryOnResult via "Compare looks" button
```
**Event Tracking**: `look_version_saved` `{ version_count }`, `compare_view_opened` `{ versions_compared }`, `compare_version_selected` `{ version_id }`
**Effort**: 2 weeks

---

### P1.4 — Actionable Styling Tips with Direct Actions
**Component**: `TryOnResult.tsx` (extends P0.4)
**Change**: Transform tips from text to actionable cards.
```tsx
// Upgrade stylingTips from string[] to structured type:
interface StylingTip {
  text: string;
  action?: {
    type: 'regenerate_variant' | 'color_change' | 'garment_swap';
    label: string;        // "Try with darker trousers"
    payload: string;      // modifier to append to prompt
  };
}

// This requires the AI to return structured tips (API change to /api/ai/virtual-tryon)
// Backward compatible: if tips are still string[], wrap with no action
// Render: tip card with text + action button (secondary style)
// Action button triggers orchestrator to re-generate with modified prompt
```
**API Change**: Update prompt in `packages/ai-client` to request JSON-structured tips.
**Event Tracking**: `styling_tip_action_clicked` `{ tip_index, action_type }`, `styling_tip_conversion` `{ action_type → generated_result }`
**Effort**: 2 weeks (includes API prompt work)

---

## P2 — Live Stylist Overhaul (2–3 weeks each)

### P2.1 — Session Goal Selection
**Component**: `LiveStylistView.tsx`, new `SessionGoalPicker.tsx`
**Change**: Add goal selection screen before session starts.
```tsx
// SessionGoalPicker (shown before camera starts):
// Three cards:
//   🎯 Event Outfit — "I have a specific event to dress for"
//   ✨ Daily Style Upgrade — "Help me level up my everyday look"
//   🔥 Brutal Critique — "Be honest, tell me what's not working"
// Selected goal stored in state, passed to Gemini system prompt
// In useGeminiLive hook: prepend goal context to system instructions
//   e.g., "The user wants a brutal critique. Be direct, specific, and prioritize
//          identifying fit/flaws over compliments."
```
**Event Tracking**: `live_session_goal_selected` `{ goal }`, `live_session_started` `{ goal }`
**Effort**: 1 week

---

### P2.2 — Real-Time Coaching Overlays
**Component**: `LiveStylistView.tsx` (extends existing HUD at L212-233)
**Change**: Add contextual coaching prompts based on video analysis.
```tsx
// New state: coachingPrompt: { icon, text, urgency: 'info'|'warning' } | null
// Sources:
//   1. AI-driven: parse Gemini's streaming responses for coaching cues
//      (add instruction to system prompt: "If you notice lighting/pose/distance issues,
//       prefix your response with [COACH: step back / turn left / too dark]")
//   2. Client-side heuristics (lightweight):
//      - Average brightness < threshold → "Lighting seems dim — move closer to a window"
//      - Face detection confidence < threshold → "Step back so your full body is visible"
//   3. Time-based: if no capture in 60s → "Ready to capture? Tap the button or say 'capture'"

// Render: floating pill at bottom of video feed
//   Info: subtle, auto-dismisses after 5s
//   Warning: slightly more prominent, stays until condition improves
// Does NOT block session — purely advisory
```
**Event Tracking**: `coaching_prompt_shown` `{ source, prompt_text }`, `coaching_prompt_actioned` (did user adjust after prompt)
**Effort**: 2 weeks

---

### P2.3 — Session Completion Summary Screen
**Component**: New `SessionSummary.tsx`, modifications to `LiveStylistView.tsx`
**Change**: Dedicated summary when user ends session.
```tsx
// SessionSummary (replaces current capture review):
// Section 1: "Top 3 Recommendations"
//   Extracted from Gemini conversation (last N messages with [RECOMMENDATION] tag)
//   Render as numbered cards with icon
// Section 2: "Best Captures"
//   Auto-tag captures: "Best for fit" (highest AI confidence), "Best for color" (most colorful)
//   Grid of capture thumbnails with tags
// Section 3: "Next Actions"
//   Three buttons:
//     "Regenerate a look" → navigates to TryOn with session context
//     "Save Proof of Style" → triggers P2.4 packaging
//     "Shop Similar" → links to fashion products
// Section 4: "Your Style Score"
//   e.g., "Smart Casual: 8/10" based on AI assessment
```
**AI Change**: Update Gemini system prompt to emit structured summary data on session end.
**Event Tracking**: `session_summary_shown` `{ goal, capture_count, recommendation_count }`, `session_summary_action` `{ action }`
**Effort**: 2.5 weeks

---

### P2.4 — Proof of Style Pack (Share-Ready)
**Component**: New `ProofOfStylePack.tsx`, extends existing capture in `LiveStylistView.tsx` (L81-127)
**Change**: Package capture into a shareable card.
```tsx
// ProofOfStylePack generates a composite image (canvas):
// Layout: 4:5 aspect ratio card
//   Top 70%: Chosen capture screenshot
//   Bottom 30%: Dark overlay with:
//     - "OnPoint Style Proof" title
//     - Stylist's final comment (1-2 sentences from session)
//     - 1-2 concise tips
//     - Score badge: "Smart Casual: 8/10"
//     - Small OnPoint logo/watermark

// Share flow:
//   1. User selects a capture from SessionSummary
//   2. "Create Style Proof" → renders composite to canvas
//   3. Preview modal with "Share to Farcaster" / "Download" / "Copy"
//   4. Farcaster: upload composite image as cast attachment
//   5. Download: save as PNG
//   6. Copy: copy image to clipboard
```
**Event Tracking**: `proof_of_style_created` `{ goal, score }`, `proof_of_style_shared` `{ platform }`
**Effort**: 2 weeks

---

## Event Tracking Matrix

| Event | P0/P1/P2 | Metric It Improves |
|-------|-----------|-------------------|
| `stepper_stage_entered` | P1.1 | Funnel drop-off per stage |
| `stepper_stage_completed` | P1.1 | Stage completion rate |
| `photo_quality_check_result` | P1.2 | Quality → result quality correlation |
| `photo_quality_reupload_triggered` | P1.2 | Self-correcting upload rate |
| `tryon_progress_stage_reached` | P0.1 | Perceived wait time, abandonment |
| `actionhub_action_clicked` + `is_recommended` | P0.3 | Recommendation CTR |
| `styling_tip_variant_clicked` | P0.4 | Iteration loop engagement |
| `result_compare_toggled` | P0.5 | Compare usage frequency |
| `look_version_saved` | P1.3 | Multi-look generation rate |
| `compare_view_opened` | P1.3 | Compare adoption |
| `styling_tip_action_clicked` | P1.4 | Tip-to-action conversion |
| `live_session_goal_selected` | P2.1 | Goal distribution |
| `coaching_prompt_shown` | P2.2 | Coaching effectiveness |
| `session_summary_action` | P2.3 | Post-session engagement |
| `proof_of_style_shared` | P2.4 | Share rate (primary KPI) |

---

## North Star Metrics to Track

1. **Completion Rate**: % of uploads that reach "Save/Share" stage (stepper P1.1 enables this)
2. **Time-to-First-Good-Look**: Time from upload to first saved/variant look (P0.4 + P1.4)
3. **Share Rate**: % of results that get shared (P2.4 directly, P0.5 indirectly)
4. **Iteration Rate**: Average number of looks generated per session (P0.4 + P1.3 + P1.4)
5. **Live Session Completion Rate**: % of live sessions that reach summary screen (P2.1 + P2.3)

---

## Implementation Order (Recommended)

```
Week 1-2:  P0.1 + P0.2 + P0.3 (parallel — independent components)
Week 2-3:  P0.4 + P0.5 (parallel — both modify TryOnResult, coordinate)
Week 3-5:  P1.1 (stepper — foundational, touches orchestrator)
Week 5-7:  P1.2 (quality checks — builds on P0.2 hints)
Week 7-9:  P1.3 (version history — needs P1.1 stepper for stage context)
Week 7-9:  P1.4 (actionable tips — parallel with P1.3, different surface)
Week 9-10: P2.1 (session goals — standalone, unblocks P2.2-P2.4)
Week 10-12: P2.2 + P2.3 (coaching + summary — can parallel)
Week 12-14: P2.4 (proof of style — builds on P2.3 summary data)
```

**Total estimated effort**: ~14 weeks for a solo dev, ~8 weeks with 2 devs (P0.4/P0.5 and P1.3/P1.4 can be parallelized).
