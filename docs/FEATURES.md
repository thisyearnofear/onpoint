# Features

> **Organizing primitive**: every styling voice in OnPoint — human merchant or AI persona — is a `Curator` (see [ADR 0002](./adr/0002-curator-primitive.md)). Features below are composed against one Curator at a time on `/s/[slug]`, or against the full Curator set on the consumer dashboard.

## Curator Storefronts (`/s/[slug]`) — Phase 11

A branded surface a Curator hands to their customers. Composes existing components (`VirtualTryOn`, `PolaroidGallery`, `SessionEndingCard`, `collage`) against one Curator's catalog and brand kit. No new feature surface — pure recomposition.
Implemented in `apps/web/app/s/[slug]/page.tsx`, backed by `apps/api/routes/curator-storefront.js`.

### What a Curator gets
- `/s/{slug}` route with their logo, colors, voice, and catalog
- Customer try-on scoped to their inventory
- Branded polaroid frame + share templates (IG story, polaroid, fit-check card)
- Optional "second opinion" from AI Curators (Miranda, Edina, Tan…) — context-aware takes based on the host Curator's verticals
- Off-ramp checkout to their existing Shopify / WhatsApp / Stripe — the first pass uses WhatsApp deep links from live listings
- Self-serve onboarding at `/curator/onboard` — 30-second form that creates a Neon row + storefront URL
- Cross-curator recommendations — AI finds complementary items from other Curators' catalogs

### Two Curator types, one schema
| Type | Source | Example | Catalog |
|------|--------|---------|---------|
| `human` | `apps/web/config/curators/*.json` + Neon | Mo (football), Amara (Ankara), Juma (vintage), Kofi (sneakers), Nneka (hair) | Their inventory |
| `ai`    | `lib/utils/persona-config.ts` (re-emitted as `Curator`) | Miranda Priestly, Edina Monsoon, Tan France | Union of host Curator's catalog |

