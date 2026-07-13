# ADR 0013: Pricing Strategy & Agent Revenue Model

**Status**: Accepted  
**Date**: 2026-07-13

## Context

OnPoint is a multi-actor agent commerce platform. Every actor must have a
path to profitability for the ecosystem to be sustainable. This ADR
documents the pricing strategy, revenue distribution, and agent revenue
model that enables all participants to build viable businesses.

## Actors

| Actor | Role | Costs | Revenue |
|-------|------|-------|---------|
| Digital curator (Nia) | AI-generated fashion designs, try-on renders | Venice API (~$0.01-0.02/render), R2 storage | 80% of try-on fees |
| Human curator | Physical inventory, fulfillment, shipping | Inventory, shipping, returns, customer service | 95% of sale price + try-on fees on their catalog |
| External AI agent | Browses, tries-on, recommends, buys on behalf of human | Try-on fees, purchase costs, own compute | Markup on purchases (agent-set); future: platform fee share |
| Human (behind agent) | End consumer, pays for everything | Purchase price + agent fee | Better fits, fewer returns, discovery |
| OnPoint platform | Infrastructure, API, payments, discovery | Hosting, Venice API, R2, Neon, RPC | 5% physical / 20% digital / 15% NFT |

## Pricing

### Tier 1: Discovery (free)

| Action | Cost | Who pays |
|--------|------|----------|
| Browse directory | Free | — |
| Browse storefront | Free | — |
| View listing details | Free | — |

Free discovery is intentional. Agents need to explore before they spend.
The more agents browse, the more try-ons and purchases happen downstream.

### Tier 2: Digital try-on (micropayment)

| Curator type | Price | Split | Rationale |
|-------------|-------|-------|-----------|
| Digital (Nia) | $0.03 | 80% curator / 20% platform | Pure micropayment. No inventory. Venice render cost ~$0.01-0.02, curator nets ~$0.004-0.014 per try-on. |
| Human | $0.05 | 95% curator / 5% platform | Slightly higher — drives a real purchase. Curator earns from try-ons even if no sale. |

**Why $0.03 for digital?**

- $0.01 feels like it might be a mistake. $0.03 is a deliberate price.
- 333 try-ons for $10 (vs 40 at $0.25) — 8x more volume.
- Covers Venice API cost with 50-67% margin.
- For the hackathon's "Most x402 Payments" track (raw count), 8x more
  transactions from the same budget directly improves leaderboard ranking.
- Post-hackathon, can raise to $0.05-$0.10 once the category is proven.

**Per-curator override**: Curators can set their own try-on price via
`commerce.tryOnPriceUsd`. If unset, the global default applies.

### Tier 3: Physical order (transaction)

| Field | Value |
|-------|-------|
| Price | Listing price (curator sets in KES, converted to cUSD) |
| Platform fee | 5% |
| Curator share | 95% (via 0xSplits SplitV2, non-custodial) |
| Settlement | Buyer pays curator's Split directly; platform's 5% is in the Split |
| Attribution | Platform payout txs carry the ERC-8021 tag |

### Tier 4: NFT mint (premium)

| Field | Value |
|-------|-------|
| Price | $0.10 per mint |
| Royalty split | 85% creator / 15% platform (via 0xSplits) |
| NFT contract | `0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576` |
| Gas | Paid by agent wallet (~$0.001 on Celo) |
| Secondary royalty | 2.5% on resale (0xSplits royalty, future) |

The NFT mint is the "theatre" — it turns a transient try-on render into
a permanent, tradeable digital asset. Agents can offer their humans a
digital collectible of a fitting that resonated.

## Agent Revenue Model

Agents that drive transactions on OnPoint need a path to profitability.
Three models, in order of implementation priority:

### Model 1: Markup (available now)

Agents add a fee on top of the listing price. The agent pays the listing
price to the curator's Split, charges their human price + markup, and
keeps the markup. OnPoint does not participate in this — the agent
controls their own pricing to their human.

Example: Listing is $50. Agent charges human $52. Agent pays $50 to
curator Split, keeps $2. No additional on-chain tx needed.

### Model 2: Platform fee share (near-term)

OnPoint shares its platform fee with the referring agent. When an agent
drives a purchase, the platform's 5% is split: 2.5% to platform, 2.5% to
the referring agent. This is implemented by adding the agent's address as
a third recipient in the 0xSplits SplitV2.

