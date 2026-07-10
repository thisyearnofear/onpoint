# Features

> **Vision:** [STRATEGY.md](./STRATEGY.md) — OnPoint is the fit-aware execution layer (human storefront + agent API over one supply graph).  
> **Organizing primitive:** every supply voice — human merchant, AI persona, or digital curator — is a `Curator` ([ADR 0002](./adr/0002-curator-primitive.md)). Features compose against one Curator on `/s/[slug]` (and its machine-readable twin), or across the Curator set for discovery.

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
2. **Try-on** — `POST /api/agent/try-on` (x402: $0.25 cUSD) or web try-on flow
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

### x402 Try-On Payments
- Agents pay $0.25 cUSD per try-on via HTTP 402 challenge flow
- Revenue routes to curator's 0xSplits (physical) or AI curator's split (digital)
- `agent.json` manifest at `/.well-known/agent.json` advertises capabilities

### Agent Storefront Checkout
- `POST /api/curator/:slug/order` — agents buy physical listings via cUSD
- 0xSplits payout routing to curator's wallet
- Digital listings return 409 (try-on only, no physical product)

### Agent Infrastructure
- **ERC-8004 registered** agent wallet on Celo
- **Agent dashboard** at `GET /api/agent/dashboard` — public transparency endpoint
- **Heartbeat** at `POST /api/agent/heartbeat` — gas monitoring, fraud checks, receipt logging
- **Dead Man's Switch** — freezes agent after 15 min of silence
- **Verifiable receipts** — every autonomous action signed, stored on IPFS, optional Celo memo tx

---

## Live AR Stylist

Real-time AI styling sessions — like a FaceTime call with a fashion consultant.

### Provider Matrix
| Provider | Tier | Speed | Engine |
|----------|------|-------|--------|
| Venice AI | Free | ~3s polling | Qwen VL (qwen3-vl-235b) |
| Replicate | Free | ~2.5s polling | GPT-4o-mini |
| Azure CV | Free | ~3s polling | Azure CV 4.0 (detect+tag) |
| Gemini Live | Premium | Real-time WS | Gemini 2.0 Flash |

Smart fallback: Venice → Replicate → Azure → Gemini with dedup prevention.

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

- IDM-VTON model via Replicate API
- Upload garment + human images for AI-powered fitting
- Body-inclusive visualizations with caching
- **Digital→physical funnel**: TryOnResult renders "Shop the real thing" section with similar physical items when try-on is from a digital listing

---

## Social & Sharing

- Farcaster mini-app integration with direct casting
- Agentic tipping in cUSD (Celo Mainnet + Alfajores)
- "Proof of Style" snapshots shared to feed
- Referral links with base62-encoded tracking codes

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

| Feature | Web | Status |
|---------|-----|--------|
| Curator Storefronts | ✅ | Complete |
| Digital Curators | ✅ | Complete |
| Agent Commerce (x402) | ✅ | Complete |
| Live AR Stylist | ✅ | Complete |
| Virtual Try-On | ✅ | Complete |
| Smart Recommendations | ✅ | Complete |
| Agent Web Discovery | ✅ | Complete |
| Autonomous Execution | ✅ | Complete |
| Spending Controls | ✅ | Complete |
| Self Protocol ID | ✅ | Complete |
| Agent Heartbeat | ✅ | Complete |
| Style Memory | ✅ | Complete |
| NFT Minting | ✅ | Complete |
| Social Sharing | ✅ | Complete |
| Agentic Tipping | ✅ | Complete |
| Referral Links | ✅ | Complete |
| Score Progression | ✅ | Complete |
| Style Recap Email | ✅ | Complete |
| GoodDollar G$ Integration | ✅ | Complete |
| Auth0 Token Vault | ⏸️ | Paused |
