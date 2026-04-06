# Features

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

## AI Stylist Personalities

Asynchronous text-based critiques from 6 distinct personalities:

| Persona          | Style                                           |
| ---------------- | ----------------------------------------------- |
| Anna Karenina    | Russian aristocratic, 19th-century high society |
| Artful Dodger    | Street-smart youth, urban style, sneakerhead    |
| Mowgli           | Natural coexistence, ecological balance         |
| Edina Monsoon    | Avant-garde fashion victim                      |
| Miranda Priestly | Impossibly high runway standards                |
| John Shaft       | 1970s cool sophistication                       |

**Capabilities**: Upload photos, context-aware conversations, style suggestions, cross-component integration.

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

### 3-Tier Discovery Engine

| Tier | Source                | Speed    | Coverage     |
| ---- | --------------------- | -------- | ------------ |
| 1    | Internal catalog      | Instant  | Curated      |
| 2    | Purch API aggregation | Fast     | 1B+ products |
| 3    | Browser Use Cloud     | Variable | Open web     |

### Live Monitoring

- `live_url` surfaced in UI for real-time observation
- Progress updates via AgentSuggestionToast
- Marketplace whitelist: FARFETCH, SSENSE, Zara, ASOS

### Autonomy

- $5 micro-action threshold auto-approves web discovery tasks (~$0.10/action)
- Isolated Python microservice for browser automation

---

## Spending Controls & Transparency

### Autonomy Threshold

- **Under $5**: Auto-execute without interrupting the user
- **Over $5**: Creates approval request → user accepts/rejects via toast

### Suggestion Toast System

- 10-second countdown with auto-dismiss
- Auto-approve badge for sub-threshold actions
- Smart gating: 30s cooldown, item-type dedup, 15s session warmup
- `useAgentSuggestions` hook: polls API, manages current suggestion state

### Verifiable Agent Logs

- Every agent decision cryptographically signed (Tether WDK wallet)
- Signed receipts stored on IPFS/Filecoin via Lighthouse
- "View on IPFS" links in the UI for full auditability
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
- **Wallet mapping**: Link Auth0 identity to on-chain wallet addresses
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

## Feature Matrix

| Feature               | Web | Chrome Ext | Mini App | Status   |
| --------------------- | --- | ---------- | -------- | -------- |
| AI Stylist (Text)     | ✅  | ✅         | ✅       | Complete |
| Live AR Stylist       | ✅  | -          | -        | Complete |
| Virtual Try-On        | ✅  | ✅         | -        | Complete |
| Smart Recommendations | ✅  | ✅         | ✅       | Complete |
| Agent Web Discovery   | ✅  | -          | -        | Complete |
| Spending Controls     | ✅  | ✅         | ✅       | Complete |
| Style Memory          | ✅  | ✅         | ✅       | Complete |
| NFT Minting           | ✅  | -          | ✅       | Complete |
| Social Sharing        | ✅  | ✅         | ✅       | Complete |
| Agentic Tipping       | ✅  | -          | -        | Complete |