### Coexistence
On `/s/mo` (a human Curator's storefront), AI Curators appear as optional voices: same try-on, three takes on the result. On AI Curator surfaces, human Curators' catalogs are the recommendation pool. The agent layer (autonomous executor, ERC-8004 receipts, Token Vault) becomes the attribution + AI-purchase infrastructure for cross-Curator transactions.

---

## Live AR Stylist

Real-time AI styling sessions — like a FaceTime call with a fashion consultant.

### Free Tier (Venice AI)

- Vision analysis via `mistral-31-24b` model
- Adaptive polling: 2s (high motion) → 5s (low motion)
- No payment required — uses OnPoint's API key
- Rate limit: 60 requests/minute

### Premium Tier (Gemini Live)

- Real-time bidirectional WebSocket streaming
- Full audio input/output — talk and be interrupted naturally
- Instant video frame analysis (1fps canvas capture)
- Tactical HUD with Agent Reasoning Terminal
- **Cost**: 0.5 CELO per session OR Bring Your Own Key (BYOK)

### Session Features

- **Timer + limits** — Configurable session duration
- **Ending card** — Shareable summary with style score and topic badges
- **Coaching badges** — Real-time AI observations overlaid on camera
- **Snapshot capture** — One-tap frame with AR HUD + critique embedded

---

## AI Curators (Stylist Personas)

The six personas below are **AI Curators** under the unified schema. They are loaded from `lib/utils/persona-config.ts` and re-emitted as `Curator` objects with `type: "ai"`, so they can be slotted into any human Curator's storefront as a "second opinion" voice.

| Persona          | Style                                           | Default verticals |
| ---------------- | ----------------------------------------------- | ----------------- |
| Anna Karenina    | Russian aristocratic, 19th-century high society | formal, occasion  |
| Artful Dodger    | Street-smart youth, urban style, sneakerhead    | streetwear, sneakers |
| Mowgli           | Natural coexistence, ecological balance         | sustainable, outdoor |
| Edina Monsoon    | Avant-garde fashion victim                      | high-fashion, experimental |
| Miranda Priestly | Impossibly high runway standards                | runway, luxury |
| John Shaft       | 1970s cool sophistication                       | retro, tailoring |

**Capabilities**: Upload photos, context-aware conversations, style suggestions, cross-component integration. When mounted inside `/s/[slug]`, an AI Curator's recommendations are scoped to the host Curator's catalog (the union model — see [ADR 0002](./adr/0002-curator-primitive.md#open-questions)).

---

## Smart Shopping

### Product Catalog

- 24+ products across 6 categories with real fashion photography
- Categories: Shirts, Pants, Shoes, Accessories, Outerwear, Dresses
- Engagement metrics: try-on count, mint count, average rating

### Personalized Recommendations

Products scored by:

- **Category fit** (+10 points for matching user preferences)
- **Price range** (+5 points for fitting budget)
- **Rating bonus** (higher-rated items score better)
- **Variety noise** (prevents filter bubbles)

### Cart & Checkout

- Zustand store with localStorage persistence
- Commission splits: 85% seller / 10% platform / 3% affiliate / 2% agent
- Unallocated shares roll to platform (no value loss)
- On-chain cUSD/USDT payments with transaction verification

---

## Agent Web Discovery

When the internal catalog doesn't have a match, the agent browses the open web:

### 4-Tier Discovery Engine

| Tier | Source                                 | Speed    | Coverage       |
| ---- | -------------------------------------- | -------- | -------------- |
| 1    | Internal catalog                       | Instant  | Curated        |
| 2    | Purch API aggregation                  | Fast     | 1B+ products   |
| 2.5  | TinyFish + Bright Data SERP (parallel) | Fast     | Structured web |
| 3    | Browser Use Cloud                      | Variable | Open web       |

**Bright Data integration** ([ADR 0004](./adr/0004-brightdata-web-intelligence.md)): Structured Google Shopping search via SERP API + product page extraction via Web Unlocker. Runs in parallel with TinyFish at Tier 2.5 — first non-empty result wins. Gated by `BRIGHTDATA_API_KEY` env var; silent skip if unset.

### Retail GTM Intelligence

The same web-discovery event also creates Curator-facing intelligence. A shopper still gets a recommendation; the Curator gets evidence about what the market is offering and what their own catalog is missing.

Initial signal types:

- **Product gap** — User intent the Curator catalog could not satisfy
- **Competitor price** — Live price range for comparable products across retailers
- **Retailer availability** — Where matching items are currently discoverable
- **Trend match** — Repeated shopper intent that maps to a style, occasion, or category
- **Recommended action** — A merchandising or campaign suggestion backed by live web evidence

This keeps OnPoint consumer-first while giving stylists, boutiques, and retail GTM teams a commercial feedback loop from every styling session.

Partner enrichment is layered onto the same normalized market signal response:

- **AI/ML API** — Generates a merchant-ready brief from live products, signals, and memory when `AIML_API_KEY` is set. If unset, the UI shows a deterministic `ready` brief.
- **Cognee** — Prepares or sends retail signal memory for repeated intent, known gaps, remembered retailers, and last-seen timestamps. If unset, the UI shows `Cognee Memory` as `ready`.
- **TriggerWare** — Prepares a `retail.product_gap.detected` workflow for product gaps and recommended actions, then verifies the configured TriggerWare trigger registry through `https://api.triggerware.com` when `TRIGGERWARE_API_KEY` is set. If unset, the UI shows `TriggerWare Workflow` as `ready` or `skipped`.

These integrations live in `apps/web/lib/services/retail-signal-partners.ts` and are optional, so missing partner keys do not block Bright Data search or the Intel page.

### Live Monitoring

- `live_url` surfaced in UI for real-time observation
- Progress updates via AgentSuggestionToast
- Marketplace whitelist: FARFETCH, SSENSE, Zara, ASOS

### Autonomy

- $5 micro-action threshold auto-approves web discovery tasks (~$0.10/action)
- Isolated Python microservice for browser automation
- **Autonomous execution**: Below-threshold suggestions execute onchain immediately without user interaction

---

## Spending Controls & Transparency

### Autonomy Threshold

- **Under $5 cUSD**: Auto-execute onchain via `autonomous-executor.ts` without interrupting the user
- **Over $5 cUSD**: Creates approval request → user accepts/rejects via toast → onchain execution on accept
- Configurable per `agentId:userId` via `AgentControls.setAutonomyThreshold()`

### Autonomous Execution Engine

- `executeSuggestion()` resolves agent wallet, signs transaction, broadcasts to Celo mainnet
- Supports `mint`, `purchase`, `tip` actions with full onchain receipts
- Records spending via `AgentControls.recordSpending()`
- Falls back gracefully if `AGENT_PRIVATE_KEY` is not configured

### Suggestion Toast System

- 10-second countdown with auto-dismiss
- Auto-approve badge for sub-threshold actions
- Smart gating: 30s cooldown, item-type dedup, 15s session warmup
- `useAgentSuggestions` hook: polls API, manages current suggestion state
- Displays execution result (txHash, explorer link) after onchain broadcast

### Verifiable Agent Logs

- Every autonomous action cryptographically signed by the agent's self-custodial wallet
- Signed receipts stored on **IPFS/Filecoin** via Lighthouse with CID in UI
- **Onchain receipts**: Optional Celo memo transaction encodes receipt JSON for tamper-proof audit trail
- **Public dashboard**: `GET /api/agent/dashboard` exposes all receipts for judges
- Follows ERC-8004 "Agents with Receipts" pattern

---

## Style Memory

- **90-day persistence** of user preferences in Redis
- Tracks categories, price ranges, interaction patterns
- `getRecommendedItems` scores products against stored preferences
- In-memory fallback when Redis is unavailable
- Write-through cache: synchronous reads, fire-and-forget writes

---

## Social & Sharing

### Farcaster Integration

- Runs as a Farcaster mini-app
- Direct casting via `sdk.actions.composeCast`
- "Proof of Style" snapshots shared to feed

### Agentic Tipping

- Tip the AI stylist in cUSD directly from sessions
- Supports Celo Mainnet and Alfajores
- Automatic network switching
- Agent responds with personalized thank you

### Memory Protocol

- Cross-platform identity (Farcaster, Twitter)
- Social activity tracking: try-ons, mints, reactions
- $MEM token rewards for engagement

---

## Virtual Try-On

- IDM-VTON model via Replicate API
- Upload garment + human images for AI-powered fitting
- Body-inclusive visualizations
- Performance optimizations with caching
- Animated UI with Framer Motion

---

## Auth0 Token Vault for AI Agents

### Secure Credential Delegation

- **Agent-mediated API calls**: AI agent never directly handles third-party OAuth tokens
- **Scoped access**: Granular permissions (`shopping:read`, `shopping:write`, `shopping:purchase`)
- **Token isolation**: Credentials stored in Auth0 Token Vault, never exposed to AI model
- **User control dashboard**: View/revoke retailer connections in real-time

### Auth0 Integration

- **Identity provider**: Centralized auth via Auth0 for agentic commerce features
- **Signed wallet mapping**: Link Auth0 identity to on-chain wallet addresses only after the wallet signs a SIWE message with a one-time nonce
- **Just-in-time consent**: Users authorize specific retailers when needed
- **Hackathon**: [Authorized to Act](https://authorizedtoact.devpost.com/) — $10,000 prize pool

### Components

- **CardEnhanced** — Product cards with like/share, trending badges, ratings, quick preview
- **ShopGrid** — Responsive grid with sorting (trending/rating/price), category filtering
- **EngagementBadge** — Social proof (Trending/Viral/Popular/New) with animated counters

### Animations

- 9 GPU-accelerated keyframes (scale-pulse, shimmer, bounce-in-up, float, glow, card-tilt, swipe-in-left, gradient-shift, count-up)
- View Transitions API for smooth list → detail morphing
- Respects `prefers-reduced-motion` for accessibility

**Expected impact**: +40-80% engagement lift, +50-80% share volume

---

## Self Protocol Identity

- **Self Agent ID**: `onpoint-agent-35962` registered via `lib/services/self-protocol.ts`
- **ERC-8004 Agent ID**: `35962` on Base registry
- **Unified identity endpoint**: `GET /api/agent/identity` returns both registrations + compliance flags
- Mock registration fallback for demo environments (no Self API key required)

## Agent Heartbeat & Self-Management

- **Heartbeat endpoint**: `POST /api/agent/heartbeat` — agent monitors its own gas, fraud status, and proactive tasks
- **Dead Man's Switch**: Records heartbeat every 5 min; freezes agent after 15 min of silence
- **Gas monitoring**: Alerts when CELO balance drops below 0.5 (warn) or 0.01 (critical)
- **Self-management dashboard**: `GET /api/agent/dashboard` — public transparency for judges

## Phase 3 Architecture: All Agent Routes on Hetzner

All 16 ported agent routes run directly on Hetzner Express, backed by `@repo/agent-core`:
- **Auth**: `SERVICE_API_KEY` on stateful endpoints; public GET for dashboard/identity/catalog
- **User context**: Forwarded from Vercel via `x-forwarded-user` header, validated by service key
- **Deploy**: `scripts/deploy-api.sh` builds workspace deps, bundles `@repo/db` + `@repo/storage`, and deploys via isolated `npm install --omit=dev`

## Feature Matrix

| Feature                  | Web | Chrome Ext | Mini App | Status   |
| ------------------------ | --- | ---------- | -------- | -------- |
| AI Stylist (Text)        | ✅  | ✅         | ✅       | Complete |
| Live AR Stylist          | ✅  | -          | -        | Complete |
| Virtual Try-On           | ✅  | ✅         | -        | Complete |
| Smart Recommendations    | ✅  | ✅         | ✅       | Complete |
| Agent Web Discovery      | ✅  | -          | -        | Complete |
| **Autonomous Execution** | ✅  | -          | -        | Complete |
| **Self Protocol ID**     | ✅  | -          | -        | Complete |
| **Agent Heartbeat**      | ✅  | -          | -        | Complete |
| Spending Controls        | ✅  | ✅         | ✅       | Complete |
| Style Memory             | ✅  | ✅         | ✅       | Complete |
| NFT Minting              | ✅  | -          | ✅       | Complete |
| Social Sharing           | ✅  | ✅         | ✅       | Complete |
| Agentic Tipping          | ✅  | -          | -        | Complete |
