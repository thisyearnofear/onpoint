# MUSE_SUBMISSION_PLAN.md — Photon Muse iMessage contest (EPHEMERAL)

> **Working brief, not a permanent doc.** Per `docs/README.md` rule 2, delete
> this file after the contest closes. The durable decision is
> [ADR 0022](./docs/adr/0022-runway-game-hosted-messaging.md); the contest is
> one audience for it, not its purpose.

## Context

Photon "Muse" contest (**deadline: Oct 23, 2026**): build a personal agent in
iMessage → post a demo + message history tagging **@PhotonHQ** → submit the
Typeform. $1k each: Most Time-Saving · Most Unhinged · Most Inspiring.

## What changed

The entry is now **Runway** (ADR 0022 Phase A), not the Prava checkout mission.
Reason: the Prava flow runs on fixture merchants in self-check mode and its
climax (passkey approval) cannot happen; Runway is a delightful, honest loop
over OnPoint's own inventory and is the first step of the growth experiment.

## Step 0 — eligibility (resolved 2026-10-24)

The Linq trial expired, and the line migrated to a **Photon Spectrum-managed
iMessage line** (project `onpoint`, `spectrum-ts` in `apps/api/spectrum-runway.js`).
The agent now runs on Photon's own SDK + managed line — native compliance, no
fallback framing needed.

**Caveat:** the line is a shared-pool number **+1 (628) 264-6604** that only
replies to phones allow-listed in the Photon dashboard (and it rejects email
senders). A viral CTA ("text her yourself") requires a dedicated number
(Business plan). Until then, the demo invite is "watch" not "text".

> **Paused:** submission deferred until the public-number decision.

## Build (ADR 0022 Phase A)

- Runway engine (`apps/api/lib/runway/`), vision chain (`apps/api/lib/vision.js`),
  Spectrum adapter (`apps/api/spectrum-runway.js`), result card, the fix,
  `imessage` attribution channel.
- **Blocker:** a working vision key. Local Venice key fails auth; DashScope is
  suspended (overdue balance). Owner to add `GEMINI_API_KEY` and/or
  `OPENROUTER_API_KEY` to `apps/api/.env` and the Hetzner env.
- Deploy via `.github/workflows/deploy-api.yml`; confirm `onpoint-spectrum`
  is `online` in PM2 and `/linq/health` reports at least one vision provider.

## Demo script (~45–60s)

1. Text "play" → persona intro + theme ("Brat summer", 3 minutes).
2. Cut: closet raid, sped up (this is the IRL moment — the Subway-Surfers-IRL energy).
3. Send the photo → persona verdict lands, result card pops in.
4. "The fix" → tap through to the look page.
5. "again" → new theme. End card: "Text your judge: +1 (628) 264-6604".

## Category positioning

- **Primary: Most Unhinged** — an AI fashion judge that sends you sprinting to
  your closet against a clock, in Edina/Miranda voice.
- **Secondary: Most Inspiring** — turns getting dressed into a game with friends.
- Don't pitch Time-Saving; that was the checkout framing.

## Risks

- Vision provider availability (see blocker). Fallback line keeps the game
  alive but a scoreless verdict makes a weak demo — dry-run before recording.
- Fix pool is small (1 curator, 8 live listings at time of writing).
- Crop/mask phone numbers in screenshots; use your own photo.

## Post-submission

Delete this file.