Example: $50 order, platform fee = $2.50. Platform keeps $1.25, agent
earns $1.25. At 50 purchases/month, agent earns $62.50/month.

This requires tracking which agent drove each purchase (attribution via
the agent's wallet address or a referral code in the order metadata).

### Model 3: Try-on affiliate (future)

Agents earn a commission on try-ons that lead to purchases. If an agent
does a try-on and the same human subsequently purchases, the agent earns
10% of the try-on fee. This is tiny per transaction but adds up at
volume and incentivizes agents to do try-ons (which drive purchases).

Example: 1000 try-ons, 10% conversion = 100 purchases. Agent earns
100 x $0.003 = $0.30 from try-on affiliate + 100 x $1.25 = $125 from
platform fee share = $125.30/month.

## Distribution Flow

```
Human pays agent:  $52.00 (price + $2 markup)
Agent pays curator: $50.00 → 0xSplits SplitV2
  ├── Curator:      $47.50 (95%)
  ├── Platform:     $1.25  (2.5% — future: split with agent)
  └── Agent (future):$1.25 (2.5% — platform fee share)
Agent keeps:       $2.00  (markup)
```

## Why This Works For Each Actor

### Digital curator (Nia)
- 1000 try-ons/day at $0.03 = $30/day revenue
- 80% share = $24/day, minus ~$10-20 Venice costs = $4-14 net/day
- No inventory, no shipping, no returns — pure margin at scale

### Human curator
- Physical order: 95% of sale price, minus inventory/shipping costs
- Try-on fees on their catalog: additional revenue even without a sale
- Discovery from digital curators: Nia's similar-items funnel drives
  traffic to human curator storefronts (free customer acquisition)
- Self-custodial: funds go directly to their wallet via 0xSplits

### External AI agent
- Low try-on cost ($0.03) enables many experiments → better recommendations
- Fit signals reduce purchase uncertainty → happier humans → repeat usage
- Markup model: agent controls their own revenue
- Platform fee share (future): passive income from driven purchases
- NFT minting: agents can offer premium digital collectibles to humans

### Human (behind agent)
- Better fit recommendations (try-on before buy)
- Fewer returns (fit signal reduces wrong-size purchases)
- Discovery of new items and curators
- Digital collectibles (NFT mints of memorable fittings)

### OnPoint platform
- 5% on physical, 20% on digital, 15% on NFTs
- Volume-driven: low prices → more transactions → more fee revenue
- Attribution tags on platform txs → hackathon leaderboard credit
- Agent growth loop: more agents → more try-ons → more purchases → more
  curators activate wallets → more inventory → more agents

## Adoption Strategy

1. **First try-on free per agent** (Redis-tracked, 24h TTL) — reduces
   friction for new agents experimenting with a novel capability.
2. **Limited beta** — directory meta shows `betaSpotsRemaining` (cap at 25
   active storefronts) to create scarcity and urgency for curators.
3. **FOMO nudge** — curator dashboard shows active storefront count, beta
   spots, and missed-earnings messaging for curators without wallets.
4. **Self-serve activation** — curators add their wallet via WhatsApp-verified
   flow; storefront instantly appears in agent directory when wallet is set.
5. **Pricing transparency** — agent.json exposes all prices upfront so
   agents can budget and build business models before spending.

## Implementation

- `apps/api/lib/agent-commerce.js`: `tryOnPriceCusd()` reads
  `commerce.tryOnPriceUsd` per-curator, falls back to
  `X402_TRYON_PRICE_USD` env var (default: 0.03).
- `apps/web/public/.well-known/agent.json`: exposes pricing in the
  commerce section so agents can calculate their economics.
- Environment variable: `X402_TRYON_PRICE_USD=0.03` on the server.
- Per-curator override: set `commerce.tryOnPriceUsd` in the curator record.

## Consequences

- Try-on default drops from $0.25 to $0.03 (8.3x cheaper, 8.3x more volume).
- Digital curator (Nia) needs a wallet + split set up (via
  `scripts/setup-digital-curator-wallet.mjs`).
- Agent revenue model (markup) works today; platform fee share is a
  roadmap item requiring 0xSplits recipient changes.
- First-try-on-free requires Redis tracking (future enhancement).
- All prices are USD-pegged via cUSD/USDC, insulated from crypto volatility.
