# ADR 0004 — Bright Data Retail Intelligence Integration

- **Status:** Proposed — 2026-05-29
- **Date:** 2026-05-29
- **Deciders:** OnPoint core
- **Supersedes:** —
- **Related:** [ADR 0001](./0001-backend-first-autonomy.md), [ADR 0002](./0002-curator-primitive.md), [ADR 0003](./0003-storage-strategy.md), [ROADMAP.md](../ROADMAP.md)

## Context

OnPoint's agent web-bridge (`packages/agent-web-bridge`) currently searches for fashion products across three tiers:

| Tier | Provider | Cost/request | Reliability |
|------|----------|-------------|-------------|
| 2 | Purch API | ~$0.01-0.10 | High (1B+ product index) |
| 2.5 | TinyFish Search+Fetch | Variable | Medium (web extraction) |
| 3 | Browser Use Cloud / TinyFish Agent | ~$0.10-0.50 | Medium (full browser, fragile) |

Several problems with the current stack:

1. **Bot detection fragility** — Browser Use Cloud and TinyFish Agent are full-browser approaches that break on CAPTCHAs, geo-blocks, and JS-rendered pages. Fashion retailers (FARFETCH, SSENSE, Zara) actively deploy anti-bot measures.
2. **No structured search** — Neither TinyFish nor Browser Use provide structured SERP data. They scrape raw pages and extract heuristically, which is slow and lossy.
3. **Cost unpredictability** — Browser Use charges per session (~$0.10-0.50), making costs hard to forecast at scale.
4. **Single-provider risk** — If Purch API is down, the fallback is fragile browser automation.

