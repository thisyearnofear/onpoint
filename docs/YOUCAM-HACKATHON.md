# YouCam API Skin AI & Apparel VTO Hackathon

> **OnPoint** submission to the [YouCam API Skin AI & Apparel VTO
> Hackathon](https://youcam-api.devpost.com/) (Perfect Corp, Devpost).
> **Deadline: Aug 17, 2026 @ 11:45am EDT.** Prizes: $5,000 (1st) /
> $1,000 (2nd) / 5,000 API units (3rd–5th).

## Track: Apparel Virtual Try-On

The brief: *"Most online shopping decisions still come down to a guess — will
this fit, will this look right… Build something that replaces that guess with
something closer to certainty. Use YouCam's generative Apparel VTO to help
someone make a buying decision with more confidence."*

OnPoint is already built on that exact insight — fit verification before
agent checkout on real merchant inventory. The submission wires **YouCam's
cloth-v4 Apparel VTO** in as the primary try-on provider of OnPoint's paid
agent try-on tier, replacing the guess with a garment-conditioned render that
sits directly in front of a payable offer.

## Integration

**Provider chain (paid tier):** YouCam `cloth-v4` → Replicate IDM-VTON →
Venice SD35 (free tier). Selected via env: when `YOUCAM_API_KEY` is set,
paid try-ons attempt YouCam first; any failure (bad key, task error,
timeout) records `fallbackReason: 'youcam_unavailable'` and falls through
to the existing Replicate path. Same inventory, same x402 payment flow,
same fit signal and polaroid artifacts downstream.

| Component | Path |
|---|---|
| YouCam client (File API → cloth-v4 → poll → render URL) | `apps/api/lib/youcam-vto.js` |
| Engine wiring (paid-tier provider selection) | `apps/api/routes/ai-virtual-tryon.js` (`buildGeneratedOutfitImageResponse`) |
| Agent try-on route (unchanged interface) | `apps/api/routes/agent-tryon.js` |
| Funnel cost accounting (`youcam-cloth-v4`) | `apps/api/lib/funnel.js` |
| Unit tests (success path + 401 fallback) | `apps/api/routes/ai-virtual-tryon.test.js` |
| Live smoke test | `scripts/youcam-tryon-smoke.mjs` |

**API flow implemented** (docs: https://docs.perfectcorp.com):
1. `POST /s2s/v2.0/file` for base64/data-URI inputs → presigned PUT → `file_id`
   (public URLs pass through as `src_file_url` / `ref_file_url`)
2. `POST /s2s/v2.0/task/cloth-v4` with `{src, ref, garment_category: "auto"}` → `task_id`
3. Poll `GET /s2s/v2.0/task/cloth-v4/{task_id}` (1.5s interval, 120s window)
   until `task_status: success` → `data.results.url`

Auth: `Authorization: Bearer $YOUCAM_API_KEY`. Server:
`https://yce-api-01.makeupar.com`. Key console:
https://yce.makeupar.com/api-console/en/api-keys/

## Submission Requirements Checklist

| Requirement | Status |
|---|---|
| Integrate ≥1 YouCam API into a working prototype | ✅ code complete (`youcam-vto.js`, engine wiring, tests; 160/160 pass) |
| Live validation with real API key | ✅ smoke test passed: task `FbY2VwOwSKnweI-…`, 11.1s latency, real render (`scripts/youcam-tryon-smoke.mjs`) |
| Repo URL (public or shared with contact_event@PerfectCorp.com) | ✅ public: https://github.com/thisyearnofear/onpoint |
| Text description (features, consumer/retail value) | ✅ draft below + full Devpost fields in [docs/YOUCAM-DEVPOST-DRAFT.md](./YOUCAM-DEVPOST-DRAFT.md) |
| Screenshots | ✅ captured: `videos/youcam-demo/assets/{home,storefront-nia,directory}.png` + `render-result.jpg` |
| 1–3 min demo video (YouTube/Vimeo, publicly visible) | ✅ live: https://youtu.be/Y4u5q9jzlPs (2m15s, ElevenLabs narration + music) |

### Registration (owner steps, ~7 min total)
1. Register on Devpost for the hackathon → redeem code arrives by email
2. Sign up at https://yce.makeupar.com/ai-api and verify email
3. Account → Redeem Code → claim the free 1,000 API units
4. Generate an API key at https://yce.makeupar.com/api-console/en/api-keys/
5. Put the key in `apps/api/.env` as `YOUCAM_API_KEY`, then:
   `node scripts/youcam-tryon-smoke.mjs`

## Draft Submission Text

**OnPoint: fit-verified agentic fashion commerce, powered by YouCam Apparel VTO**

Online fashion shopping is a guessing game: will it fit, will it look right,
is it worth the return shipping? OnPoint replaces the guess with certainty —
and makes that certainty *executable*. It is a live agent-commerce platform
where AI agents browse real merchant inventory, try garments on the shopper's
own photo using YouCam's generative Apparel Virtual Try-On, receive a
structured fit signal, and complete purchases with stablecoin payments
(cUSD on Celo / USD₮0 on XLayer) before a human ever sees a checkout page.

YouCam cloth-v4 sits at the decision point of the entire purchase funnel:
every paid try-on is a garment-conditioned render of the *actual* listing
photo on the *actual* shopper photo, feeding an LLM-parsed fit score that
agents use to decide whether to buy. Try-on is not a demo feature here — it
is the gate the transaction passes through, and YouCam is the gate's
perception model. When YouCam is unavailable, OnPoint degrades gracefully
through a documented provider chain (Replicate IDM-VTON → Venice), keeping
the commerce rail live; when it is, the render, fit signal, shareable
polaroid, and x402-paid receipt all carry the same listing, price, and
attribution as the storefront a human would shop.

Consumer/retail value is measured, not claimed: OnPoint already tracks
try-on → purchase conversion per provider tier in a public reconciled
ledger, so the business case (fewer returns, higher agent conversion) is
observable per render.

## Evidence Log

| Time | Event |
|---|---|
| 2026-08-16 | Challenge discovered; deadline Aug 17 11:45 EDT |
| 2026-08-16 | Integration built: `youcam-vto.js`, engine wiring, funnel costs, env example |
| 2026-08-16 | Tests: 160/160 pass incl. 2 new YouCam tests (success + 401 fallback) |
| 2026-08-16 | Smoke script ready: `scripts/youcam-tryon-smoke.mjs` |
| 2026-08-16 | Live smoke test passed with real key: task `FbY2VwOwSKnweI-…`, 11.1s, real render saved to `media/youcam-demo/render-result.jpg` |
| 2026-08-16 | Demo video rendered: `videos/youcam-demo/renders/onpoint-youcam-demo.mp4` (2m15s, 1080p) |
| 2026-08-16 | Video upgraded: ElevenLabs narration (Charlie, word-timestamp-synced scenes) + ElevenLabs instrumental music bed |
| 2026-08-16 | Scene 1 hook redesigned: removed errant "FIT?" ghost, added scattered live-demo polaroids + fashion ticker; hyperframes check passes (0 errors) |
| 2026-08-16 | Final render copied to `~/Downloads/onpoint-youcam-demo.mp4` — pending YouTube upload + Devpost submission |
| 2026-08-17 | Video live on YouTube: https://youtu.be/Y4u5q9jzlPs |
| 2026-08-17 | Devpost field drafts written (see `docs/YOUCAM-DEVOPOST-DRAFT.md`) |
