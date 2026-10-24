# ADR 0022: Runway — A Game-Hosted Messaging Surface over OnPoint Inventory

**Status**: Accepted — Phase A (Solo Runway on iMessage) in implementation
**Date**: 2026-10-23
**Related**: ADR 0017 (Prava agent checkout — the current Linq flow), ADR 0019 (share attribution), ADR 0002 (curator primitive / messaging bridge)
**Evidence**: [research/messaging-game-formats.md](../research/messaging-game-formats.md)

> **Update (2026-10-24) — channel migration to Photon Spectrum.** The Linq
> trial expired (every API call returned `401`, and no inbound webhooks
> reached prod — the line was silently unresponsive). Runway's iMessage
> line now runs on a **Photon Spectrum** managed number, **+1 628 264 6604**
> (`RUNWAY_LINE_NUMBER`, shared pool — replies only to numbers added under
> Project → Users until a dedicated number is provisioned).
> `apps/api/spectrum-runway.js` runs as a dedicated PM2 process
> (`onpoint-spectrum`) and consumes `app.messages` — no webhook. The engine
> is unchanged apart from an `imageDataUrl` input; `heic-convert` decodes
> iPhone HEIC photos before the sharp pipeline, and messages are serialised
> per chat while chats run in parallel. `routes/linq-agent.js` and
> `lib/linq-client.js` remain dormant as the fallback path if the Linq
> account is renewed. References to Linq below describe the original
> deployment; the semantics carry over to the Spectrum adapter.

## Context

OnPoint runs a live iMessage line through Linq (ADR 0017). Today every inbound message starts a Prava checkout mission over **external US Shopify merchants**, which run on deterministic fixtures in self-check mode. That surface:

- does not touch OnPoint's own supply graph (curators, looks, try-on, share attribution), so any growth it drives builds someone else's network (STRATEGY §10, Q1 and Q6);
- shows a payment ceremony that cannot complete in its current mode;
- gives a consumer no reason to come back or to bring a friend.

Meanwhile, the research note identifies a proven consumer format whose missing pieces — a theme, a clock, a judge, a scoreboard — are exactly what an AI host in a message thread can supply: **Dress to Impress IRL**. And the iMessage card that mutates in place, plus Linq's group chats and native polls, are interaction primitives that web and app competitors cannot match.

## Decision

### 1. Runway becomes the default experience on the messaging line

A user texts the line; the agent hosts a themed closet challenge:

