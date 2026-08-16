# YouCam Hackathon — Demo Video Script

> Target: **2:30–2:45** (judges won't watch past 3:00). Upload to YouTube,
> public/unlisted, no copyrighted music. Link goes on the Devpost submission.
>
> Working title: **"OnPoint — fit-verified agentic fashion commerce on YouCam Apparel VTO"**

## Before recording (checklist)

- [ ] `YOUCAM_API_KEY` in `apps/api/.env`, smoke test green:
      `node scripts/youcam-tryon-smoke.mjs` (render URL returned)
- [ ] API deployed with the key set (or run locally: `pnpm --filter @onpoint/api dev`)
      and `GET /okx/health` / storefront loads
- [ ] Pick a curator with a strong physical listing (e.g. `nia`) — note the listing ID
- [ ] Have a buyer wallet with cUSD + CELO for the on-chain leg (`AGENT_PRIVATE_KEY`)
- [ ] Terminal font ≥ 14pt, window clean; browser zoom 110%+ for screenshots
- [ ] Screen recorder on (audio: record narration separately for clean VO)

## Storyboard

### Scene 0 — Hook (0:00–0:12)
**Screen:** beonpoint.netlify.app storefront, slow scroll over listings.
**VO:**
> "Online fashion is a guessing game — will it fit, will it look right, is it
> worth the return shipping? OnPoint replaces the guess with proof, and lets
> AI agents shop with that proof on real merchant inventory."

### Scene 1 — The product (0:12–0:35)
**Screen:** curator directory → storefront page, highlight a listing price.
**VO:**
> "OnPoint is live agent commerce: humans browse branded storefronts, agents
> execute against the same inventory — structured offers, sizes, stock, and
> stablecoin checkout on Celo. But before any agent spends a cent, it checks
> the fit. That check is powered by YouCam."

### Scene 2 — The API, raw (0:35–1:10) ★ most important for judging
**Screen:** terminal running the smoke test, then the API logs.
**Action:**
```bash
node scripts/youcam-tryon-smoke.mjs
```
Zoom on the output: `task_id`, latency, `renderUrl` → open render in browser.
Then show the logs proving the chain:
`File API → POST /s2s/v2.0/task/cloth-v4 → poll → success`.
**VO:**
> "We integrated YouCam's generative Apparel Virtual Try-On — cloth-v4 — as a
> first-class provider in our try-on engine. A person photo and a garment image
> go in through the File API, a cloth-v4 task comes out. This is the same
> infrastructure that powers 800+ brands, now gating real purchases."

### Scene 3 — Agent flow, end to end (1:10–2:00) ★ the money shot
**Screen:** terminal + browser side by side.
**Action:** run the reference agent:
```bash
AGENT_PRIVATE_KEY=0x... node scripts/agent-tryon.mjs --curator nia --listing <id>
```
1. Agent POSTs → **402** (show the x402 payment requirements)
2. Agent pays the try-on fee in cUSD (Celoscan tx flashes)
3. Re-POST → **200**: try-on render (YouCam garment on the person), fit signal JSON, polaroid
4. Agent places the order → order receipt page `/receipt/...`
**VO:**
> "Watch the full loop: an agent discovers a live listing, gets a 402,
> pays the try-on fee in cUSD, and YouCam renders the actual garment on the
> shopper's photo. OnPoint parses that into a structured fit score, the agent
> decides — and buys. Receipt on-chain. The YouCam render isn't decoration;
> it's the evidence the transaction was made on."

### Scene 4 — Why it matters (2:00–2:25)
**Screen:** funnel dashboard / earnings ledger (`GET /api/status/funnel`, curator earnings page).
**VO:**
> "Every render is tracked in a public reconciled ledger — try-on to purchase
> conversion, cost and revenue per provider tier. Fewer returns for merchants,
> confidence for shoppers, and a measurable funnel that proves the value.
> YouCam perception meets agentic execution."

### Scene 5 — Closer (2:25–2:40)
**Screen:** OnPoint logo + storefront URL + "YouCam Apparel VTO inside" badge.
**VO:**
> "OnPoint: fit-aware, machine-readable, locally payable fashion commerce —
> live today, with YouCam at the fitting-room door."

## Recording notes

- Record at 1080p, 30fps. Keep one action per cut; no scrolling walls of text.
- The two terminal scenes (2 and 3) must show **real** runs against the real
  API — judges reward "working, non-trivial implementation". Pre-warm the
  render cache OFF for the recording (fresh `task_id` on camera).
- If an on-chain payment leg stalls during recording, retry before cutting —
  the paid 402→200 loop is the core claim.
- Show `provider: "youcam-cloth-v4"` in the response JSON at least once,
  full-screen for ~2 seconds. That single frame ties the whole video to the API.

## YouTube metadata

- **Title:** OnPoint — Fit-Verified Agent Fashion Commerce with YouCam Apparel VTO
- **Description:**
  ```
  YouCam API Skin AI & Apparel VTO Hackathon submission.

  OnPoint turns fashion guessing into fit-verified certainty: AI agents browse
  real merchant inventory, try garments on the shopper's photo using YouCam's
  generative Apparel Virtual Try-On (cloth-v4), get a structured fit signal,
  and complete stablecoin checkout on Celo — with every render reconciled in a
  public earnings ledger.

  Live: https://beonpoint.netlify.app
  Repo: https://github.com/thisyearnofear/onpoint
  API:  https://api.onpoint.famile.xyz
  ```
- **Tags:** youcam, perfectcorp, virtual-try-on, agentic-commerce, celo, x402

## Devpost submission copy (paste-ready)

See the "Draft Submission Text" section in
[docs/YOUCAM-HACKATHON.md](./YOUCAM-HACKATHON.md). Attachments required:

1. Repo URL: `https://github.com/thisyearnofear/onpoint` (public)
2. Screenshots: storefront, smoke-test render, agent 402→200 JSON,
   receipt page (4–6 images)
3. Video URL (YouTube)
4. Team info / exit-interview agreement checkbox
