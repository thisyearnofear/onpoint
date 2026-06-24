# ADR 0008 — TinyFish Async Streaming & Anti-Bot Hardening

- Status: Accepted
- Date: 2026-06-24
- Deciders: Agent Core, Agent Worker, Curator
- Related: ADR 0002 (Curator Primitive), ADR 0004 (Bright Data Web Intelligence), ADR 0005 (Agent Spending Controls)

## Context

The `packages/agent-web-bridge/tinyfish_client.py` integration currently calls the **blocking** `/v1/automation/run` endpoint, which returns only after the agent finishes. This has three concrete problems:

1. **`live_url` is always undefined.** The bridge stores the run's `live_url` in `TinyFishResult.live_url`, but TinyFish only returns this field on the **async** endpoint. Every downstream consumer that surfaces a "live preview" — `agent-controls.dispatchExternalAction`, `apps/api/routes/agent-tasks.js` line 627, `apps/web/components/Agent/AgentStatus.tsx` — is reading an always-null field today.
2. **No progression signal.** The 15-minute market-signal worker (`apps/api/worker.js`) and the `external_search` execute loop (`agent-tasks.js` line 568+) cannot tell the curator that the agent is currently scanning SSENSE; they only know about the run after it ends.
3. **No anti-bot configuration.** Per [TinyFish's official anti-bot guide](https://docs.tinyfish.ai/anti-bot-guide), the recommended posture for protected retailers (Farfetch, SSENSE, etc.) is `BrowserProfile.STEALTH` + `ProxyConfig(country=US)` + goal-string hardening. None of this is plumbed through today.

Separately, `profiles-demo-app` (pranavjana/profiles-demo-app) showcases four primitives worth adopting:

- `streamWebAgent` async generator with `starting → running → done` phases
- Browser Context Profiles (`use_profile: true`) for authenticated retailer runs
- Live browser preview via `streaming_url`
- OpenRouter model swap (deferred — see "Out of Scope")

We are not adopting wholesale. We adopt the two primitives the existing architecture already implies (`live_url`, `external_search`), defer the chat primitives (next-app `useChat`, OpenRouter), and stay inside the existing monorepo's separation of concerns.

## Decision

### D1. Rewrite `tinyfish_client.py` onto the async-polling primitive (Phases 1+1.5+2)

Single-file refactor. Public surface (`search_and_fetch`, `agent_browse`, `TinyFishResult`, `TinyFishProduct`) is preserved. Internals:

- Replace blocking `/v1/automation/run` with `/v1/automation/run-async` + poll `/v1/runs/{id}` every 1.5s, max 180s.
- Yield phases (`starting → running → done`) via a private async generator `_async_poll_loop()`.
- Populate `TinyFishResult.live_url` from the polled run's `streaming_url`.
- Add optional fields: `use_profile: bool = True`, `profile_id: Optional[str]`, `browser_profile: "LITE" | "STEALTH" = "LITE"`, `proxy_country: Optional[str]`, `max_wait_ms: int = 180_000`.

The `_extract_product` regex fallback is retained for `search_and_fetch` (Search/Fetch APIs return unstructured markdown) but **removed** from `agent_browse`'s success path — TinyFish's structured JSON result is now trusted as-is.

### D2. Single source of truth: the bridge is the canonical TinyFish surface

No TypeScript port of `tinyfish_client.py`. The Node-side `agent-controls.dispatchExternalAction` already calls the bridge over HTTP via `EXTERNAL_AGENT_URL`. Per **DRY**, the bridge owns the TinyFish contract. The Node side passes through.

### D3. Goal-string hardening is a single helper, not a per-call choice

`_build_goal_suffix()` appends a deterministic block to every agent goal:

```
1. Close any cookie consent or GDPR banner that appears before doing anything else.
2. Wait for the page to fully load before interacting.
3. If you see an 'Access Denied', CAPTCHA, or anti-bot challenge, return { "error": "blocked" }.
Return as JSON: { ... }
```

This matches the [anti-bot guide's](https://docs.tinyfish.ai/anti-bot-guide) Step 3 hardening. Single source of truth — no caller can opt out.

### D4. Worker decides per-query when to escalate (anti-bot posture)

`apps/api/worker.js` (the market-signal poller) is the single decision point. For each query it inspects the merchant domain (whitelist in `WHITELIST_DOMAINS`) and:

| Merchant class | Default `browser_profile` | Default `proxy_country` |
|---|---|---|
| Whitelisted open retailers (Zara, H&M, ASOS) | `LITE` | `None` |
| Protected retailers (Farfetch, SSENSE, Nordstrom, Net-a-Porter) | `STEALTH` | `US` |
| Unknown | `LITE` | `None` |

Worker can override per-cycle via config. The bridge stays dumb (it accepts what it's told). Per **CLEAN**, the bridge has no opinion on which merchants are protected.

### D5. Default-ON for async streaming (operational risk accepted)

Async streaming and stealth/proxy plumbing default to ON in `apps/api` and the bridge. Rationale: the alternative — a parallel blocking path — doubles the surface and risks divergence. Kill switch: `TINYFISH_ASYNC=0` reverts to the old blocking `/v1/automation/run` path within `agent_browse`. Documented in `HETZNER_CONFIG.md` after merge.

### D6. SSE conversion of `POST /api/agent/tasks/execute`

Convert the existing endpoint to Server-Sent Events when the client sends `Accept: text/event-stream`. JSON path retained for back-compat. Per-phase events:

```
event: starting
data: { "phase": "starting", "suggestionId": "...", "query": "..." }

event: running
data: { "phase": "running", "suggestionId": "...", "streamingUrl": "..." }

event: done
data: { "phase": "done", "suggestionId": "...", "items": [...] }

event: error
data: { "phase": "error", "suggestionId": "...", "error": "..." }
```

Same handler, two content-types. Per **MODULAR**, the bridge is the only place that knows about TinyFish phases; the Express route is a pass-through.

### D7. SSE also applies to `POST /v1/agent/search` in the bridge

`?stream=1` query param enables `text/event-stream` from FastAPI. The existing JSON path stays default. Same shape as D6.

### D8. AgentStatus consumes the SSE via `EventSource`

`apps/web/components/Agent/AgentStatus.tsx` replaces the current `fetch + setInterval` poll pattern with a single `EventSource` for the price-drop / market-signal panels. When the event carries `streamingUrl`, mount an iframe inline in the existing drop card. **No new component file** — extend the existing card per **ENHANCEMENT FIRST**. IntersectionObserver gates iframe mount for performance.

### D9. CapSolver and direct browser control: NOT adopted (deferred)

Per the TinyFish anti-bot guide: "TinyFish cannot solve CAPTCHAs (reCAPTCHA, hCaptcha, etc.)." CapSolver solves CAPTCHAs but only via Playwright/Puppeteer + extension integration. Adopting CapSolver means:

- A parallel Playwright/Puppeteer control plane
- A separate proxy manager
- A forked code path for "sites TinyFish can't reach"
- A new billing line and contract

Per **PREVENT BLOAT** we do not adopt preemptively. The escalation path is documented as a future ADR scope:

> If measured CAPTCHA-block rate exceeds 5% of retailer-scoped runs over a 30-day window, open ADR 0009: introduce a `PlaywrightAgentProvider` implementing the same `TinyFishClient` interface (returns `TinyFishResult`), with CapSolver integrated. The bridge keeps a single contract; the implementation swaps. Per **interface segregation**, no caller changes.

This keeps CapSolver as a measured, justified intervention rather than speculative infra.

## Consequences

### Positive

- `live_url` becomes real. The AgentStatus "Hot Deals" and "Agent Discoveries" cards can show the live browser preview when an agent run is active.
- Worker logs get a `running` phase, surfacing "currently scanning SSENSE" — the curator's audit log gets richer.
- Anti-bot posture is configured once, in one place, per merchant class.
- Browser Context Profiles unlock authenticated retailer runs — the missing link for ADR 0002's "live-web GTM intelligence".
- Existing public surface preserved — `agent_browse`, `search_and_fetch` signatures unchanged (only new optional fields).

### Negative

- Polling loop adds 1–3s latency to terminal events (1.5s poll interval + processing).
- `BrowserProfile.STEALTH` is materially slower than `LITE`. Net cycle time on protected retailers will increase. Budget impact: TBD, track via Sentry.
- Proxy adds a per-run cost line on protected merchants.
- SSE handlers are more complex than JSON; failure modes (partial stream, client disconnect) need care.

### Neutral

- One ADR (this) instead of three.
- No new package or dependency in the Python bridge. No `capsolver-sdk`, no `playwright`.

## Out of Scope

- **OpenRouter adoption**: deferred until measured model-swap friction appears. Current direct-provider stack (Gemini / Venice / OpenAI / Replicate) works.
- **Vercel AI SDK `useChat` pilot on LookCrafter**: deferred. Manual streaming in the web app is acceptable; no measured pain.
- **Per-user profile registry**: deferred. MVP uses a single `TINYFISH_DEFAULT_PROFILE_ID` env var. Per-user registry implies a data model (storage, rotation, audit) that needs its own ADR with a threat model.
- **Wholesale web app streaming migration**: deferred. The win is in the worker + bridge; the web app stays on fetch.

## File-level change set

| File | Nature |
|---|---|
| `packages/agent-web-bridge/tinyfish_client.py` | Rewrite internals; preserve public surface; add stealth/proxy/use_profile fields; add `_async_poll_loop`, `_build_goal_suffix` |
| `packages/agent-web-bridge/main.py` | Extend `SearchRequest`; add `?stream=1` SSE variant of `/v1/agent/search` |
| `packages/agent-web-bridge/test_tinyfish_streaming.py` | New: start, poll, terminal states; stealth/proxy body; use_profile body |
| `apps/api/routes/agent-tasks.js` | `/execute` SSE on `Accept: text/event-stream`; pass-through new fields; per-merchant escalation table |
| `apps/api/worker.js` | Apply per-merchant escalation table when posting to `/execute` and `/market-signals` |
| `apps/web/components/Agent/AgentStatus.tsx` | Replace fetch+setInterval with `EventSource`; inline iframe in drop card on `streamingUrl` |
| `docs/adr/0008-tinyfish-async-streaming.md` | This file |
| `docs/HETZNER_CONFIG.md` (or `HETZNER_CONFIG.md`) | Document `TINYFISH_ASYNC=0` kill switch + `TINYFISH_DEFAULT_PROFILE_ID` |

Net repository size change: ~+250 LoC tests, ~+80 LoC bridge refactor, ~+50 LoC agent-tasks, ~+40 LoC AgentStatus. Minus ~60 LoC deleted (blocking constants, brittle regex, polling state). Net: +360 LoC.

## Success Metrics (90-day window)

- `live_url` populated on ≥ 95% of `external_search` runs that hit the agent tier (currently 0%).
- Phase-2 (D8) `EventSource` reconnect rate < 1% per session.
- Anti-bot posture: measured CAPTCHA block rate on protected retailers < 10% with STEALTH+US proxy (the guide's implicit baseline).
- If CAPTCHA block rate > 10% sustained → open ADR 0009.

## Risk Register

| Risk | Mitigation |
|---|---|
| `BrowserProfile.STEALTH` adds latency | Adaptive default — LITE first; STEALTH on retry. Per-run budget honoured by `max_wait_ms`. |
| Proxy adds per-run cost | Proxy country opt-in via request field, default `None`. Worker decides per-merchant. |
| Polling exceeds 180s on deep retailer scans | Configurable `max_wait_ms`; terminal `error` event surfaces timeout reason. |
| SSE breaks existing JSON clients | `Accept` header gating. Both paths share the same handler. |
| Iframe rendering cost on low-end devices | `IntersectionObserver` mount; `loading="lazy"`; 320px height cap. |
| Stealth fingerprint drift over time | TinyFish maintains it; we re-test quarterly. |
| Default-ON exposes broken `live_url` before Phase 3 ships | Phase 1's `live_url` is functional immediately; AgentStatus iframe lands in the same PR. |
