# OWS Spend Governance - OnPoint Agent Wallet

## Overview

OnPoint implements **Track 2: Agent Spend Governance** for the OWS Hackathon. The agent wallet has policy-enforced spending limits that adjust dynamically based on reputation.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     OWS Wallet                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Policy    │  │ Reputation  │  │   Dead      │  │
│  │   Engine   │──│   System    │  │   Man's     │  │
│  │            │  │             │  │   Switch    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         │                │                │              │
│         └────────────────┼────────────────┘              │
│                          │                               │
│                    ┌─────┴─────┐                        │
│                    │  Spend   │                        │
│                    │  Limits  │                        │
│                    └──────────┘                        │
└─────────────────────────────────────────────────────────┘
```

## Spend Tiers

| Tier            | Daily Limit | Requirements                           |
| --------------- | ----------- | -------------------------------------- |
| **New**         | $5/day      | Just created                           |
| **Established** | $500/day    | 10+ txns, $100+ volume, 90%+ success   |
| **Premium**     | $5,000/day  | 10+ txns, $1,000+ volume, 90%+ success |

## Reputation Score

The reputation score is calculated from:

```
score =
  log10(volume) × 20 +
  log10(transactions) × 15 +
  successRate × 30 +
  age(days) × 1
```

Max score: ~100 points

## Components

### 1. Policy Engine (`spend-policy.ts`)

Enforces spending limits before any transaction:

```typescript
const { allowed, tx } = await enforceSpendPolicy(
  "0xAgentWallet",
  50.0, // amount in USDC
);

if (!allowed) {
  throw new Error(tx.error); // "SPEND_LIMIT_EXCEEDED"
}
```

### 2. Reputation System (`agent-reputation.ts`)

Tracks agent metrics and calculates tiers:

```typescript
// Record a transaction
await agentReputation.recordTransaction(
  "0xAgentWallet",
  25.0, // amount
  true, // success
);

// Get current spend limit
const limit = await agentReputation.getSpendLimit("0xAgentWallet");
console.log(`Limit: $${limit}/day`);

// Get leaderboard
const top = await agentReputation.getLeaderboard();
```

### 3. Dead Man's Switch (Conceptual)

If the agent doesn't check in within N minutes:

1. Revoke API key
2. Sweep remaining funds to recovery wallet
3. Notify via webhook

## API Endpoints

### Agent Wallet API

- `POST /api/agent/wallet` - Get agent wallet address
- `POST /api/agent/checkout` - Process purchase with policy enforcement
- `POST /api/agent/mint` - Mint NFT with policy enforcement

### Reputation API

- `GET /api/reputation?wallet=0x...` - Get agent reputation
- `GET /api/reputation/leaderboard` - Top agents by score
- `POST /api/reputation/record` - Record a transaction

### Governance API

- `GET /api/governance/policy?agent=...` - Get agent policy
- `POST /api/governance/multisig` - Configure multi-sig

## Integration

### Checking Spend Policy

```typescript
import { enforceSpendPolicy } from "@onpoint/spend-policy";

async function makePurchase(amountUSDC: number) {
  const { allowed, tx } = await enforceSpendPolicy(
    agentWalletAddress,
    amountUSDC,
  );

  if (!allowed) {
    console.log("Policy blocked:", tx.error);
    return;
  }

  // Proceed with transaction...
}
```

### Reacting to Reputable Agents

```typescript
const limit = await agentReputation.getSpendLimit(agentAddress);

// Auto-adjust UI based on tier
if (limit >= 500) {
  show("Premium features unlocked!");
}
```

## Environment Variables

Required for production:

```
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx
```

## Demo

Test the spend limits:

```bash
# Get reputation
curl "localhost:3000/api/reputation?wallet=0x123"

# Record transaction
curl -X POST "localhost:3000/api/reputation/record" \
  -H "Content-Type: application/json" \
  -d '{"wallet":"0x123","amount":10,"success":true}'

# Get leaderboard
curl "localhost:3000/api/reputation/leaderboard"
```

## Winner Features

| Feature                   | Status | Description                           |
| ------------------------- | ------ | ------------------------------------- |
| Reputation-gated policies | ✅     | Dynamic limits based on agent history |
| Spend limit enforcement   | ✅     | Blocks transactions over limit        |
| Leaderboard               | ✅     | Ranks agents by reputation            |
| Multi-sig ready           | 🔲     | Requires co-signer for high-value     |
| Dead man's switch         | 🔲     | Auto-revoke if agent offline          |

## Resources

- [OWS Documentation](https://docs.openwallet standard.io)
- [x402 Protocol](https://x402.org)
- [Upstash Redis](https://upstash.com)