[Bright Data](https://brightdata.com/) offers production-grade web data infrastructure specifically designed to solve these problems: SERP API (structured search results), Web Scraper API (660+ pre-built site scrapers including Amazon), Web Unlocker (CAPTCHA/bot bypass), and Scraping Browser (managed headless browser). Per-request costs are comparable or lower than current providers (~$0.001-0.01).

The same search event has a second commercial use. When a shopper asks for an item that the Curator catalog cannot satisfy, the live web response is also evidence for retail GTM: product gaps, competitor price ranges, availability, trend fit, and recommended merchandising or campaign actions.

## Decision

Integrate Bright Data as a **Tier 2.5 provider** in the existing agent-web-bridge tier chain, sitting alongside (not replacing) TinyFish. Both are tried in parallel at Tier 2.5; whichever returns results first wins. This preserves the existing fallback chain while adding a more reliable web data source.

Bright Data results will support two outputs from one fetch:

1. **Shopper output** — product recommendations in the existing `ItemData` shape.
2. **Curator output** — retail intelligence signals derived from the same live web evidence.

### What we build

1. **`brightdata_client.py`** — Async client module following the same pattern as `tinyfish_client.py`. Wraps Bright Data SERP API for structured search and Web Scraper API for product page extraction. Returns the same `BrightDataResult` shape used by the rest of the bridge.

2. **Tier chain integration** — Wire into `main.py` at Tier 2.5 alongside TinyFish. Both are attempted; first successful result wins. If both fail, fall through to Tier 3 (Browser Use / TinyFish Agent) as today.

3. **Market signal mapping** — Derive a small, shared `MarketSignal` shape from Bright Data results: product gaps, competitor prices, retailer availability, trend matches, and recommended actions.

4. **Backward-compatible product-catalog path** — Existing product recommendation behavior remains valid. Signal-aware code paths are additive and optional so current UI surfaces do not break.

### What we do NOT build

- No standalone GTM app or separate analytics service
- No changes to the Curator schema or storefront
- No hard dependency on Bright Data at the TypeScript/frontend layer
- No removal of existing providers (TinyFish, Browser Use, Purch)

### Operating principles

1. **Bright Data is an optional provider.** Gated by `BRIGHTDATA_API_KEY` in `.env`. If unset, the tier chain skips it silently — identical to how TinyFish and Browser Use are gated today.
2. **Same recommendation interface, optional signal extension.** `BrightDataResult` maps to `ItemData` exactly like `TinyFishResult` does. Signal-aware callers can also consume `MarketSignal[]`.
3. **First-result-wins at Tier 2.5.** Both TinyFish and Bright Data are launched with `asyncio.gather`; the first non-empty result is used. This reduces latency vs. sequential fallback.
4. **No new Bright Data dependency in the TypeScript layer.** Bright Data lives entirely in the Python bridge. The Next.js app consumes normalized products and signals.

### Alignment with Core Principles

| Principle | How this applies |
|-----------|-----------------|
| **ENHANCEMENT FIRST** | Enhances existing search and Curator surfaces before adding new ones |
| **AGGRESSIVE CONSOLIDATION** | If Bright Data proves reliable, it can eventually replace TinyFish (reducing from 3 external providers to 2) |
| **PREVENT BLOAT** | Reuses the same live web event for recommendations and intelligence |
| **DRY** | Uses one shared signal shape instead of per-UI intelligence models |
| **CLEAN** | Web access stays in the bridge; product and signal consumers stay normalized |
| **MODULAR** | Bright Data client and signal derivation can be tested independently |
| **PERFORMANT** | SERP API returns structured data without browser startup; repeated queries can be cached |
| **ORGANIZED** | Lives in `packages/agent-web-bridge/` alongside existing clients |

### Cost analysis

| Provider | Per-request cost | Notes |
|----------|-----------------|-------|
| Purch API | ~$0.01-0.10 | Unchanged |
| TinyFish | Variable | Unchanged |
| Bright Data SERP API | ~$0.001-0.01 | Structured search results |
| Bright Data Web Scraper | ~$0.001-0.01 | Per-page extraction |
| Browser Use Cloud | ~$0.10-0.50 | Only if both Tier 2.5 providers fail |

Bright Data is **cheaper per-request** than Browser Use and comparable to Purch API. The hackathon provides $250 in credits. Long-term, Bright Data's pricing is usage-based with no minimum commitment — easy to drop if costs don't justify the value.

### Risk: dependency lock-in

**Low risk.** Bright Data is behind an env-var gate (`BRIGHTDATA_API_KEY`). If the key is unset or the service is down, the tier chain falls through to TinyFish, then Browser Use, then raises 503. No code paths depend on Bright Data being available. Removing it later means deleting one file and one import — a 5-minute operation.

## Consequences

### Positive
- More reliable product search (structured SERP + site-specific scrapers vs. heuristic page extraction)
- Turns shopper intent into Curator-facing retail GTM intelligence without a second product surface
- Lower per-request cost than Browser Use Cloud
- Redundancy: 4 providers in the chain instead of 3
- Hackathon eligibility: satisfies Bright Data integration requirement for Web Data UNLOCKED

### Negative
- One more client module to maintain (mitigated: follows existing pattern, ~150 lines)
- One shared signal model to keep stable across Python and TypeScript boundaries
- API key management: one more secret in `.env` (mitigated: same pattern as all other keys)

### Neutral
- No required changes to the Curator schema or storefront
- Existing providers remain; Bright Data is additive, not replacing

## Implementation

### Files to create
- `packages/agent-web-bridge/brightdata_client.py` — Async client wrapping SERP API + Web Scraper API
- Shared market-signal type in the existing shared-types package

### Files to modify
- `packages/agent-web-bridge/main.py` — Import `BrightDataClient`, add to Tier 2.5 with `asyncio.gather` alongside TinyFish
- `apps/web/lib/services/product-catalog.ts` — Preserve existing product search while adding an optional signal-aware path
- `packages/agent-web-bridge/requirements.txt` — No new deps needed (uses `httpx`, already present)
- `packages/agent-web-bridge/.env.example` — Add `BRIGHTDATA_API_KEY`

### Files to update (docs)
- `docs/ROADMAP.md` — Add Phase 12: Bright Data Web Intelligence
- `docs/FEATURES.md` — Add Bright Data to Agent Web Discovery section

### Testing
- Unit tests in `packages/agent-web-bridge/test_brightdata_client.py` following `test_purch_client.py` pattern
- Signal derivation tests for product gaps, competitor prices, and bounded confidence
- Integration test: hit `/v1/agent/search` with `BRIGHTDATA_API_KEY` set, verify structured results
- Fallback test: verify graceful degradation when Bright Data is unavailable
