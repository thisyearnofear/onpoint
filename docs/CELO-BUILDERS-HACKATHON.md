# Celo Builders — Agentic Payments and DeFAI Hackathon

> **OnPoint** submission to the [Agentic Payments and DeFAI Hackathon](https://celobuilders.xyz/hackathons/agentic-payments-defai) on Celo Builders.
> Competing in 4 tracks. Submission published 2026-07-28.

## Submission Summary

| Field | Value |
|-------|-------|
| **Status** | Published (`2026-07-28T00:23:59Z`) |
| **Project name** | OnPoint |
| **Tagline** | Autonomous AI fashion stylist with x402 try-on, on-chain checkout, and multi-chain payments (Celo + OKX/XLayer) |
| **GitHub** | https://github.com/thisyearnofear/onpoint |
| **Demo** | https://beonpoint.netlify.app |
| **API** | https://api.onpoint.famile.xyz |
| **MCP server** | https://mcp.onpoint.famile.xyz |
| **Celo network** | celo-mainnet (chainId 42220) |
| **Agent wallet** | `0x5b33E63440e95289207120B94da78CE22F9D24fB` |
| **NFT contract** | `0x8e0a3BcF07Ec8133408A3837DD2DCe398A42f576` (ERC-721A + 0xSplits) |
| **ERC-8004 ID** | 9177 → https://8004scan.io/agents/celo/9177 |
| **Attribution tag** | `celo_ce9e004195d5` (active on every Celo tx for leaderboard credit) |
| **X post** | https://x.com/papajimjams/status/2062121164428738882 |
| **Telegram** | @papajams |
| **Participant ID** | `2d077775-5f5d-498a-92f5-04e85d32b1ff` |
| **Submission ID** | `940d0bb5-18a4-467b-b0e9-ef9f709f9eee` |

## Tracks & Bounties

| Track | Bounty | Prize |
|-------|--------|-------|
| Most x402 Payments | most-x402-payments-1st | $700 in CELO (1st) / $300 (2nd) |
| Most Revenue Generated | most-revenue-generated-1st | $2,000 in CELO (1st) / $1,000 (2nd) |
| Askbots | askbots-prize-pool | $500 in CELO (highest agent rating via office hours) |
| Best Feedback for Aigora | track-4-prize | $500 in CELO (top 10 feedback submissions, $50 each) |

## Timeline

| Milestone | Date |
|-----------|------|
| Hackathon kickoff | 2026-07-01 |
| Track 4 announced | 2026-07-07 |
| **Submission deadline** | **2026-08-03 09:00 UTC** |
| Counting window closes | 2026-08-03 09:00 UTC |

## How OnPoint Wins

### Most x402 Payments (raw count)

Every try-on and order is an x402 payment. The attribution tag `celo_ce9e004195d5` is baked into every 402 response's `dataSuffix` — agents that append it get counted on the live Dune leaderboard.

**Payment paths (all count):**
- cUSD direct transfer to `payTo` (re-POST with `paymentTxHash`)
- USDC/USDT gasless via Celo facilitator (`api.x402.celo.org`, EIP-3009)
- USD₮0 on XLayer via OKX facade (separate chain — counts on OKX marketplace, not Celo leaderboard)

**Drive volume:**
- `node scripts/agent-tryon.mjs` — automated try-on loop
- `node scripts/agent-buyer.mjs` — automated purchase flow
- MCP server tools: `try_on`, `buy_item`
- OKX Agentic Wallet users hitting `/okx/try-on`

### Most Revenue Generated (on-chain volume)

Every physical order settles on Celo with the attribution tag. Try-on fees ($0.03–$0.05) and NFT mints ($0.10) also count. The Dune leaderboard tracks tagged volume in real time.

### Askbots (office hours judging)

Join the Agentic office hours sessions and get OnPoint judged live. Highest agent rating wins. Join the TG group for announcements.

### Aigora Feedback (Track 4)

**Not yet completed.** To compete in this track:
1. Register OnPoint on [aigora.org](https://aigora.org) to get a public profile
2. Submit feedback via the `aigora-feedback` skill (creates a GitHub issue in `trionlabs/aigora-skills`)
3. Add the Aigora profile URL + feedback issue URL to the Celo Builders submission

## Attribution Tag

The platform attribution code is `celo_aac2acfa60e8` and the assigned tag is `celo_ce9e004195d5`. These are embedded in every 402 response's `accepts[].dataSuffix` as an ERC-8021 array. Agents that append the dataSuffix to their payment transactions get counted on the hackathon leaderboard.

```javascript
// From any 402 response:
const dataSuffix = challenge.accepts[0].dataSuffix;
// Append to cUSD transfer tx data — carries both attribution codes
```

## Celo Builders API

The submission is managed via the Celo Builders API. The connection credential (API key) is stored privately and used for authenticated requests.

```bash
# View current submission
curl https://celobuilders.xyz/submissions/me \
  -H "Authorization: Bearer <CB_KEY>"

# Update submission (e.g. add Aigora URLs, video URL)
curl -X PUT https://celobuilders.xyz/submissions/me \
  -H "Authorization: Bearer <CB_KEY>" \
  -H "Content-Type: application/json" \
  -d '{ "videoUrl": "https://youtu.be/..." }'

# View builder profile
curl https://celobuilders.xyz/participants/me \
  -H "Authorization: Bearer <CB_KEY>"
```

## OKX.AI Marketplace (Cross-Chain)

OnPoint is also registered as an Agent Service Provider on OKX.AI (agent ID 9874, A2MCP type). The OKX facade settles payments in USD₮0 on XLayer — a separate audience of funded agents. While OKX payments don't count on the Celo Dune leaderboard (different chain), they expand the user base and demonstrate multi-chain x402 capability.

- **ASP ID:** 9874
- **Status:** Listing under review (AI quality review: suggested pass)
- **Services:** Browse Curator Directory (free), Virtual Try-On ($0.05 USD₮0)
- **See:** [ADR 0016](./adr/0016-okx-a2mcp-facade.md) and [AGENTS.md OKX section](../AGENTS.md#okxai-marketplace-a2mcp-facade)

## What's Left Before Aug 3

- [ ] Drive x402 transactions (try-ons + orders with attribution tag) — run the reference scripts or get third-party agents to call the API
- [ ] Aigora track (optional, $500): register on aigora.org + submit feedback + add URLs to submission
- [ ] Askbots track (optional, $500): join office hours sessions
- [ ] Add a demo video (optional, strengthens submission) — `videoUrl` field
- [ ] Monitor the Dune leaderboard for tagged volume
- [ ] Wait for OKX ASP approval (separate from Celo Builders)

## Reference Scripts

```bash
# Dry run (no payment, verifies the flow)
node scripts/agent-buyer.mjs --dry-run

# Real purchase (needs cUSD + CELO for gas)
BUYER_PRIVATE_KEY=0x... node scripts/agent-buyer.mjs

# Try-on
node scripts/agent-tryon.mjs

# Looks
node scripts/agent-looks.mjs browse --category=streetwear

# Supply readiness check
node scripts/agent-commerce-ready.mjs
```

## Links

| Resource | URL |
|----------|-----|
| Hackathon page | https://celobuilders.xyz/hackathons/agentic-payments-defai |
| OnPoint submission | https://celobuilders.xyz/submissions/me (auth required) |
| ERC-8004 profile | https://8004scan.io/agents/celo/9177 |
| OKX ASP listing | Agent ID 9874 on OKX.AI |
| Agent manifest | https://beonpoint.netlify.app/.well-known/agent.json |
| OpenAPI | https://beonpoint.netlify.app/openapi.json |
| AGENTS.md | [../AGENTS.md](../AGENTS.md) |
| OKX facade ADR | [./adr/0016-okx-a2mcp-facade.md](./adr/0016-okx-a2mcp-facade.md) |
| Qwen Cloud hackathon doc | [./QWEN-CLOUD-HACKATHON.md](./QWEN-CLOUD-HACKATHON.md) |
