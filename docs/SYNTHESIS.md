# Synthesis Hackathon Submission

> **The Synthesis** — March 2026
> AI agents and humans build and judge side by side.
> 28+ partners. $100,000+ in bounties.

## Submission Details

| Field                 | Value                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| **Project**           | OnPoint — Privacy-Preserving Fashion AI Agent                                                          |
| **Status**            | Published                                                                                              |
| **Project URL**       | https://synthesis.devfolio.co/projects/onpoint-privacy-preserving-fashion-ai-agent-9681                |
| **Repo**              | https://github.com/thisyearnofear/onpoint                                                              |
| **ERC-8004 Agent ID** | #35962                                                                                                 |
| **Registration Txn**  | [BaseScan](https://basescan.org/tx/0x04034211a79a65c701d1362359dace27b4f5f0588b515bb344c2331f77f1e555) |
| **Owner Wallet**      | `0x1e17B4FB12B29045b29475f74E536Db97Ddc5D40`                                                           |

## Tracks Entered

| Track                                               | UUID                               | Prize    |
| --------------------------------------------------- | ---------------------------------- | -------- |
| **Best Agent on Celo**                              | `ff26ab4933c84eea856a5c6bf513370b` | $10,000  |
| **Private Agents, Trusted Actions** (Venice)        | `ea3b366947c54689bd82ae80bf9f3310` | 3000 VVV |
| **Agents With Receipts — ERC-8004** (Protocol Labs) | `3bf41be958da497bbb69f1a150c76af9` | $8,004   |

## Problem Statement

Fashion AI apps today have a dirty secret: they hoard your outfit photos. Every selfie you take for style advice sits in a database, potentially used for training or sold to third parties.

**OnPoint solves this** by using Venice AI — a privacy-preserving inference provider with zero data retention. Your outfit analysis happens in real-time and then disappears. Combined with a self-custodial agent wallet on Celo, OnPoint creates an AI stylist that actually owns its economic identity, processes real stablecoin transactions, and creates verifiable onchain artifacts.

## Project Description

OnPoint is an autonomous blockchain-native fashion AI agent that analyzes outfits, recommends products, and mints Style NFTs on Celo. Unlike traditional fashion apps, OnPoint uses Venice AI for privacy-preserving analysis — no data retention, no user outfit data stored.

The agent has a self-custodial wallet (via Tether WDK) on Celo, Base, Ethereum, and Polygon, enabling real economic participation: receiving tips, making payments, and minting NFTs autonomously via function calling. All agent actions produce verifiable onchain receipts following ERC-8004 standards.

## Alignment with Synthesis Themes

### Agents that pay

- Agent has self-custodial wallet on Celo, Base, Ethereum, Polygon
- Receives tips in cUSD/USDT
- Mints NFTs with royalty splits
- Charges for premium Gemini Live access

### Agents that trust

- ERC-8004 identity on Base (Agent #35962)
- Verifiable onchain receipts for all actions
- Self-custody transfer for agent ownership

### Agents that cooperate

- Multi-agent architecture (stylist agent + wallet agent)
- Agent-to-agent tipping protocol
- Tether WDK integration for cross-chain operations

### Agents that keep secrets

- Venice AI with zero data retention
- Privacy-preserving outfit analysis
- No user image storage — analysis happens in real-time then disappears

## Tech Stack

- **AI**: Venice AI (mistral-31-24b) with OpenAI-compatible SDK
- **Blockchain**: Celo, Base, Ethereum, Polygon via Tether WDK
- **Identity**: ERC-8004 on Base
- **Framework**: Next.js 15, React 19, Tailwind CSS
- **Agent Harness**: OpenCode

## Timeline

| Date     | Event                                                                      |
| -------- | -------------------------------------------------------------------------- |
| March 13 | Hackathon kickoff                                                          |
| March 21 | Migrated from Gemini to Venice AI                                          |
| March 22 | Resolved technical debt (rate limiting, validation, centralized providers) |
| March 23 | Registered agent, created project, published submission                    |

## References

- [Synthesis Main](https://synthesis.md)
- [Bounties](https://synthesis.md/hack)
- [Resources](https://synthesis.md/resources)
- [ERC-8004 Spec](https://eips.ethereum.org/EIPS/eip-8004)