1. **Theme + clock.** The agent replies (text only — Linq's first outbound may not contain links or media) with a persona intro, a random theme, and a 3-minute soft deadline: "raid your closet, send one full-length photo."
2. **Submit.** The user sends a photo. A vision model judges it against the theme.
3. **Verdict.** The persona delivers a short verdict and a score; a typographic **result card** (iMessage app part) shows theme, score breakdown and the persona's line. The card does **not** contain the user's photo — it is a spoiler-free artifact in the Wordle tradition, safe to screenshot and share.
4. **The fix.** One live OnPoint listing or look that would have scored higher, linked with a minted share id and `utm_source=imessage` — the commerce bridge into the existing share-attribution funnel (ADR 0019).
5. **Again.** "again" deals a new theme; "judge edina" switches persona.

Routing: the existing Prava mission remains reachable through the web handoff (`TRACK op_…`) and an explicit `shop <intent>` prefix. All other text starts or continues Runway.

### 2. Phases

| Phase | Scope | Gate to proceed |
| --- | --- | --- |
| **A — Solo Runway** | 1:1 rounds, vision judge, result card, the fix, attribution, cost caps | Phase A metrics below |
| **B — Group Runway** | Agent in a group chat (Spectrum iMessage supports groups); each player submits; iMessage **poll** content type for the peer vote; ranked runway card mutates in place as votes land | Spectrum group/poll behaviour verified on a real group |
| **C — Retention** | Daily theme (user-initiated, never random push), streaks, Fit Imposter mode, "Style Wrapped" from history | Phase B engagement |
| **D — WhatsApp** | Same engine on WhatsApp Business via Spectrum (`packages/messaging-bridge`) for the Kenyan curator market | Engine is channel-agnostic (see §4) |

### 3. Vision provider chain (redundancy)

Judging needs a vision-language model. Verified on 2026-10-23: the local Venice key fails authentication and the DashScope account is suspended for an overdue balance. Production Venice auth was re-verified the same day (`/api/v1/models` → 200), and production runs `VISION_PROVIDERS=openrouter,venice` — two live providers. One provider is not acceptable; two independent billing relationships is the current bar, and the `modal` slot exists for a self-hosted GPU endpoint when usage justifies it.

`apps/api/lib/vision.js` exposes one function over an ordered chain of OpenAI-compatible providers, each enabled only when its key is present (`modal` is the exception — enabled by `MODAL_BASE_URL` alone; its key is optional):

| Provider | Key env | Default model env |
| --- | --- | --- |
| Venice | `VENICE_API_KEY` | `VISION_VENICE_MODEL` = `qwen3-vl-235b-a22b` |
| Google Gemini (OpenAI-compatible endpoint) | `GEMINI_API_KEY` | `VISION_GEMINI_MODEL` |
| OpenRouter | `OPENROUTER_API_KEY` | `VISION_OPENROUTER_MODEL` |
| Modal (self-hosted, e.g. vLLM) | `MODAL_BASE_URL` (+ optional `MODAL_API_KEY`) | `VISION_MODAL_MODEL` |
| DashScope (Qwen) | `DASHSCOPE_API_KEY` | `VISION_DASHSCOPE_MODEL` |
| OpenAI | `OPENAI_API_KEY` | `VISION_OPENAI_MODEL` |

Order is overridable with `VISION_PROVIDERS` (comma-separated — note an explicit list must name `modal` for it to activate). Each attempt has a timeout; a provider error, timeout, or unparseable JSON falls through to the next. If every provider fails, Runway answers with a deterministic persona line and no score — the game never dead-ends. Which providers are configured (never their keys) is reported on `/linq/health`.

The chain is shared beyond Runway: `completeVision({ expectJson: false })` serves the free-text live-session analyze routes. `ai-venice-analyze` and `ai-analyze-person` delegate fully; `ai-zerog-analyze` and `ai-qwen-analyze` keep their provider-specific primaries (0G TEE attestation, Qwen spend guards) and fall back to the chain on any failure — including missing keys, kill switch, or budget exhaustion.

Notes from first live verification (2026-10-23): reasoning models (e.g. OpenRouter's `nvidia/nemotron-3.5-super-vl:free`) burn the whole token budget on chain-of-thought unless sent `reasoning: {effort: 'low'}` (OpenRouter-only param) and a generous `VISION_MAX_TOKENS` (default 3000) with `VISION_TIMEOUT_MS` ≈ 90s. Free tiers are rate-limited and may log prompts — acceptable for demos; prefer a paid provider before launch. Dolphin (dphn.ai) is OpenAI-compatible but ships only text models today (`text-v` endpoint), so it is not a vision provider.

### 4. Channel-agnostic engine

Game state, theme selection, judging, scoring, card composition and the fix live in `apps/api/lib/runway/` with no channel imports. Two adapters exist: `apps/api/spectrum-runway.js` (live — streams `app.messages`, calls the engine, renders intents as Spectrum text/attachment/rich-link sends) and `routes/linq-agent.js` (dormant fallback — parses webhooks, renders the same intents as Linq messages). A WhatsApp adapter (Phase D) reuses the engine unchanged.

### 4a. Web surface (one product across channels)

The same engine is playable in the browser so Runway is not iPhone-only, and so a shared result converts viewers into players:

- `/runway` — landing: today's theme (`themeOfDay`, deterministic per UTC day), judges, how a round works, and a device-adaptive CTA (iOS → "Text the judge" via `sms:` with `play <theme-id>` prefilled; elsewhere → play in the browser, with a QR to the line on desktop).
- `/runway/play` — the full round in the browser: judge intro, theme reveal with a 3-minute countdown ring, photo picked and downscaled on the device, judging, then animated score paddles, verdict, the fix, and "Challenge a friend". The player's photo appears as a polaroid from local memory only; it is sent once for judging and never stored.
- `/runway/r/:roundId` — the share page every chat card and web share points to; its og:image is the API-rendered score card; its CTA starts the same theme ("Can you beat 7.0 on Villain Era?").
- Entry points: "Runway" first in site navigation, a teaser band on the homepage, and a "{Judge}'s fix for {Theme}" banner on look pages reached from a fix link.
- API: `/api/runway` (`GET /today`, `POST /rounds`, `POST /rounds/:id/photo`, `GET /results/:id`). Web players are anonymous (`web:{uuid}` from local storage). Only the photo route carries the AI rate limits; the read routes are cacheable so share-page traffic, which reaches the API from the web server, is not throttled.

Visual system: a dark "backstage" stage within the existing OnPoint tokens; the recurring motif is three judges' score paddles (Theme / Cohesion / Styling), used identically on the web, the share card, and the iMessage card.

### 5. Guardrails

- **Judge the outfit, never the body.** The judging prompt scores theme fit, cohesion and styling only; it forbids comments on body shape, weight, skin, age or attractiveness. Roast personas roast choices, not people.
- **Refusals.** No person/outfit visible, apparent minor, or nudity → a polite refusal and no score.
- **Photo retention.** The submitted photo is fetched, downscaled in memory, sent to the vision provider, and discarded. It is not written to R2, Redis or logs. The result card contains no photo.
- **Cost.** Per-chat round cap per day and a global daily vision-call cap (`RUNWAY_DAILY_VISION_CAP`); over the cap, the deterministic fallback answers.
- **Line health.** Rounds are user-initiated (inbound-first). The game naturally produces inbound replies (photos, "again"), which supports the recommended ~1:2 inbound:outbound ratio on whichever provider carries the line. No scheduled "time's up" sends — the deadline is soft and applied when the photo arrives. On the Spectrum shared pool the line only accepts messages from allow-listed phone numbers (email senders and strangers are rejected by Photon before reaching the worker); a dedicated number removes that constraint.
- **Opt-out** handling and chat-health gating from ADR 0017 apply unchanged.

### 6. Measurement

Funnel events (existing `funnel_events` table, `source: 'runway'`): `runway_start`, `runway_submit`, `runway_verdict` (metadata: theme, persona, provider, score, late), `runway_fix` (metadata: shareId, lookSlug or listingId). The fix link's `sid` flows into the ADR 0019 funnel; `imessage` is added to the closed channel set.

Phase A targets and stop rule live in [STRATEGY.md](../STRATEGY.md#runway-experiment-messaging-surface).

## Consequences

- The messaging line starts building OnPoint's own distribution and outcome data instead of exercising an external merchant fixture.
- "The fix" is constrained by supply: at the time of writing the directory lists one curator with eight live listings. Runway will surface the supply-density gap quickly — that is a feature of the experiment, not a reason to delay it.
- Phase B depends on Spectrum group-chat and poll behaviour that is documented but not yet exercised by this codebase.
- The Prava flow is preserved but no longer the default; its compliance copy is unchanged.
- iMessage reaches an iPhone-heavy, mostly US audience; it is measured as an attention channel (rounds, shares, fix visits), not by physical orders. WhatsApp (Phase D) is the commerce path for the current curator market.
- Apple's policy for agents in Messages is tightening (first third-party approval was granted in October 2026); line reputation must be monitored, and `phone_number.status_updated` should alert, not just log.
