# OnPoint Docs

One canonical doc per concern. [STRATEGY.md](./STRATEGY.md) owns positioning, phases, and metrics — other docs defer to it rather than restating them.

## Start here

| Audience            | Read first                                                              |
| ------------------- | ----------------------------------------------------------------------- |
| New developer       | [README](../README.md) → [GETTING_STARTED.md](./GETTING_STARTED.md)     |
| External agent/dev  | [AGENTS.md](../AGENTS.md) → [guides/agent-commerce.md](./guides/agent-commerce.md) |
| Product/strategy    | [STRATEGY.md](./STRATEGY.md) → [ops/phase1-audit.md](./ops/phase1-audit.md) |

## Canonical docs

| Doc                                        | Owns                                                            |
| ------------------------------------------ | --------------------------------------------------------------- |
| [STRATEGY.md](./STRATEGY.md)               | Thesis, positioning, phases, metrics, expansion gates, kill list |
| [ARCHITECTURE.md](./ARCHITECTURE.md)       | System shape, layers, data flow                                 |
| [FEATURES.md](./FEATURES.md)               | Feature behavior and implementation references                  |
| [GETTING_STARTED.md](./GETTING_STARTED.md) | Local setup, env vars, deployment                               |
| [AGENTS.md](../AGENTS.md)                  | Agent-facing API reference (single source for endpoints)        |

## ChatGPT plugin packaging

- [CHATGPT_PLUGIN_PLAYBOOK.md](./CHATGPT_PLUGIN_PLAYBOOK.md) — shared Oct 2026 shipping rules
- [CHATGPT_PLUGIN_CONNECT.md](./CHATGPT_PLUGIN_CONNECT.md) — connect `https://mcp.onpoint.famile.xyz` in ChatGPT
- [CHATGPT_PLUGIN_EVAL.md](./CHATGPT_PLUGIN_EVAL.md) — intent eval prompts
- [CHATGPT_PLUGIN_STARTER_PROMPTS.md](./CHATGPT_PLUGIN_STARTER_PROMPTS.md) — directory Example Prompts

## guides/ — external how-tos

For people building against OnPoint.

- [agent-commerce.md](./guides/agent-commerce.md) — discover → try-on → order → earnings
- [referral-tracking.md](./guides/referral-tracking.md) — 2.5% referral commissions

## ops/ — internal runbooks

Not for external consumers.

- [phase1-audit.md](./ops/phase1-audit.md) — pilot audit + evidence refresh checklist
- [merchant-onboarding-scorecard.md](./ops/merchant-onboarding-scorecard.md) — merchant activation gate
- [weekly-pilot-report.md](./ops/weekly-pilot-report.md) — weekly metrics template
- [curator-payout-wallets.md](./ops/curator-payout-wallets.md) — custodial/Magic/MiniPay payouts
- [curator-imagery.md](./ops/curator-imagery.md) — listing photo seeding
- [whatsapp-setup.md](./ops/whatsapp-setup.md) — Meta Business API setup
- [youcam-vto.md](./ops/youcam-vto.md) — paid try-on provider config
- [minipay.md](./ops/minipay.md), [auth.md](./ops/auth.md) — integration notes
- `hetzner.md`, `monitoring.md` *(local-only, gitignored — server ops details)*

## adr/ — decision records

Historical technical decisions. Immutable — new decisions get new ADRs.

## research/

Market research inputs. Verify sources before external citation.

## Rules

1. One doc owns each topic — link, don't copy.
2. No dated snapshots, promo deadlines, or hackathon claims in permanent docs.
3. Status words follow the STRATEGY legend: implemented / deployed / live-validated / repeatedly proven.
