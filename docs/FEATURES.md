# Features

> **Strategy:** [STRATEGY.md](./STRATEGY.md) — OnPoint is the fashion wedge for a larger thesis: agent-ready execution infrastructure for fit-sensitive physical goods.
> **Feature boundary:** this file describes the implemented fashion proof point; it does not imply that the broader platform is already proven.
> **Status boundary:** “Complete” below means implemented in the product/codebase; it does not necessarily mean currently deployed, externally live-validated, or repeatedly proven at scale.
> **Organizing primitive:** every supply voice — human merchant, AI persona, or digital curator — is a `Curator` ([ADR 0002](./adr/0002-curator-primitive.md)). Features compose against one Curator on `/s/[slug]` (and its machine-readable twin), or across the Curator set for discovery.

> **Current focus:** the consumer web engine, led by Runway ([ADR 0023](./adr/0023-consumer-engine-first-curators-deferred.md)). Curator, agent-commerce and payment features below are implemented but **deferred**: no new onboarding or feature work until the Phase 0 gate in [STRATEGY.md](./STRATEGY.md#phase-0--consumer-engine-and-retention-current).

## Consumer loop

One loop: pick a look, get a verdict, then play again or try it on you. Selection never starts a task; only "Get a verdict" does. Primary nav is Looks (`/`), Runway (`/runway`), and Fitting room (`/lab?tab=try-on`). The header repeats "Get a verdict" because it is the same action, not a fourth destination. Developer, agent, and supply links stay under More. `/style-board` is the full look catalog, not a second homepage. The sections below the stage do not restate the nav or repeat the rack.

## Wardrobe studio (consumer homepage)

The homepage (`/`, `#style-studio`) is the first step of that loop: a wardrobe stage for choosing a look, not a marketing hero and not a directory of the product. Decision and provenance: [ADR 0024](./adr/0024-consumer-wardrobe-studio-and-interaction-reuse.md). Status: `deployed` — production checked on onpoint.trustfall.xyz per the [ops deployment checklist](./ops/deployment.md#release-validation-checklist-wardrobe-studio-release) (prepared demos only; not live-validated against paid providers).

- **Gallery** — tabs All / Clothes / Outfit ideas / Saved (`aria-pressed`), text search over titles+tags, occasion filters (Everyday / Work / Going out / Layers; hidden in Clothes, garments unaffected), 12-at-a-time paging with Load more. Items: 3 prepared garment pairs (`/assets/{1,2,3}Product.png` + matching `Model.png`) plus all 34 AI outfit references from `/demo/outfits/`, ordered garments → six curated featured looks → remainder.
- **Clothes rack** — the three garments hang as real product photos on a CSS rail (rotateY swivel, neighbor separation on hover/focus, `aria-label` "Dress model in Graphic 0x", arrow/Home/End keyboard nav). Inspired by [DiMaac's clothes rack](https://ui.dimaac.com/components/clothes-rack); implemented with our own CSS and photos — no Three.js/WebGL, no cloth simulation, no vendored component code.
- **Inspector** — selected garment shows the matching prepared model plus a floating garment cutout and an On model / Piece toggle (labelled "Prepared on-model demo · not your photo"). Selected outfit shows its actual flat-lay labelled "Outfit reference · not items for sale". No autocycling, no fabricated scores.
- **Selection model** — shared across rack/gallery/stage; explicit selection only, undo pops history (and restores browse filters/paging so the prior card is visible), duplicate selection adds no history. Pin then pick a different piece → inline two-pane compare with honest per-item mode labels.
- **On-device favorites and notes** — saved *outfits* live in the shared `style-board-hearts` store (the same "My picks" as `/style-board`); saved *garments* and notes live in `localStorage` key `onpoint-wardrobe-studio-v1`, JSON `{version:1, savedIds, notes}`. Outfit ids previously saved under the studio key are migrated into the shared store on first load. Notes are private, ≤240 chars, per item, never leave the device; version/unknown-ID/malformed data rejected on read. No account sync and no server-persisted wardrobe.
- **Next actions** — "Get a verdict" deep-links `/runway/play?sample=<id>` (garments resolve via the `studio-graphic-0{1,2,3}` sample ids that render the matching model; outfits use their existing ids); "Use my photo" opens `/lab?tab=try-on`. Judging is a Runway round; personal try-on is a separate generation — neither runs on rack/gallery clicks.
- **Honesty boundary** — references are inspiration, not live inventory or purchasable items; garment/model pairs are prepared demos, not the user's photo. Style-board titles/labels stay in parity between web and API mirrors. The studio server-renders visible (no hydration-gated hero), and try-on opens without old onboarding overlays.
- **Provenance** — gallery/inspector patterns adapted from the MIT-licensed [tandpfun/wardrobe](https://github.com/tandpfun/wardrobe) and [Om-Alve/wardrobe](https://github.com/Om-Alve/wardrobe) dashboards; license kept at `apps/web/components/wardrobe/wardrobe.LICENSE` (not shown in the studio UI). Code license does not cover their sample imagery — only our existing local assets are used.

Known limits (explicitly not claimed): menswear/asset parity, personal-photo garment extraction, free-form AI restyling, trips/planner from the upstream dashboard, and multi-slot real-garment compositing are not implemented.

## Runway (consumer daily challenge)

A themed closet challenge judged by AI personas (Miranda, Edina, Shaft). Decision and guardrails: [ADR 0022](./adr/0022-runway-game-hosted-messaging.md). Phasing: [ADR 0023](./adr/0023-consumer-engine-first-curators-deferred.md).

- `/runway`: landing with today's theme and the judges
- `/runway/play`: pick a judge (or "Surprise me") → theme + 3-minute countdown → photo or sample (samples sit under the photo CTAs; samples can never be marked late) → judging (ambient heartbeat) → animated score paddles → typed verdict + reactions from the other two judges → "the fix" → Challenge a friend
- `/runway/r/:roundId`: share page; its og:image is the API-rendered score card (1200×630, no user photo). "Take the challenge" deep-links `/runway/play?judge=&theme=&ref=` into a duel.
- API: `GET /api/runway/today`, `POST /api/runway/rounds`, `POST /api/runway/rounds/:id/photo`, `GET /api/runway/results/:id`. Engine in `apps/api/lib/runway/`.
- Duels: a `?ref=<roundId>` round loads the shared result as the opponent — "DUEL — beat X.X" badge, You-vs-Them card with their verdict quote, "Run it back" rematch on a loss/tie, duel-aware share text. Ref attribution is recorded on `runway_start`.
- Sound & reveal: WebAudio synth cues (paddle flips, count-up chime, win arpeggio, low-tier roast) + ambient tension heartbeat, all behind a persisted mute toggle. Canvas confetti burst — gold palette for 8+ "Judges' favourite", accent for a duel win or new personal best.
- iMessage: the same engine on the Photon Spectrum line (secondary channel)
- Photo is judged and discarded, never stored. Daily caps: per-player rounds and `RUNWAY_DAILY_VISION_CAP`.
- Metrics: [ops/retention.md](./ops/retention.md). Events carry a hashed player id; shares are recorded via `POST /api/runway/rounds/:id/share`; `GET /api/runway/metrics` (service key) computes the retention definitions.
- No-photo path: person samples plus 34 styled outfit flat-lays (curated from the MIT nvzhuang dataset — references, not inventory) under `/demo/outfits/`; deep link `?sample=<id>`. `/style-board` is the full gallery (`?pick=<id>` highlights the fix's pick) with an on-device "My picks" hearts rail.
- On-device memory (no photos stored): streak, best score, round history, sound preference, hearted outfits. Share cards render 9:16 story, 4:5 feed and 1200×630 landscape.
- "The fix" order: tag-matched live look → tag-matched live listing → theme-matched style-board outfit (`kind: 'inspiration'`) → most recent live look.

Status: `deployed`. Known gaps (Phase 0 backlog): no cross-device history (memory is per-device), `CameraCapture` component is still unused (the flow uses a camera-first file input), banter lines are canned rather than AI-generated, no duel-completion event yet (ref attribution is start-side only), and the outfit style board skews feminine/J-fashion with no menswear coverage.

## Curator Storefronts (`/s/[slug]`)

A branded surface a Curator hands to their customers. Composes existing components (`VirtualTryOn`, `PolaroidGallery`, `SessionEndingCard`) against one Curator's catalog and brand kit.

### What a Curator gets
- `/s/{slug}` route with their logo, colors, voice, and catalog
- Customer try-on scoped to their inventory
- Branded polaroid frame + share templates
- Optional "second opinion" from AI Curators (Miranda, Edina, Tan…) — context-aware takes based on the host Curator's verticals
- Off-ramp checkout to their existing Shopify / WhatsApp / Stripe / M-Pesa
- Self-serve onboarding at `/curator/onboard`
- Cross-curator recommendations with attribution tracking
- Machine-readable listing `attributes` (`type`, `formality`, `warmth`, `fabric`, `pattern`, `fit`, `colors`) extracted at ingest (rule-based, optional Qwen vision); filterable via `?type=&formality=&warmth=` on the storefront API. Status: `implemented`

### Three Curator types, one schema
| Type | Source | Example | Catalog |
|------|--------|---------|---------|
| `human` | `apps/web/config/curators/*.json` + Neon | Mo (football), Amara (Ankara), Wanja (Premier League) | Their physical inventory |
| `ai` | `lib/utils/persona-config.ts` | Miranda Priestly, Edina Monsoon, Tan France | Union of host Curator's catalog |
| `digital` | Neon `curators` table (`type: "ai"`) | Nia Digital (AI-generated garments) | Digital-only designs, try-on only |

---

## Digital Curators & Digital→Physical Funnel (ADR 0011)

AI curators with their own storefronts and AI-generated digital garments. Agents and consumers try on digital designs, then get matched to similar physical items from human curators.

### How it works
1. **Digital curator storefront** (`/s/nia`) — 8 AI-generated garment designs rendered with violet "Digital" badge, tags, and try-on CTA (no sizes/stock/checkout)
2. **Try-on** — `POST /api/agent/try-on` (x402: $0.03 digital / $0.05 physical cUSD) or web try-on flow
3. **Similar physical items** — API returns `similarPhysicalItems` matched by tags (e.g. `["football", "arsenal", "home"]`)
4. **Public endpoint** — `GET /api/listings/:id/similar` joins `kit_skus` for title/image
5. **"Shop the real thing"** — TryOnResult renders cards linking to human curator storefronts
6. **Conversion** — Agent or consumer follows link → orders physical item from human curator

### Digital listing schema
- `inventoryType: "digital"` — no `skuId`, no sizes, no stock
- `title` and `tags` columns for matching
- `photoKeys` contain full URLs (served from static directory, see ADR 0003 addendum)
- Orders return 409 with redirect to try-on endpoint

---

## Agent Commerce (ADR 0010, 0011)

This is the core execution proof point: a fashion offer connects structured catalog data, fit evidence, payment, payout, attribution, and a receipt. See [`docs/STRATEGY.md`](./STRATEGY.md) for the distinction between capability and strategic proof.

> Third-party agent how-to: [guides/agent-commerce.md](./guides/agent-commerce.md)

### x402 Try-On Payments
- Agents pay $0.03 cUSD for digital try-ons or $0.05 cUSD for physical try-ons via the HTTP 402 challenge flow
- Revenue routes to curator's 0xSplits (physical) or AI curator's split (digital)
- `agent.json` manifest at `/.well-known/agent.json` advertises capabilities

### Agent Storefront Checkout
- `POST /api/curator/:slug/order` — agents buy physical listings via cUSD
- 0xSplits payout routing to curator's wallet
- Digital listings return 409 (try-on only, no physical product)
- Alternative rails on the same 402 challenge (advertised in `quote.paymentRails` only when configured):
  - **NEAR** — `{nearAccountId, nearTxHash}`; curator's `commerce.nearAccountId` paid directly (payment tx = payout tx). See [NEAR_HACKATHON.md](./NEAR_HACKATHON.md). Status: `implemented`
  - **PayPal** (approval-relay, USD) — `quote.paypal.approveUrl` → human approves → re-POST `{paypalOrderId}`; server verifies + captures via Orders v2, capture id is the replay-guarded proof, curator payout `pending_reconciliation`. See [PAYPAL_HACKATHON.md](./PAYPAL_HACKATHON.md). Status: `implemented`, not live-validated

### Agent Outfit Planner
- `POST /api/agent/outfit` (free) — deterministic planner composes live agent-purchasable listings into looks scored against a brief (occasion, season, weather, budget, preferred listing); returns `looks[].items` with per-item `orderEndpoint`, `totalCusd`, `score`, `why`, plus `nextSteps` (try-on/createLook/order). Manifest capability: `outfit_planning`. Status: `implemented`

### Execution controls and verifiability
- **ERC-8004 registered** agent wallet on Celo
- **Agent dashboard** at `GET /api/agent/dashboard` — public transparency endpoint
- **Heartbeat** at `POST /api/agent/heartbeat` — gas monitoring, fraud checks, receipt logging
- **Dead Man's Switch** — freezes agent after 15 min of silence
- **Verifiable receipts** — every autonomous action signed, stored on IPFS, optional Celo memo tx

---

## AI Styling and Live Sessions

AI-assisted styling and real-time sessions are supporting capabilities around the execution rail—not the company positioning. They help produce fit evidence and confidence before a purchase.

### Provider Matrix
| Provider | Tier | Speed | Engine |
|----------|------|-------|--------|
| Venice AI | Free | ~3s polling | Qwen VL (qwen3-vl-235b) |
| Replicate | Free | ~2.5s polling | GPT-4o-mini |
| Azure CV | Free | ~3s polling | Azure CV 4.0 (detect+tag) |
| Gemini Live | Premium | Real-time WS | Gemini 2.0 Flash |

Smart fallback: Venice → Replicate → Azure → Gemini with dedup prevention.

The analyze routes also sit on the shared vision chain (`apps/api/lib/vision.js`, ADR 0022 §3): `ai-venice-analyze` and `ai-analyze-person` delegate to the configured provider order (`VISION_PROVIDERS`); `ai-zerog-analyze` and `ai-qwen-analyze` keep their distinctive primaries (0G TEE attestation, Qwen Cloud spend guards) and fall back to the chain on failure. A `modal` provider slot accepts a self-hosted OpenAI-compatible endpoint via `MODAL_BASE_URL`.

### Under evaluation (not integrated)

Runware `/v1/systemone` decision models — `typesafe:jev@latest` + `runware:laya@1` — for size Choice + fit Score. No code path uses these yet; evaluate against the existing fit-signal output before wiring into the try-on response.

---

## AI Curators (Stylist Personas)

Six AI personas loaded from `lib/utils/persona-config.ts`, re-emitted as `Curator` objects with `type: "ai"`. When mounted inside `/s/[slug]`, recommendations are scoped to the host Curator's catalog.

| Persona | Style | Default verticals |
|---------|-------|-------------------|
| Anna Karenina | Russian aristocratic | formal, occasion |
| Artful Dodger | Street-smart urban | streetwear, sneakers |
| Mowgli | Natural coexistence | sustainable, outdoor |
| Edina Monsoon | Avant-garde | high-fashion, experimental |
| Miranda Priestly | Runway standards | runway, luxury |
| John Shaft | 1970s cool | retro, tailoring |

---

## Smart Shopping

- 24+ products across 6 categories with real fashion photography
- Personalized recommendations scored by category fit, price range, rating, and variety noise
- Zustand cart store with localStorage persistence
- Commission splits: 85% seller / 10% platform / 3% affiliate / 2% agent
- On-chain cUSD/USDT payments with transaction verification

---

## Agent Web Discovery

When the internal catalog doesn't have a match, the agent browses the open web:

| Tier | Source | Speed | Coverage |
|------|--------|-------|----------|
| 1 | Internal catalog | Instant | Curated |
| 2 | Purch API aggregation | Fast | 1B+ products |
| 2.5 | TinyFish + Bright Data SERP (parallel) | Fast | Structured web |
| 3 | Browser Use Cloud | Variable | Open web |

Bright Data integration (ADR 0004): SERP API + Web Unlocker, gated by `BRIGHTDATA_API_KEY`. Also generates Curator-facing retail intelligence (product gaps, competitor prices, availability signals).

---

## Spending Controls & Transparency

- **Autonomy threshold**: Under $5 cUSD auto-executes; over $5 requires user approval
- Daily/weekly spend caps, per-purchase approval thresholds
- Allowed actions: browse, reserve, tip, buy, mint
- Audit trail of autonomous actions with signed receipts
- See [ADR 0005](./adr/0005-agent-spending-controls.md)

---

## Virtual Try-On

- Image-conditioned fitting (upload person + garment images) with a provider fallback chain:
  - **Paid tier (agents):** YouCam Apparel VTO → Replicate IDM-VTON → Gemini image edit (`GEMINI_TRYON_MODEL`, default `gemini-2.5-flash-image`; runs only when `GEMINI_API_KEY` is set) → Venice SD35
  - **Free tier (web):** Venice SD35 first — text-to-image "similar look", **not garment-conditioned** (current limitation: the free render is not the actual garment on the actual person; that is the paid tier's job)
- Body-inclusive visualizations with caching
- **Digital→physical funnel**: TryOnResult renders "Shop the real thing" section with similar physical items when try-on is from a digital listing
- Optional **garment cutouts** (`GARMENT_CUTOUT_ENABLED` + OpenAI image key): post-ingest AI product shot stored in R2 as `attributes.cutoutKey`; try-on/outfit inputs prefer the cutout, storefront exposes `cutoutUrl`. Status: `implemented`, off by default

---

## Social & Sharing

- Farcaster mini-app integration with direct casting
- Agentic tipping in cUSD (Celo Mainnet + Alfajores)
- "Proof of Style" snapshots shared to feed
- Referral links with base62-encoded tracking codes
- **Look share attribution** (ADR 0019): each look share carries a share id (`?sid=`) so shares can be followed to visits, storefront steps, try-ons, and confirmed M-Pesa sales, with a K-factor that stays `insufficient_data` until there are 30+ shares. Status: `implemented`; API side `deployed`; no conversion or K-factor claim until measured. Definitions and limits: [ops/growth-loop.md](./ops/growth-loop.md); agent contract: [AGENTS.md](../AGENTS.md#share-attribution)
- `SocialActivity` type retained in `shared-types` for future social proof on storefronts
- Demand-side discovery components (`LooksFaceoff`, `CommunityPanel`) quarantined per [ADR 0014](./adr/0014-demand-side-discovery-components.md) — retained for Phase 2 rewiring to Curator/polaroid schema
- **Note:** These quarantined components are separate from the live **Agent Looks** feature (see Feature Matrix), which is a complete, shipped system for composing listings into shareable style boards

---

## Style Memory

- 90-day persistence of user preferences in Redis
- Tracks categories, price ranges, interaction patterns
- In-memory fallback when Redis unavailable

---

## GoodDollar G$ Integration (ADR 0009)

Three live G$ integrations on Celo mainnet:

- **G$ UBI Claim** (`GClaimCTA`) — daily UBI claim in onboarding, add-funds, and agent status
- **G$ Streaming Subscriptions** (`GStreamPanel`) — Superfluid G$ streams to curators
- **G$ Tip Jar** — post-session tips in G$ via token picker in TipModal
- **G$ Balance Pill** — persistent balance indicator in AgentStatus

Package: `@repo/gooddollar` — single source of truth for contract addresses, ABIs, and helpers.

---

## Self Protocol Identity

- **Self Agent ID**: `onpoint-agent-9177` registered via `lib/services/self-protocol.ts`
- **ERC-8004 Agent ID**: `9177` on Celo registry
- **Unified identity endpoint**: `GET /api/agent/identity`

---

## Feature Matrix

| Feature | Web | Implementation status (not proof of current scale) |
|---------|-----|--------|
| Runway | ✅ | Deployed (Phase 0 focus) |
| Curator Storefronts | ✅ | Implemented |
| Digital Curators | ✅ | Implemented |
| Agent Commerce (x402) | ✅ | Implemented |
| AI styling / live sessions | ✅ | Implemented; provider availability and production validation vary |
| Virtual Try-On | ✅ | Implemented |
| Smart Recommendations | ✅ | Implemented |
| Agent Web Discovery | ✅ | Implemented |
| Autonomous Execution | ✅ | Implemented |
| Spending Controls | ✅ | Implemented |
| Self Protocol ID | ✅ | Implemented |
| Agent Heartbeat | ✅ | Implemented |
| Style Memory | ✅ | Implemented |
| NFT Minting | ✅ | Implemented |
| Social Sharing | ✅ | Implemented |
| Agentic Tipping | ✅ | Implemented |
| Referral Links | ✅ | Implemented |
| Score Progression | ✅ | Implemented |
| Style Recap Email | ✅ | Implemented |
| GoodDollar G$ Integration | ✅ | Implemented |
| Agent Looks | ✅ | Implemented |
| Auth0 Token Vault | ⏸️ | Paused |
